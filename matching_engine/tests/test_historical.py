"""Phase 2: historical reconstruction – privacy, provenance, leakage and integrity. SYNTHETIC data only."""
import json
import zipfile
from pathlib import Path

import pytest

from pyr_matching.cli import main
from pyr_matching.historical import (FIELD_TIMING, HistoricalConfigError, Pseudonymizer, UnsafeOutputLocation, build_historical_dataset,
                                     load_dataset, to_input_bundle, write_dataset)
from pyr_matching.historical.builder import CONFIG_PATH, guard_config
from pyr_matching.historical.synthetic import SENTINELS, make_historical_sample
from pyr_matching.io_excel import load_mapping, read_bundle
from pyr_matching.pipeline import run_match
from pyr_matching.policy import POLICY_V03_PATH, Policy

KEY = b"clave-de-prueba-0123456789-no-real"


@pytest.fixture(scope="module")
def sample(tmp_path_factory):
    d = tmp_path_factory.mktemp("hist")
    m = make_historical_sample(d)
    manifest = json.loads(m.read_text(encoding="utf-8"))
    ds = build_historical_dataset(manifest, Pseudonymizer(KEY), base_dir=d)
    return d, manifest, ds


def _all_text(paths):
    out = []
    for p in paths:
        p = Path(p)
        if p.suffix == ".xlsx":
            with zipfile.ZipFile(p) as z:
                out += [z.read(n).decode("utf-8", "ignore") for n in z.namelist() if n.endswith(".xml")]
        else:
            out.append(p.read_text(encoding="utf-8"))
    return "\n".join(out)


def test_four_periods_and_all_logical_datasets(sample):
    _, _, ds = sample
    assert ds.periods() == ["2025A", "2025B", "2026A", "2026B"]
    assert ds.students and ds.placements and ds.allocations and ds.quality_feedback
    assert {a["mechanism"] for a in ds.allocations} >= {"SIGA", "DIRECTA_MUNICIPIO_ORIGEN", "DIRECTA_CONVOCATORIA"}
    assert all(r["fuente"] and "::" in r["fuente"] for r in ds.students + ds.placements + ds.allocations)


def test_sensitive_columns_and_raw_codes_never_reach_outputs(sample, tmp_path):
    d, _, ds = sample
    paths = write_dataset(ds, tmp_path / "out")
    blob = _all_text(paths.values())
    for s in SENTINELS:
        assert s not in blob, s
    raw_codes = {str(c) for c in range(2200000001, 2200000001 + 480)}
    assert not any(code in blob for code in list(raw_codes)[:200])
    assert all(r["student_id"].startswith("S") and len(r["student_id"]) == 17 for r in ds.students)


def test_pseudonyms_are_stable_and_key_dependent(sample):
    d, manifest, ds = sample
    again = build_historical_dataset(manifest, Pseudonymizer(KEY), base_dir=d)
    assert [s["student_id"] for s in again.students] == [s["student_id"] for s in ds.students]
    other = build_historical_dataset(manifest, Pseudonymizer(b"otra-clave-distinta-0123456789"), base_dir=d)
    assert not {s["student_id"] for s in other.students} & {s["student_id"] for s in ds.students}
    with pytest.raises(HistoricalConfigError):
        Pseudonymizer(b"corta")


def test_duplicate_preregistration_keeps_latest_answer(sample):
    _, _, ds = sample
    assert any(i["codigo"] == "PREINSCRIPCION_DUPLICADA" for i in ds.issues)
    assert any("(respuesta actualizada)" in (s["expectations_text"] or "") for s in ds.students)


def test_referential_and_historical_conflicts_reported_not_fixed(sample):
    _, _, ds = sample
    codes = {i["codigo"] for i in ds.issues}
    assert "ASIGNACION_HISTORICA_FUERA_DE_PERFIL" in codes and "ESTUDIANTE_SIN_PREINSCRIPCION" in codes
    assert any(a["program_relation"] == "none" for a in ds.allocations)  # kept, flagged


def test_capacity_is_never_invented(sample):
    d, manifest, _ = sample
    ds = build_historical_dataset({**manifest, "capacity_mode": "none"}, Pseudonymizer(KEY), base_dir=d)
    assert all(p["capacity"] is None and p["capacity_source"] == "NO_RECONSTRUIDA" for p in ds.placements)
    with pytest.raises(ValueError, match="sin cupo reconstruido"):
        to_input_bundle(ds, ["2026B"], require_capacity=True)
    ds2 = build_historical_dataset({**manifest, "capacity_mode": "approved_column"}, Pseudonymizer(KEY), base_dir=d)
    assert all(p["capacity_source"] == "COLUMNA_APROBADOS_NO_VERIFICADA" for p in ds2.placements)
    assert ds2.meta["capacity_status"] == "RECONSTRUIDA_NO_VERIFICADA_INSTITUCIONALMENTE"


def test_quality_feedback_is_post_decision_and_not_a_label(sample):
    _, _, ds = sample
    assert all(q["estado_validacion"] == "NO_VALIDADA_COMO_IDONEIDAD" and q["disponible_en"] == "POST_ASIGNACION" for q in ds.quality_feedback)
    assert {q["period"] for q in ds.quality_feedback} == {"2026A", "2026B"}


def test_prediction_inputs_contain_only_pre_decision_fields(sample):
    _, _, ds = sample
    assert FIELD_TIMING["allocations"] == "POST" and FIELD_TIMING["quality_feedback"] == "POST"
    b = to_input_bundle(ds, ["2026B"], require_capacity=True)
    assert not b.enrollments and not b.decisions and not b.labels  # observed outcomes never become inputs
    res = run_match(b, "2026B", Policy.load(POLICY_V03_PATH), run_timestamp="t")
    assert res.summary["violaciones_generadas_por_motor"] == 0
    assert res.summary["estudiantes_con_recomendacion"] > 0


def test_requirements_questionnaire_joined_for_call_placements(sample):
    _, _, ds = sample
    with_req = [p for p in ds.placements if p["requirements_text"]]
    assert with_req and all(p["period"] == "2026B" and p["vacancy_type"] == "CONVOCATORIA" for p in with_req)


def test_round_trip_and_coverage_report(sample, tmp_path):
    _, _, ds = sample
    paths = write_dataset(ds, tmp_path / "o")
    back = load_dataset(paths["json"])
    assert len(back.allocations) == len(ds.allocations)
    back_x = load_dataset(paths["xlsx"])
    assert len(back_x.students) == len(ds.students)
    md = paths["coverage_md"].read_text(encoding="utf-8")
    assert "NO_EXISTE_EN_FUENTE" in md and "skills_text" in md  # skills never collected historically


def test_config_guard_rejects_sensitive_sources():
    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    guard_config(cfg)
    bad = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    bad["kinds"]["tablero_estudiantes"]["columns"]["origin_municipality"] = ["JUSTIFICACIÓN CE"]
    with pytest.raises(HistoricalConfigError):
        guard_config(bad)
    bad = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    bad["kinds"]["tablero_estudiantes"]["columns"]["student_code"] = ["CC"]
    with pytest.raises(HistoricalConfigError):
        guard_config(bad)
    bad = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    bad["kinds"]["evaluacion_plazas"]["columns"]["advisor_total"] = ["Asesor  "]
    with pytest.raises(HistoricalConfigError):
        guard_config(bad)


def test_refuses_to_write_inside_git_checkout():
    repo_dir = Path(__file__).resolve().parents[1] / "historico_no_ignorado_test"
    with pytest.raises(UnsafeOutputLocation):
        write_dataset(build_historical_dataset({"sources": []}, Pseudonymizer(KEY)), repo_dir)
    assert not repo_dir.exists()


def test_cli_historical_build_and_engine_export(sample, tmp_path, monkeypatch, capsys):
    d, _, _ = sample
    monkeypatch.setenv("PYR_PSEUDONYM_KEY", KEY.decode())
    out = tmp_path / "hist_out"
    assert main(["historical-build", "--manifest", str(d / "manifest.json"), "--out-dir", str(out), "--export-engine-period", "2026B"]) == 0
    meta = json.loads(capsys.readouterr().out)["meta"]
    assert meta["periods"] == ["2025A", "2025B", "2026A", "2026B"]
    engine_in = out / "insumo_motor_2026B.xlsx"
    pol = Policy.load(POLICY_V03_PATH)
    res = run_match(read_bundle([engine_in], pol, load_mapping()), "2026B", pol, run_timestamp="t")
    assert res.summary["plazas_periodo"] == 45
    monkeypatch.delenv("PYR_PSEUDONYM_KEY")
    assert main(["historical-build", "--manifest", str(d / "manifest.json"), "--out-dir", str(tmp_path / "x")]) == 2
