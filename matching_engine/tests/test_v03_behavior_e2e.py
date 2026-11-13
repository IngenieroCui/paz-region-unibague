"""Phase 3: hybrid-pyr-v0.3 scoring, Track A behaviour model isolation, end-to-end synthetic Excel run."""
import json
import os

import pytest

from pyr_matching.behavior import BehaviorModel, NotEnoughHistory, train_behavior
from pyr_matching.cli import main
from pyr_matching.fixtures import hand_rows, write_workbook
from pyr_matching.historical import Pseudonymizer, build_historical_dataset, to_input_bundle, write_dataset
from pyr_matching.historical.synthetic import make_historical_sample
from pyr_matching.io_excel import load_mapping, read_bundle, read_output_table
from pyr_matching.pipeline import run_match
from pyr_matching.policy import POLICY_V03_PATH, Policy
from pyr_matching.schema import Student, Vacancy
from pyr_matching.scoring import score_pair
from pyr_matching.semantic import TfidfBackend
from pyr_matching.training import LogisticModel, Registry

KEY = b"clave-de-prueba-0123456789-no-real"


@pytest.fixture(scope="module")
def v03():
    return Policy.load(POLICY_V03_PATH)


@pytest.fixture(scope="module")
def hist(tmp_path_factory):
    d = tmp_path_factory.mktemp("h03")
    m = make_historical_sample(d)
    return build_historical_dataset(json.loads(m.read_text(encoding="utf-8")), Pseudonymizer(KEY), base_dir=d)


def test_v03_policy_weights_are_provisional_and_historical_off(v03):
    assert v03["policy_status"] == "PROVISIONAL_NO_APROBADA_POR_UNIBAGUE" and v03.weights["historical"] == 0
    assert abs(sum(v03.weights.values()) - 100) < 1e-9


def test_v03_field_aware_components_and_missing_data(v03):
    be = TfidfBackend()
    s = Student("S1", "2027A", "Psicología", "Ibagué", expectations_text="acompañamiento psicosocial a familias",
                skills_text="entrevista clínica y primeros auxilios psicológicos")
    v = Vacancy("V1", "2027A", 1, "APROBADA", "NORMAL", project_description="acompañamiento psicosocial de familias víctimas",
                municipality="Ibagué", program_profile="Psicología", requirements_text="primeros auxilios psicológicos")
    be.prepare([s.aspiration_text(), s.capability_text(), v.project_text(), v.requirement_text()])
    ps = score_pair(s, v, v03, be, [])
    assert ps.raw["requirements"] is not None and ps.raw["semantic"] > 0 and ps.raw["interests"] is None
    assert "interests" in ps.missing and ps.effective["interests"] == 0 and ps.effective["historical"] == 0
    assert "intereses" in ps.explanation  # missing evidence is explained, not penalised


def test_semantic_similarity_never_overrides_hard_constraints(v03, tmp_path):
    rows = hand_rows()
    # E03 (Contaduría) writes text that is identical to the PSI-only plaza V02 description
    rows["Estudiantes"][2][5] = rows["Plazas"][1][4]
    res = run_match(read_bundle([write_workbook(tmp_path / "e2e.xlsx", rows)], v03, load_mapping()), "2027A", v03, run_timestamp="t")
    assert all(r["id_plaza"] != "V02" for r in res.tables["Recomendaciones_SIGA"] if r["id_estudiante"] == "E03")


def test_behavior_model_trains_on_past_and_tests_on_future_only(hist, v03, tmp_path):
    art = train_behavior(hist, v03, tmp_path / "beh")
    rep = art["report"]
    assert rep["periodo_prueba"] == "2026B" and "2026B" not in rep["periodos_entrenamiento"]
    assert art["status"] == "EXPERIMENTAL" and art["is_suitability_model"] is False and art["limitations"]
    assert set(rep["mecanismos_usados"]) == {"SIGA"}  # direct placements are not "choices"
    assert art["metrics"]["modelo_prueba"]["situaciones"] > 0
    path = tmp_path / "beh" / art["model_id"] / "model.json"
    with pytest.raises(ValueError, match="OTRA_PISTA"):
        LogisticModel.load(path)  # can never act as a suitability re-ranker
    reg = Registry(tmp_path / "beh", track="behavior")
    assert any("NO_ACTIVABLE" in p for p in reg.activation_problems(art["model_id"], v03))


def test_behavior_signal_only_used_when_policy_weights_it(hist, v03, tmp_path):
    art = train_behavior(hist, v03, tmp_path / "beh2")
    bm = BehaviorModel.load(tmp_path / "beh2" / art["model_id"] / "model.json", v03)
    b = to_input_bundle(hist, ["2026B"], require_capacity=True)
    off = run_match(b, "2026B", v03, behavior_model=bm, run_timestamp="t", pairs_detail="all")
    assert all(r["c_historical"] is None for r in off.tables["Pares_Evaluados"])
    w = dict(v03.weights, historical=10, semantic=20)
    on_pol = Policy({**v03.raw, "weights": w})
    bm.algorithm_base = on_pol["algorithm_version"]
    on = run_match(b, "2026B", on_pol, behavior_model=bm, run_timestamp="t", pairs_detail="all")
    assert any(r["c_historical"] is not None for r in on.tables["Pares_Evaluados"])
    assert "EXPERIMENTAL" in on.summary["modelo_comportamiento_historico"]
    assert on.summary["violaciones_generadas_por_motor"] == 0
    with pytest.raises(ValueError, match="MODELO_NO_ES_DE_IDONEIDAD"):
        run_match(b, "2026B", v03, model=bm, run_timestamp="t")


def test_behavior_refuses_insufficient_history(hist, v03):
    with pytest.raises(NotEnoughHistory):
        train_behavior(hist, v03, None, test_period="2025B")


def test_end_to_end_synthetic_excel_v03(tmp_path, v03, capsys):
    """Historical sample -> canonical dataset -> behaviour model -> engine Excel run -> Excel outputs."""
    d = tmp_path / "src"
    m = make_historical_sample(d)
    os.environ["PYR_PSEUDONYM_KEY"] = KEY.decode()
    try:
        assert main(["historical-build", "--manifest", str(m), "--out-dir", str(tmp_path / "hist"), "--export-engine-period", "2026B"]) == 0
    finally:
        del os.environ["PYR_PSEUDONYM_KEY"]
    capsys.readouterr()
    assert main(["train-behavior", "--dataset", str(tmp_path / "hist" / "historico_canonico.json"), "--registry", str(tmp_path / "beh")]) == 0
    capsys.readouterr()
    out = tmp_path / "res.xlsx"
    assert main(["match", "--inputs", str(tmp_path / "hist" / "insumo_motor_2026B.xlsx"), "--period", "2026B", "--out", str(out),
                 "--policy", str(POLICY_V03_PATH), "--simulate", "--timestamp", "t", "--json-out", str(tmp_path / "res.json")]) == 0
    resumen = {r["clave"]: r["valor"] for r in read_output_table(out, "Resumen_Ejecucion")}
    assert resumen["version_algoritmo"] == "hybrid-pyr-v0.3" and resumen["violaciones_generadas_por_motor"] == 0
    assert "no aprendidos" in resumen["componentes_entrenados"]
    recs = read_output_table(out, "Recomendaciones_SIGA")
    assert recs and {r["tipo_resultado"] for r in recs} == {"RECOMENDACION_NO_VINCULANTE"}


@pytest.mark.embeddings
def test_v03_with_real_local_embeddings(hist, v03):
    if os.environ.get("PYR_EMBEDDINGS") != "1":
        pytest.skip("Defina PYR_EMBEDDINGS=1 con sentence-transformers y el modelo local disponibles.")
    pytest.importorskip("sentence_transformers")
    b = to_input_bundle(hist, ["2026B"], require_capacity=True)
    res = run_match(b, "2026B", v03, semantic_override="sentence-transformers", run_timestamp="t")
    assert res.summary["backend_semantico"] == "sentence-transformers"
    assert not any(w.startswith("SEMANTIC_BACKEND_UNAVAILABLE") for w in res.warnings)
    assert res.summary["violaciones_generadas_por_motor"] == 0
