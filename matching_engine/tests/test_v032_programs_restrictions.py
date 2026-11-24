"""v0.3.2: Unibagué program catalogue in the HARD program rule, placeholders, independent verifier,
occupational branches (soft, fallback)."""
from __future__ import annotations

import json

import pytest
from openpyxl import load_workbook

from pyr_matching.audit import audit_result
from pyr_matching.constraints import check_pair, program_relation
from pyr_matching.fixtures import write_workbook
from pyr_matching.io_excel import load_mapping, read_bundle, write_result
from pyr_matching.pipeline import run_match
from pyr_matching.policy import POLICY_V03_PATH, Policy, PolicyError
from pyr_matching.programs import (OCCUPATIONAL_BRANCHES, PROGRAMS, canonical_set, is_placeholder, normalization_report,
                                   resolve)
from pyr_matching.schema import DirectDecision, Student, Vacancy
from pyr_matching.scoring import occupational_fit
from pyr_matching.semantic import TfidfConceptBackend

P = "2027A"


def V03():
    return Policy.load(POLICY_V03_PATH)


def st(prog, sid="E1", **kw):
    return Student(sid, P, prog, **kw)


def vc(perfil, alt=None, vid="V1", **kw):
    base = dict(capacity=1, status="APROBADA", vacancy_type="NORMAL", program_profile=perfil, program_profile_alt=alt, municipality="Ibagué",
                modality="PRESENCIAL")
    base.update(kw)
    return Vacancy(vid, P, **base)


# ------------------------------------------------------------------ catalogue and normalisation


@pytest.mark.parametrize("raw,canon,method", [
    ("Ingeniería Sistemas", "Ingeniería de Sistemas", "exacto"),          # Tablero spelling vs official name
    ("INGENIERIA DE SISTEMAS", "Ingeniería de Sistemas", "exacto"),
    ("Contaduría", "Contaduría Pública", "alias"),
    ("Ing. Industrial", "Ingeniería Industrial", "alias"),
    ("Administración de Emrpresas", "Administración de Empresas", "aproximado"),  # typo observed in 2026B
    ("Arquitectira", "Arquitectura", "aproximado"),
    ("Fisioterapia UAM", "Fisioterapia (UAM)", "exacto"),
    ("Diseno", "Diseño", "exacto"),
])
def test_resolve_known_variants(raw, canon, method):
    c, m, _ = resolve(raw)
    assert (c, m) == (canon, method)


@pytest.mark.parametrize("raw", ["Ingeniería Eléctrica", "Ingeniería Agronómica", "Psicología Social", "Mercadeo y Publicidad"])
def test_different_disciplines_are_never_corrected_onto_catalogue(raw):
    c, m, _ = resolve(raw)
    assert m == "no_reconocido" and c not in PROGRAMS


def test_catalogue_has_all_17_current_programs_with_branches():
    current = [p for p, f in PROGRAMS.items() if not f.startswith(("Programa anterior", "Convenio"))]
    assert len(current) == 17
    for p in PROGRAMS:
        assert len(OCCUPATIONAL_BRANCHES[p]) >= 2, p


def test_placeholders_and_multi_program_cells():
    assert all(is_placeholder(x) for x in ["PENDIENTE", "Pendiente nombre proyecto", "#REF!", "N/A", "-"])
    assert not any(is_placeholder(x) for x in ["Ibagué", "Derecho", "Normal"])
    assert resolve("PENDIENTE")[0] is None
    assert canonical_set("Psicología / Derecho") == {"Psicología", "Derecho"}
    assert canonical_set("Comunicación Social y Periodismo") == {"Comunicación Social y Periodismo"}  # 'y' is not a separator
    rep = normalization_report(["Contaduría", "Derecho", "Administración de Emrpresas"])
    assert {r["metodo"] for r in rep} == {"alias", "aproximado"} and all(r["valor_original"] != "Derecho" for r in rep)


# ------------------------------------------------------------------ hard program rule


def test_program_rule_accepts_spelling_variants_and_still_blocks_other_programs():
    pol = V03()
    assert program_relation(st("Ingeniería de Sistemas"), vc("Ingeniería Sistemas")) == "exact"
    assert program_relation(st("Contaduría Pública"), vc("Derecho", "Contaduría")) == "alt"
    assert program_relation(st("Administración de Empresas"), vc("Administración de Emrpresas")) == "exact"
    assert program_relation(st("Psicología"), vc("Derecho / Psicología")) == "exact"
    assert "PROGRAMA_NO_COMPATIBLE" in check_pair(st("Ingeniería Electrónica"), vc("Ingeniería Eléctrica"), pol, P, "SIGA")
    assert "PROGRAMA_NO_COMPATIBLE" in check_pair(st("Derecho"), vc("Psicología"), pol, P, "SIGA")
    assert "PERFIL_PLAZA_NO_VERIFICABLE" in check_pair(st("Derecho"), vc("PENDIENTE"), pol, P, "SIGA")
    assert "PROGRAMA_NO_VERIFICABLE" in check_pair(st("PENDIENTE"), vc("Derecho"), pol, P, "SIGA")


def test_pending_approved_municipality_fails_safe_never_skips_restriction():
    pol = V03()
    d = DirectDecision("E1", P, "MUNICIPIO_ORIGEN", "APROBADO", approved_municipality="PENDIENTE")
    b = check_pair(st("Derecho"), vc("Derecho", vacancy_type="MUNICIPIO_ORIGEN"), pol, P, "MUNICIPIO_ORIGEN", d)
    assert "MUNICIPIO_NO_VERIFICABLE" in b
    d2 = DirectDecision("E1", P, "MUNICIPIO_ORIGEN", "APROBADO", approved_municipality="Líbano")
    assert "MUNICIPIO_NO_VERIFICABLE" in check_pair(st("Derecho"), vc("Derecho", vacancy_type="MUNICIPIO_ORIGEN", municipality="PENDIENTE"),
                                                     pol, P, "MUNICIPIO_ORIGEN", d2)


def _workbook(tmp_path, students, vacancies, decisions=()):
    from pyr_matching.fixtures import _st, _vc

    rows = {"Estudiantes": [_st(*s) for s in students], "Plazas": [_vc(*v[:6], **(v[6] if len(v) > 6 else {})) for v in vacancies],
            "Decisiones_Directas": list(decisions), "Matriculas_SIGA": []}
    return write_workbook(tmp_path / "in.xlsx", rows)


def test_end_to_end_mixed_spellings_placeholders_and_audit_sheet(tmp_path):
    pol = V03()
    path = _workbook(tmp_path, [
        ("E1", "Ingeniería de Sistemas", "Ibagué", "Quiero desarrollar software para comunidades."),
        ("E2", "Contaduría Pública", "Ibagué", "Me interesa la contabilidad de asociaciones."),
        ("E3", "Administración de Empresas", "Ibagué", None),
        ("E4", "Ingeniería Electrónica", "Ibagué", "Automatización."),
    ], [
        ("V1", "Ibagué", 1, "Normal", "Ingeniería Sistemas", "Desarrollo de software a la medida."),
        ("V2", "Ibagué", 1, "Normal", "Contaduría", "Gestión contable de la fundación."),
        ("V3", "Ibagué", 1, "Normal", "Administración de Emrpresas", "Fortalecimiento organizacional y modelo de negocio."),
        ("V4", "PENDIENTE", 1, "Normal", "Ingeniería Eléctrica", "Mantenimiento eléctrico."),
    ], [["E2", P, "Municipio de origen", "Aprobado", None, "NO", "PENDIENTE", None, None]])
    bundle = read_bundle([path], pol, load_mapping())
    w = " ".join(bundle.load_warnings)
    assert "PROGRAMA_CORREGIDO_APROX" in w and "PROGRAMA_NO_RECONOCIDO" in w and "VALOR_PENDIENTE_COMO_DESCONOCIDO" in w
    res = run_match(bundle, P, pol, pairs_detail="all", run_timestamp="t")
    recs = {(r["id_estudiante"], r["id_plaza"]) for r in res.tables["Recomendaciones_SIGA"]}
    assert ("E1", "V1") in recs and ("E3", "V3") in recs          # no wrongful exclusion by spelling
    assert not any(p == "V4" for _, p in recs)                     # 'Eléctrica' never matched to Electrónica
    sin = {r["id_estudiante"]: r["codigo_motivo"] for r in res.tables["Sin_Asignacion"]}
    assert sin.get("E2") == "MUNICIPIO_APROBADO_FALTANTE"         # 'PENDIENTE' approved municipality -> human management
    assert res.summary["violaciones_generadas_por_motor"] == 0 and res.summary["programas_normalizados_no_exactos"] >= 3
    out = write_result(res, tmp_path / "out.xlsx")
    assert "Normalizacion_Programas" in load_workbook(out).sheetnames


def test_independent_verifier_catches_an_injected_violation(tmp_path):
    pol = V03()
    path = _workbook(tmp_path, [("E1", "Derecho", "Ibagué", "Derechos humanos."), ("E2", "Psicología", "Ibagué", "Salud mental.")],
                     [("V1", "Ibagué", 1, "Normal", "Derecho", "Consultorio jurídico."), ("V2", "Ibagué", 1, "Normal", "Psicología", "Apoyo psicosocial.")])
    bundle = read_bundle([path], pol, load_mapping())
    res = run_match(bundle, P, pol, run_timestamp="t")
    tampered = json.loads(json.dumps(res.tables, default=str))
    bad = dict(tampered["Recomendaciones_SIGA"][0], id_estudiante="E2", id_plaza="V1", rango=9)
    tampered["Recomendaciones_SIGA"].append(bad)                   # psychology student on a law-only plaza
    rows, counts = audit_result(bundle, P, pol, tampered)
    codes = {r["codigo"] for r in rows if r["origen"] == "GENERADO_POR_MOTOR"}
    assert "VERIFICADOR_INDEPENDIENTE_RECOMENDACION_PROGRAMA" in codes and "RECOMENDACION_PROGRAMA_NO_COMPATIBLE" in codes
    assert "RANGOS_RECOMENDACION_INCONSISTENTES" in codes and counts["violaciones_generadas_por_motor"] > 0


# ------------------------------------------------------------------ occupational branches


def test_occupational_fit_uses_best_branch_of_broad_programs():
    be = TfidfConceptBackend(0.5)
    projects = {"red": "Diseño y administración de la red WiFi y conectividad de la institución educativa.",
                "sw": "Desarrollo de una aplicación móvil para el acueducto comunitario.",
                "otro": "Acompañamiento psicosocial a mujeres víctimas."}
    from pyr_matching.programs import all_branch_texts
    be.prepare(list(projects.values()) + all_branch_texts())
    s = st("Ingeniería Sistemas")
    scores = {k: occupational_fit(s, vc("Ingeniería de Sistemas", project_description=t), be) for k, t in projects.items()}
    assert scores["red"][1] == "redes_nube" and scores["sw"][1] == "desarrollo_software"
    assert min(scores["red"][0], scores["sw"][0]) > scores["otro"][0]   # networks count as much as software: no exclusion
    assert occupational_fit(st("Programa Inexistente"), vc("Derecho", project_description="x"), be) == (None, None)


def test_occupational_is_fallback_only_and_never_blocks():
    pol = V03()
    assert pol["occupational_mode"] == "fallback" and pol.weights["occupational"] > 0
    from pyr_matching.scoring import component_scores_v03
    from pyr_matching.programs import all_branch_texts

    be = TfidfConceptBackend(0.5)
    v = vc("Ingeniería de Sistemas", project_description="Desarrollo de software para la alcaldía.")
    with_text = st("Ingeniería de Sistemas", expectations_text="Quiero programar aplicaciones.")
    no_text = st("Ingeniería de Sistemas", sid="E2")
    be.prepare([v.project_text(), with_text.aspiration_text()] + all_branch_texts())
    assert component_scores_v03(with_text, v, pol, be)["occupational"] is None
    assert component_scores_v03(no_text, v, pol, be)["occupational"] is not None
    raw = json.loads(POLICY_V03_PATH.read_text(encoding="utf-8"))
    raw["occupational_mode"] = "siempre"
    with pytest.raises(PolicyError):
        Policy(raw)
