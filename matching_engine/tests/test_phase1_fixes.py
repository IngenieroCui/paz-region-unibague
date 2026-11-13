"""Regression tests for the five Phase-1 audit findings (v0.3 hardening). Synthetic data only."""
import copy
import json
import random
import zipfile

import pytest
from conftest import TS

from pyr_matching.audit import audit_result
from pyr_matching.fixtures import hand_rows, random_rows, write_workbook
from pyr_matching.io_excel import is_formula_like, load_mapping, read_bundle, read_output_table, write_result
from pyr_matching.pipeline import ValidationFailed, run_match
from pyr_matching.policy import POLICY_V03_PATH, Policy
from pyr_matching.schema import Label
from pyr_matching.training import LogisticModel, Registry, RegistryError, train

# ---------------------------------------------------------------- 1. multi-workbook consolidation


def _period_rows(period):
    rows = hand_rows()
    for sheet in ("Estudiantes", "Plazas", "Decisiones_Directas", "Matriculas_SIGA"):
        for r in rows[sheet]:
            idx = 1 if sheet in ("Estudiantes", "Plazas", "Decisiones_Directas") else 2
            r[idx] = period
    return rows


def test_all_matching_sheets_across_files_are_read(tmp_path, policy):
    a = write_workbook(tmp_path / "2026A.xlsx", _period_rows("2026A"))
    b = write_workbook(tmp_path / "2026B.xlsx", _period_rows("2026B"))
    bundle = read_bundle([a, b], policy, load_mapping())
    assert {s.period for s in bundle.students} == {"2026A", "2026B"}  # v0.2 silently read only 2026A
    assert len(bundle.students) == 2 * len(hand_rows()["Estudiantes"])
    assert any(w.startswith("CONSOLIDACION_MULTIHOJA estudiantes: 2 hojas") for w in bundle.load_warnings)
    s = next(s for s in bundle.students if s.period == "2026B")
    assert s.source.startswith("2026B.xlsx::Estudiantes::")
    for period in ("2026A", "2026B"):
        res = run_match(bundle, period, policy, run_timestamp=TS)
        assert res.summary["estudiantes_periodo"] == len(hand_rows()["Estudiantes"])


def test_exact_duplicate_export_is_collapsed_with_warning(tmp_path, policy):
    a = write_workbook(tmp_path / "a.xlsx", hand_rows())
    b = write_workbook(tmp_path / "a_copia.xlsx", hand_rows())
    bundle = read_bundle([a, b], policy, load_mapping())
    assert len(bundle.students) == len(hand_rows()["Estudiantes"])
    assert any(w.startswith("DUPLICADO_EXACTO_ENTRE_FUENTES") for w in bundle.load_warnings)
    run_match(bundle, "2027A", policy, run_timestamp=TS)  # no blocking issue


def test_conflicting_duplicate_across_files_blocks_with_provenance(tmp_path, policy):
    rows2 = hand_rows()
    rows2["Estudiantes"][0][2] = "Psicología"  # same ID, different program
    bundle = read_bundle([write_workbook(tmp_path / "a.xlsx", hand_rows()), write_workbook(tmp_path / "b.xlsx", rows2)], policy, load_mapping())
    with pytest.raises(ValidationFailed) as e:
        run_match(bundle, "2027A", policy, run_timestamp=TS)
    dup = [i for i in e.value.issues if i["code"] == "ID_DUPLICADO"]
    assert dup and "a.xlsx::Estudiantes::2" in dup[0]["fuentes"] and "b.xlsx::Estudiantes::2" in dup[0]["fuentes"]
    assert "Psicolog" not in json.dumps(e.value.issues)  # provenance only, never cell values


# ---------------------------------------------------------------- 2. missing mandatory profile


def _no_profile_rows():
    rows = hand_rows()
    rows["Plazas"][0][14] = None  # V01 loses its mandatory academic profile
    return rows


def test_missing_vacancy_profile_fails_safe_by_default(tmp_path, policy):
    res = run_match(read_bundle([write_workbook(tmp_path / "x.xlsx", _no_profile_rows())], policy, load_mapping()), "2027A", policy,
                    run_timestamp=TS, pairs_detail="all")
    assert all(r["id_plaza"] != "V01" for r in res.tables["Recomendaciones_SIGA"])
    assert res.summary["violaciones_generadas_por_motor"] == 0


def test_missing_vacancy_profile_review_mode_flags_pairs(tmp_path):
    pol = Policy({**Policy.load().raw, "missing_vacancy_profile": "review"})
    res = run_match(read_bundle([write_workbook(tmp_path / "x.xlsx", _no_profile_rows())], pol, load_mapping()), "2027A", pol, run_timestamp=TS)
    v01 = [r for r in res.tables["Recomendaciones_SIGA"] if r["id_plaza"] == "V01"]
    assert v01 and all(r["alertas"] == "REQUIERE_REVISION_PERFIL" and "revisión institucional" in r["explicacion"] for r in v01)


# ---------------------------------------------------------------- 3. registry promotion safety


def _labelled_bundle(tmp_path, policy):
    a = random_rows(80, 30, seed=1, period="2026A")
    b = random_rows(80, 30, seed=2, period="2026B")
    bundle = read_bundle([write_workbook(tmp_path / "multi.xlsx", {k: a[k] + b[k] for k in a})], policy, load_mapping())
    smap = {(s.student_id, s.period): s for s in bundle.students}
    rng = random.Random(3)
    labels = []
    for v in bundle.vacancies:
        if v.vacancy_type != "NORMAL":
            continue
        for s in [x for x in bundle.students if x.period == v.period and x.academic_program == v.program_profile][:6]:
            topical = any(w in (smap[(s.student_id, s.period)].professional_text() or "") for w in (v.project_description or "").split()[2:4])
            labels.append(Label(s.student_id, v.vacancy_id, v.period, 1.0 if (topical or rng.random() < 0.15) else 0.0, "REVISION_EXPERTA_PAR"))
    bundle.labels = labels
    return bundle


@pytest.fixture
def trained(tmp_path, policy):
    bundle = _labelled_bundle(tmp_path, policy)
    art = train(bundle, policy, tmp_path / "reg", command="test")
    return bundle, art, Registry(tmp_path / "reg")


def test_training_never_auto_activates_by_default(trained):
    _, art, reg = trained
    assert art["activated"] is False and reg.index()["active"] is None
    assert art["requires_human_approval_to_activate"] is True and art["model_track"] == "suitability"


def test_activation_requires_approver_and_compatible_policy(trained, policy):
    _, art, reg = trained
    with pytest.raises(RegistryError, match="Se requiere la política"):
        reg.activate(art["model_id"])
    with pytest.raises(RegistryError, match="APROBACION_REQUERIDA"):
        reg.activate(art["model_id"], policy)
    other = Policy({**policy.raw, "minimum_recommended_score": 55})
    probs = reg.activation_problems(art["model_id"], other)
    assert any(p.startswith("POLITICA_DISTINTA") for p in probs)
    with pytest.raises(RegistryError, match="ACTIVACION_RECHAZADA"):
        reg.activate(art["model_id"], other, "Coordinación PyR")
    v03 = Policy.load(POLICY_V03_PATH)
    assert any(p.startswith("ALGORITMO_DISTINTO") for p in reg.activation_problems(art["model_id"], v03))


def test_rejected_model_cannot_be_activated(tmp_path, trained, policy):
    _, art, reg = trained
    tampered = copy.deepcopy(art)
    tampered["model_id"] = "lr-rechazado"
    tampered["status"] = "RECHAZADO_NO_SUPERA_LINEA_BASE"
    reg.save(tampered)
    with pytest.raises(RegistryError, match="ESTADO_NO_PROMOVIBLE"):
        reg.activate("lr-rechazado", policy, "Coordinación PyR")


def test_activation_and_rollback_with_approval(trained, policy):
    bundle, art, reg = trained
    if art["status"] != "PROMOVIBLE":
        pytest.skip("El modelo sintético no superó la línea base en esta semilla (mecánica cubierta por otras pruebas).")
    reg.activate(art["model_id"], policy, "Coordinación PyR", "piloto")
    assert reg.active_model(policy).model_id == art["model_id"]
    ev = reg.index()["history"][-1]
    assert ev["approved_by"] == "Coordinación PyR" and ev["policy_fingerprint"] == policy.fingerprint
    with pytest.raises(ValueError, match="MODELO_INCOMPATIBLE"):
        reg.active_model(Policy({**policy.raw, "top_k": 3}))
    assert reg.rollback(policy, "Coordinación PyR") is None and reg.active_model() is None


def test_behavior_track_cannot_be_used_as_suitability(tmp_path, trained, policy):
    _, art, reg = trained
    beh = copy.deepcopy(art)
    beh["model_track"] = "behavior"
    path = tmp_path / "beh.json"
    path.write_text(json.dumps(beh), encoding="utf-8")
    with pytest.raises(ValueError, match="MODELO_DE_OTRA_PISTA"):
        LogisticModel.load(path)
    with pytest.raises(RegistryError, match="otra pista"):
        reg.save(beh)
    with pytest.raises(RegistryError, match="REGISTRO_DE_OTRA_PISTA"):
        Registry(reg.root, track="behavior").index()


def test_training_on_v03_policy(tmp_path):
    pol = Policy.load(POLICY_V03_PATH)
    bundle = _labelled_bundle(tmp_path, pol)
    art = train(bundle, pol, tmp_path / "reg03")
    assert art["feature_schema_version"] == "pyr-features/2.0" and "historical" not in art["components"]
    m = LogisticModel.load(tmp_path / "reg03" / art["model_id"] / "model.json", policy=pol)
    res = run_match(bundle, "2026B", pol, model=m, run_timestamp=TS)
    assert res.summary["version_algoritmo"] == f"hybrid-pyr-v0.3+{art['model_id']}"


# ---------------------------------------------------------------- 4. formula injection

PAYLOADS = ['=HYPERLINK("http://ataque.example","clic")', "+cmd|' /C calc'!A0", "-2+3", "@SUM(1+1)", "\t=1+1", "＝1+1"]


def test_formula_like_strings_are_written_as_inert_text(tmp_path, policy):
    rows = hand_rows()
    for i, payload in enumerate(PAYLOADS):
        rows["Plazas"][i][3] = payload  # project name echoed in several output sheets
    rows["Plazas"][0][7] = "=1+1"  # organisation name
    res = run_match(read_bundle([write_workbook(tmp_path / "in.xlsx", rows)], policy, load_mapping()), "2027A", policy,
                    run_timestamp=TS, simulate_general_assignment=True)
    out = write_result(res, tmp_path / "out.xlsx")
    with zipfile.ZipFile(out) as z:
        for name in z.namelist():
            if name.startswith("xl/worksheets/"):
                assert b"<f>" not in z.read(name) and b"<f " not in z.read(name), name
    plazas = {r["id_plaza"]: r for r in read_output_table(out, "Plazas_Disponibles")}
    assert plazas["V01"]["proyecto"] == PAYLOADS[0] and plazas["V01"]["organizacion"] == "=1+1"  # value preserved
    from openpyxl import load_workbook

    ws = load_workbook(out)["Plazas_Disponibles"]
    cells = [c for row in ws.iter_rows() for c in row if isinstance(c.value, str) and is_formula_like(c.value)]
    assert cells and all(c.data_type == "s" and c.quotePrefix for c in cells)


def test_is_formula_like():
    assert all(is_formula_like(p) for p in PAYLOADS)
    assert not any(is_formula_like(x) for x in ("Ibagué", "PRY-1", "", None, 3))


# ---------------------------------------------------------------- 5. historical vs engine violations


def test_institutional_conflicts_are_separated_from_engine_violations(tmp_path, policy):
    rows = hand_rows()
    rows["Matriculas_SIGA"] += [["E01", "V01", "2027A", "Matriculado"], ["E09", "V01", "2027A", "Matriculado"]]  # V01 capacity 1
    rows["Decisiones_Directas"][2][4] = "V02"  # E06 (Contaduría) confirmed in a PSI-only plaza
    res = run_match(read_bundle([write_workbook(tmp_path / "x.xlsx", rows)], policy, load_mapping()), "2027A", policy,
                    run_timestamp=TS, simulate_general_assignment=True)
    s = res.summary
    assert s["violaciones_generadas_por_motor"] == 0 and s["violaciones_restricciones_duras"] == 0
    codes = {r["codigo"] for r in res.tables["Auditoria_Restricciones"] if r["origen"] == "HISTORICO_INSTITUCIONAL"}
    assert "SOBRECUPO_INSTITUCIONAL" in codes and "DIRECTA_CONFIRMADA_PROGRAMA_NO_COMPATIBLE" in codes
    assert s["conflictos_historicos_institucionales"] == len([r for r in res.tables["Auditoria_Restricciones"] if r["origen"] == "HISTORICO_INSTITUCIONAL"])


def test_independent_audit_catches_tampered_engine_rows(hand_bundle, hand_result, policy):
    tables = copy.deepcopy(hand_result.tables)
    tables["Recomendaciones_SIGA"].append({**tables["Recomendaciones_SIGA"][0], "id_estudiante": "E01", "id_plaza": "V02"})  # PSI-only plaza
    tables["Asignaciones_Directas"].append({"id_estudiante": "E13", "id_plaza": "V06", "estado": "PROPUESTA_REQUIERE_APROBACION"})
    rows, counts = audit_result(hand_bundle, "2027A", policy, tables)
    motor = {r["codigo"] for r in rows if r["origen"] == "GENERADO_POR_MOTOR"}
    assert "RECOMENDACION_PROGRAMA_NO_COMPATIBLE" in motor and "CONVOCATORIA_SELECCIONADA_POR_MOTOR" in motor
    assert counts["violaciones_generadas_por_motor"] >= 2
