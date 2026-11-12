import itertools
import random

import pytest

from pyr_matching.fixtures import random_rows, write_workbook
from pyr_matching.io_excel import load_mapping, read_bundle
from pyr_matching.optimizer import Edge, min_cost_assignment
from pyr_matching.pipeline import run_match
from pyr_matching.schema import Label
from pyr_matching.semantic import SentenceTransformerBackend, TfidfBackend, build_backend
from pyr_matching.training import LogisticModel, NotTrainable, Registry, train


# ---------------- optimizer -------------------------------------------------------------------

def test_optimizer_matches_exhaustive_oracle():
    rng = random.Random(11)
    for _ in range(150):
        S, V = rng.randint(1, 5), rng.randint(1, 3)
        cap = {f"v{j}": rng.randint(0, 2) for j in range(V)}
        edges = [Edge(f"s{i}", f"v{j}", round(rng.uniform(0, 100), 2)) for i in range(S) for j in range(V) if rng.random() < 0.7]
        got = min_cost_assignment([f"s{i}" for i in range(S)], cap, edges)
        best = (-1, -1.0)
        by_s = {f"s{i}": [e for e in edges if e.student_id == f"s{i}"] for i in range(S)}
        for choice in itertools.product(*[[None] + by_s[s] for s in sorted(by_s)]):
            used = {}
            ok = True
            for e in choice:
                if e is not None:
                    used[e.vacancy_id] = used.get(e.vacancy_id, 0) + 1
                    ok &= used[e.vacancy_id] <= cap[e.vacancy_id]
            if ok:
                cand = (sum(e is not None for e in choice), round(sum(e.score for e in choice if e), 2))
                best = max(best, cand)
        assert (len(got), round(sum(e.score for e in got), 2)) == best


# ---------------- semantic --------------------------------------------------------------------

def test_tfidf_semantic_is_meaningful_and_accent_insensitive():
    be = TfidfBackend()
    texts = ["Acompañamiento psicosocial a jóvenes y familias", "acompanamiento psicosocial familias jovenes",
             "Contabilidad y finanzas de cooperativas", "desarrollo de software"]
    be.prepare(texts)
    assert be.similarity(texts[0], texts[1]) > 60
    assert be.similarity(texts[0], texts[1]) > be.similarity(texts[0], texts[2])
    assert be.similarity("", texts[0]) is None


def test_embedding_backend_with_injected_encoder_and_fallback(policy):
    vec = {"a": [1.0, 0.0], "b": [0.8, 0.6], "c": [0.0, 1.0]}
    be = SentenceTransformerBackend("fake", encoder=lambda ts: [vec[t] for t in ts])
    be.prepare(["a", "b", "c"])
    assert be.similarity("a", "b") == 80.0 and be.similarity("a", "c") == 0.0
    raw = {**policy.raw, "semantic": {**policy.raw["semantic"], "backend": "sentence-transformers", "embedding_model": "no/such-model-xyz"}}
    from pyr_matching import Policy

    backend, warns = build_backend(Policy(raw))
    assert isinstance(backend, TfidfBackend) and warns and warns[0].startswith("SEMANTIC_BACKEND_UNAVAILABLE")


def test_semantic_component_is_recorded_in_summary(hand_bundle, policy):
    res = run_match(hand_bundle, "2027A", policy, semantic_override="none", run_timestamp="t")
    assert res.summary["backend_semantico"] == "none"
    assert all(r["c_semantic"] is None for r in res.tables["Pares_Evaluados"])


# ---------------- training gates ---------------------------------------------------------------

def _bundle_two_periods(tmp_path, policy):
    a = random_rows(80, 30, seed=1, period="2026A")
    b = random_rows(80, 30, seed=2, period="2026B")
    rows = {k: a[k] + b[k] for k in a}
    return read_bundle([write_workbook(tmp_path / "multi.xlsx", rows)], policy, load_mapping())


def test_training_refuses_without_labels(tmp_path, policy):
    bundle = _bundle_two_periods(tmp_path, policy)
    with pytest.raises(NotTrainable, match="NO_HAY_ETIQUETAS"):
        train(bundle, policy, tmp_path / "reg")
    assert not (tmp_path / "reg").exists()


def test_training_refuses_historical_assignments_as_labels(tmp_path, policy):
    bundle = _bundle_two_periods(tmp_path, policy)
    bundle.labels = [Label(s.student_id, "P0001", s.period, 1.0, "ASIGNACION_HISTORICA") for s in bundle.students[:5]]
    with pytest.raises(NotTrainable) as e:
        train(bundle, policy, tmp_path / "reg")
    assert "sesgo de selección" in e.value.reasons[0]


def test_training_refuses_single_period_and_too_few(tmp_path, policy):
    bundle = _bundle_two_periods(tmp_path, policy)
    bundle.labels = [Label(s.student_id, "P0001", "2026A", 1.0, "REVISION_EXPERTA_PAR") for s in bundle.students if s.period == "2026A"][:10]
    with pytest.raises(NotTrainable) as e:
        train(bundle, policy, tmp_path / "reg")
    assert any(r.startswith("POCAS_ETIQUETAS") for r in e.value.reasons) and any(r.startswith("POCOS_PERIODOS") for r in e.value.reasons)


def test_training_pipeline_mechanics_on_synthetic_labels(tmp_path, policy):
    """SYNTHETIC labels only to exercise mechanics (split, metrics, registry, rollback). Not a quality claim."""
    bundle = _bundle_two_periods(tmp_path, policy)
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
    art = train(bundle, policy, tmp_path / "reg", command="test")
    assert art["leakage_audit"]["periodo_prueba"] == "2026B" and art["leakage_audit"]["periodos_entrenamiento"] == ["2026A"]
    assert art["constraint_violation_rate"] == 0.0 and art["feature_schema_version"] == "pyr-features/1.0"
    assert set(art["metrics"]) == {"modelo_test", "linea_base_test", "modelo_train"}
    assert art["status"] in ("PROMOVIBLE", "RECHAZADO_NO_SUPERA_LINEA_BASE")
    reg = Registry(tmp_path / "reg")
    model = LogisticModel.load(tmp_path / "reg" / art["model_id"] / "model.json")
    res = run_match(bundle, "2026B", policy, model=model, run_timestamp="t")
    assert res.summary["version_algoritmo"].endswith(art["model_id"])
    reg.activate(None)
    assert reg.active_model() is None  # rollback to deterministic baseline


@pytest.mark.embeddings
def test_real_local_embeddings_rank_paraphrases(policy):
    """Runs only where the optional stack + cached model exist (PYR_EMBEDDINGS=1)."""
    import os

    if os.environ.get("PYR_EMBEDDINGS") != "1":
        pytest.skip("Defina PYR_EMBEDDINGS=1 con sentence-transformers y el modelo local disponibles.")
    pytest.importorskip("sentence_transformers")
    be = SentenceTransformerBackend(policy["semantic"]["embedding_model"])
    q = "Quiero ayudar a reducir la basura del municipio."
    docs = ["Plan de gestión integral de residuos sólidos y reciclaje.", "Clubes de lengua extranjera para estudiantes de secundaria."]
    be.prepare([q] + docs)
    assert be.similarity(q, docs[0]) > be.similarity(q, docs[1])
