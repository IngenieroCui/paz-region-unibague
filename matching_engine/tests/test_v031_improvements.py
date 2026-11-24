"""v0.3.1: concept-aware offline semantics, exploration pairs + full blinding in expert review,
minimum subgroup size in the fairness gate."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from openpyxl import load_workbook

from pyr_matching.feedback import import_feedback, make_review_workbook
from pyr_matching.fixtures import random_rows, write_workbook
from pyr_matching.io_excel import load_mapping, read_bundle
from pyr_matching.pipeline import run_match
from pyr_matching.policy import POLICY_V03_PATH, Policy, PolicyError
from pyr_matching.semantic import TfidfBackend, TfidfConceptBackend, build_backend
from pyr_matching.semantic_lexicon import CONCEPTS, LEXICON_VERSION, concept_hits
from pyr_matching.semantic import normalize_tokens_ordered

BENCH = Path(__file__).resolve().parents[1] / "benchmarks"


def _hits(text):
    return set(concept_hits(normalize_tokens_ordered(text)))


# ------------------------------------------------------------------ lexicon & backend


def test_lexicon_prefix_phrase_and_exact_rules():
    assert {"infancia", "lectura_escritura"} <= _hits("Los niños de la vereda aprenden a leer")
    assert "organizacion_comunitaria" in _hits("Junta de acción comunal")  # phrase with stopword removed
    assert "agua" not in _hits("Proyecto en Rioblanco")  # 3-char trigger 'rio' is exact, not a prefix
    assert "agua" in _hits("Cuidado del río y sus quebradas")
    assert _hits("") == set() and concept_hits([]) == []


def test_lexicon_has_no_sensitive_person_attributes():
    banned = ("estrato", "religi", "orientacion sexual", "embaraz", "diagnostico medico", "raza")
    for cid, trig in CONCEPTS.items():
        for t in trig:
            assert not any(t.startswith(b) for b in banned), (cid, t)


def test_concept_backend_links_paraphrases_that_tfidf_misses():
    a = "Me interesa programar aplicaciones para celulares."
    b = "Desarrollo de una app móvil para la comercialización de productos campesinos."
    c = "Monitoreo de calidad hídrica en microcuencas del municipio."
    plain, conc = TfidfBackend(), TfidfConceptBackend(0.5)
    for be in (plain, conc):
        be.prepare([a, b, c])
    assert (plain.similarity(a, b) or 0) == pytest.approx(plain.similarity(a, c) or 0, abs=1)  # no shared words
    assert conc.similarity(a, b) > conc.similarity(a, c) + 10
    assert LEXICON_VERSION in conc.version and "a=0.5" in conc.version


def test_concept_backend_alpha_zero_equals_tfidf_and_is_deterministic():
    texts = ["Huertas escolares para la nutrición infantil", "Quiero mejorar la alimentación de los niños", "Asesoría contable"]
    z, p = TfidfConceptBackend(0.0), TfidfBackend()
    z.prepare(texts), p.prepare(texts)
    for x in texts:
        for y in texts:
            assert z.similarity(x, y) == pytest.approx(p.similarity(x, y))
    a1, a2 = TfidfConceptBackend(), TfidfConceptBackend()
    a1.prepare(texts), a2.prepare(list(reversed(texts)))
    assert a1.similarity(texts[0], texts[1]) == a2.similarity(texts[0], texts[1])
    with pytest.raises(ValueError):
        TfidfConceptBackend(1.5)


def test_benchmarks_dev_and_holdout_improve():
    sys.path.insert(0, str(BENCH))
    try:
        import semantic_benchmark as sb
        from semantic_holdout import HOLDOUT_PAIRS
    finally:
        sys.path.pop(0)
    dev = list(sb.PAIRS)
    for pairs, floor in ((dev, 0.8), (HOLDOUT_PAIRS, 0.8)):
        sb.PAIRS[:] = pairs
        base, conc = sb.evaluate(TfidfBackend()), sb.evaluate(TfidfConceptBackend(0.5))
        assert conc["top1_accuracy"] >= floor and conc["mrr"] > base["mrr"] + 0.3
    sb.PAIRS[:] = dev


def test_policy_v03_defaults_to_concepts_and_validates():
    pol = Policy.load(POLICY_V03_PATH)
    be, warn = build_backend(pol)
    assert be.name == "tfidf-conceptos" and not warn
    raw = json.loads(POLICY_V03_PATH.read_text(encoding="utf-8"))
    raw["semantic"]["concept_weight"] = 2
    with pytest.raises(PolicyError):
        Policy(raw)
    raw["semantic"]["concept_weight"] = 0.5
    raw["semantic"]["fallback_backend"] = "sentence-transformers"
    with pytest.raises(PolicyError):
        Policy(raw)
    assert Policy.load().get("semantic")["backend"] == "tfidf"  # v0.2 default policy unchanged (parity)


def test_embeddings_unavailable_falls_back_to_concepts():
    raw = json.loads(POLICY_V03_PATH.read_text(encoding="utf-8"))
    raw["semantic"]["backend"] = "sentence-transformers"
    raw["semantic"]["embedding_model"] = "modelo/que-no-existe-localmente"
    be, warn = build_backend(Policy(raw))
    assert be.name == "tfidf-conceptos" and warn and warn[0].startswith("SEMANTIC_BACKEND_UNAVAILABLE")


# ------------------------------------------------------------------ expert review


@pytest.fixture
def v03_bundle(tmp_path):
    pol = Policy.load(POLICY_V03_PATH)
    rows = random_rows(60, 30, seed=21, period="2027A")
    bundle = read_bundle([write_workbook(tmp_path / "in.xlsx", rows)], pol, load_mapping())
    return bundle, pol


def _rows(path):
    ws = load_workbook(path)["Revision_Pares"]
    h = [c.value for c in ws[1]]
    return [dict(zip(h, [c.value for c in r])) for r in ws.iter_rows(min_row=2)], {r["clave"]: r["valor"] for r in _meta(path)}


def _meta(path):
    ws = load_workbook(path)["Metadatos"]
    return [{"clave": r[0].value, "valor": r[1].value} for r in ws.iter_rows(min_row=2)]


def test_exploration_pairs_are_eligible_not_recommended_and_reproducible(v03_bundle, tmp_path):
    bundle, pol = v03_bundle
    res = run_match(bundle, "2027A", pol, pairs_detail="all", run_timestamp="t1")
    p1 = make_review_workbook(res, bundle, "2027A", tmp_path / "a.xlsx", pol, per_student=2, explore=2)
    p2 = make_review_workbook(res, bundle, "2027A", tmp_path / "b.xlsx", pol, per_student=2, explore=2)
    rows, meta = _rows(p1)
    exp = [r for r in rows if r["contexto"] == "SIGA_EXPLORACION"]
    top = {(r["id_estudiante"], r["id_plaza"]) for r in rows if r["contexto"] == "SIGA_RECOMENDADA"}
    assert exp and int(meta["filas_exploracion"]) == len(exp)
    assert not ({(r["id_estudiante"], r["id_plaza"]) for r in exp} & top)
    eligible = {(r["id_estudiante"], r["id_plaza"]) for r in res.tables["Pares_Evaluados"] if r["elegible"] == "SI"}
    assert {(r["id_estudiante"], r["id_plaza"]) for r in exp} <= eligible
    assert max(sum(1 for r in exp if r["id_estudiante"] == s) for s in {r["id_estudiante"] for r in exp}) <= 2
    assert [(r["id_estudiante"], r["id_plaza"]) for r in _rows(p2)[0]] == [(r["id_estudiante"], r["id_plaza"]) for r in rows]


def test_blind_mode_hides_rank_and_order_and_import_accepts_exploration(v03_bundle, tmp_path):
    bundle, pol = v03_bundle
    res = run_match(bundle, "2027A", pol, pairs_detail="all", run_timestamp="t2")
    p = make_review_workbook(res, bundle, "2027A", tmp_path / "c.xlsx", pol, per_student=3, blind=True, explore=1)
    rows, _ = _rows(p)
    assert all(r["rango"] is None and r["compatibilidad"] is None and r["componentes"] is None for r in rows)
    wb = load_workbook(p)
    ws = wb["Revision_Pares"]
    h = {c.value: i for i, c in enumerate(ws[1])}
    for r in ws.iter_rows(min_row=2):
        r[h["evaluacion_idoneidad"]].value = "4 - Alta" if r[h["contexto"]].value == "SIGA_RECOMENDADA" else "2 - Baja"
        r[h["id_revisor"]].value, r[h["estado_aprobacion"]].value, r[h["aprobado_por"]].value = "REV-1", "APROBADA", "COORD"
    wb.save(p)
    out = import_feedback([p], tmp_path / "store")
    assert out["filas_aceptadas"] == len(rows) and out["rechazos"] == {}


def test_cli_feedback_template_explore_flag(tmp_path, capsys):
    from pyr_matching.cli import main

    inp = write_workbook(tmp_path / "in.xlsx", random_rows(30, 15, seed=3, period="2027A"))
    assert main(["feedback-template", "--inputs", str(inp), "--period", "2027A", "--policy", str(POLICY_V03_PATH), "--out", str(tmp_path / "r.xlsx"),
                 "--blind", "--explore", "1", "--timestamp", "t"]) == 0
    rows, meta = _rows(tmp_path / "r.xlsx")
    assert int(meta["filas_exploracion"]) > 0


# ------------------------------------------------------------------ fairness gate minimum size


def test_subgroup_gate_ignores_tiny_groups_but_reports_them(tmp_path):
    from pyr_matching import training

    pol_raw = json.loads(POLICY_V03_PATH.read_text(encoding="utf-8"))
    assert pol_raw["training"]["min_subgroup_labels"] == 30 and pol_raw["training"]["min_subgroup_per_class"] == 5
    sys.path.insert(0, str(BENCH))
    try:
        import simulacion_reentrenamiento as sim
    finally:
        sys.path.pop(0)
    r = sim.retrain_study(Policy(pol_raw), 40, 20, 2, 7, tmp_path)
    assert r["estado"] != "NO_ENTRENABLE"
    art = json.loads(next(tmp_path.glob("registro_*_40_2_7/*/model.json")).read_text(encoding="utf-8"))
    assert art["subgroup_gate_minimums"] == {"min_subgroup_labels": 30, "min_subgroup_per_class": 5}
    small = [g for gs in art["subgroups_too_small_for_gate"].values() for g in gs]
    assert small, "con 40 estudiantes por periodo debe haber subgrupos pequeños reportados"
    for gate in art["promotion_gates_failed"]:
        if gate.startswith("RECHAZADO_DEGRADA_SUBGRUPO"):
            attr, g = gate.split(" ", 1)[1].split("=", 1)
            assert not any(s.startswith(g + " (") for s in art["subgroups_too_small_for_gate"].get(attr, []))
