"""Phases 4-5: temporal evaluation, expert-feedback loop, retraining safeguards, JSON integration. SYNTHETIC data only."""
import json

import pytest
from openpyxl import load_workbook

from pyr_matching.api import REQUEST_SCHEMA_VERSION, allowed_fields, match_request
from pyr_matching.cli import main
from pyr_matching.evaluation import DISCLAIMER, evaluate_historical, write_evaluation
from pyr_matching.feedback import FeedbackError, import_feedback, load_feedback_labels, make_review_workbook
from pyr_matching.fixtures import hand_rows, random_rows, write_workbook
from pyr_matching.historical import Pseudonymizer, build_historical_dataset
from pyr_matching.historical.synthetic import make_historical_sample
from pyr_matching.io_excel import load_mapping, read_bundle
from pyr_matching.pipeline import run_match
from pyr_matching.policy import POLICY_V03_PATH, Policy
from pyr_matching.retrain import retrain
from pyr_matching.training import Registry

KEY = b"clave-de-prueba-0123456789-no-real"


@pytest.fixture(scope="module")
def hist(tmp_path_factory):
    d = tmp_path_factory.mktemp("ev")
    m = make_historical_sample(d)
    manifest = json.loads(m.read_text(encoding="utf-8"))
    return d, manifest, build_historical_dataset(manifest, Pseudonymizer(KEY), base_dir=d)


# ------------------------------------------------------------------------------- Phase 4


def test_temporal_evaluation_structure_and_honesty(hist, tmp_path):
    _, _, ds = hist
    r = evaluate_historical(ds)
    assert r["periodo_prueba"] == "2026B" and r["periodos_desarrollo"] == ["2025A", "2025B", "2026A"]
    assert r["descargo"] == DISCLAIMER and "no idoneidad" in DISCLAIMER
    comp = r["comparacion"]
    for name in ("solo_programa", "hybrid-pyr-v0.2", "tfidf_semantico", "hybrid-pyr-v0.3_tfidf", "comportamiento_historico"):
        assert comp[name]["situaciones"] > 0 and 0 <= comp[name]["mrr"] <= 1
    assert comp["idoneidad_supervisada"]["estado"] == "NO_EVALUABLE"
    assert comp["embeddings_semantico"]["estado"] == "NO_EJECUTADO"
    assert "2026B" not in comp["comportamiento_historico"]["periodos_entrenamiento"]
    assert r["simulacion_retrospectiva"]["violaciones_generadas_por_motor"] == 0
    assert r["cobertura"]["cobertura_candidatos"] is not None and r["subgrupos_programa"]
    paths = write_evaluation(r, tmp_path / "ev")
    md = paths["md"].read_text(encoding="utf-8")
    assert "no idoneidad" in md and "Calidad real" in md
    assert "Comparacion_Modelos" in load_workbook(paths["xlsx"]).sheetnames


def test_evaluation_without_capacity_does_not_invent_seats(hist):
    d, manifest, _ = hist
    ds = build_historical_dataset({**manifest, "capacity_mode": "none"}, Pseudonymizer(KEY), base_dir=d)
    r = evaluate_historical(ds)
    assert r["directas"]["estado"] == "NO_EVALUABLE" and r["simulacion_retrospectiva"]["estado"] == "NO_EVALUABLE"
    assert r["comparacion"]["hybrid-pyr-v0.3_tfidf"]["situaciones"] > 0  # ranking still evaluable


def test_cli_evaluate_historical(hist, tmp_path, monkeypatch, capsys):
    d, _, _ = hist
    monkeypatch.setenv("PYR_PSEUDONYM_KEY", KEY.decode())
    assert main(["historical-build", "--manifest", str(d / "manifest.json"), "--out-dir", str(tmp_path / "h")]) == 0
    capsys.readouterr()
    assert main(["evaluate-historical", "--dataset", str(tmp_path / "h" / "historico_canonico.json"), "--out-dir", str(tmp_path / "e")]) == 0
    assert (tmp_path / "e" / "evaluacion_historica.xlsx").exists() and (tmp_path / "e" / "evaluacion_historica.md").exists()


# ------------------------------------------------------------------------------- Phase 5 feedback


def _fill(path, rule, tamper_first=False, unapproved_every=0, same_approver_every=0):
    wb = load_workbook(path)
    ws = wb["Revision_Pares"]
    h = {c.value: i for i, c in enumerate(ws[1])}
    for n, row in enumerate(ws.iter_rows(min_row=2), start=1):
        good = rule(row[h["programa_estudiante"]].value, row[h["perfil_programa"]].value, row[h["proyecto"]].value, n)
        row[h["evaluacion_idoneidad"]].value = "4 - Alta" if good else "2 - Baja"
        row[h["id_revisor"]].value = "REV-01"
        row[h["fecha_revision"]].value = "2027-01-15"
        row[h["comentario_revisor"]].value = "comentario libre que nunca se usa"
        row[h["estado_aprobacion"]].value = "PENDIENTE" if unapproved_every and n % unapproved_every == 0 else "APROBADA"
        row[h["aprobado_por"]].value = "REV-01" if same_approver_every and n % same_approver_every == 0 else "COORD-PYR"
        if tamper_first and n == 1:
            row[h["id_plaza"]].value = "OTRA-PLAZA"
    wb.save(path)


@pytest.fixture
def two_period_reviews(tmp_path):
    pol = Policy.load()
    a = random_rows(150, 50, seed=4, period="2026A")
    b = random_rows(150, 50, seed=5, period="2026B")
    bundle = read_bundle([write_workbook(tmp_path / "in.xlsx", {k: a[k] + b[k] for k in a})], pol, load_mapping())
    files = []
    for per in ("2026A", "2026B"):
        res = run_match(bundle, per, pol, pairs_detail="all", run_timestamp="t-" + per)
        f = make_review_workbook(res, bundle, per, tmp_path / f"rev_{per}.xlsx", pol, per_student=3)
        rng_rule = lambda prog, perfil, proj, n: (prog == perfil and n % 3 != 0)  # noqa: E731  synthetic reviewer behaviour
        _fill(f, rng_rule, tamper_first=(per == "2026A"), unapproved_every=11, same_approver_every=13)
        files.append(f)
    return bundle, pol, files


def test_review_workbook_contents_and_blind_mode(tmp_path, hand_bundle, hand_result, policy):
    p = make_review_workbook(hand_result, hand_bundle, "2027A", tmp_path / "r.xlsx", policy)
    wb = load_workbook(p)
    ws = wb["Revision_Pares"]
    header = [c.value for c in ws[1]]
    for col in ("id_estudiante", "id_plaza", "perfil_programa", "compatibilidad", "componentes", "estado_restricciones", "cobertura_evidencia",
                "explicacion", "evaluacion_idoneidad", "comentario_revisor", "fuente_etiqueta", "estado_aprobacion"):
        assert col in header
    assert ws.data_validations.dataValidation  # dropdowns
    blind = load_workbook(make_review_workbook(hand_result, hand_bundle, "2027A", tmp_path / "b.xlsx", policy, blind=True))["Revision_Pares"]
    bh = [c.value for c in blind[1]]
    assert all(r[bh.index("compatibilidad")].value is None and r[bh.index("explicacion")].value is None for r in blind.iter_rows(min_row=2))


def test_import_validates_and_versions(two_period_reviews, tmp_path):
    _, _, files = two_period_reviews
    rep = import_feedback(files, tmp_path / "store")
    rj = rep["rechazos"]
    assert any(k.startswith("HUELLA_NO_COINCIDE") for k in rj) and any(k.startswith("NO_APROBADA") for k in rj)
    assert rj.get("APROBADOR_IGUAL_A_REVISOR")
    assert rep["comentarios_no_almacenados"] > 0 and rep["version"] == 1
    stored = json.loads(open(rep["file"], encoding="utf-8").read())
    assert "comentario" not in json.dumps(stored["labels"])
    labels, prov = load_feedback_labels(tmp_path / "store")
    assert labels and all(l.source == "REVISION_EXPERTA_PAR" for l in labels) and prov["versions"][0]["version"] == 1
    assert import_feedback(files[:1], tmp_path / "store")["version"] == 2


def test_tampered_store_is_detected(two_period_reviews, tmp_path):
    _, _, files = two_period_reviews
    rep = import_feedback(files, tmp_path / "store")
    data = json.loads(open(rep["file"], encoding="utf-8").read())
    data["labels"][0]["value"] = 1.0 - data["labels"][0]["value"]
    open(rep["file"], "w", encoding="utf-8").write(json.dumps(data))
    with pytest.raises(FeedbackError, match="alterada"):
        load_feedback_labels(tmp_path / "store")


def test_retrain_registers_candidate_without_activation(two_period_reviews, tmp_path):
    bundle, pol, files = two_period_reviews
    import_feedback(files, tmp_path / "store")
    rep = retrain(bundle, pol, tmp_path / "store", tmp_path / "reg")
    assert rep["estado"] in ("PROMOVIBLE", "RECHAZADO_NO_SUPERA_LINEA_BASE", "RECHAZADO_DEGRADA_SUBGRUPO", "RECHAZADO_PRUEBA_INSUFICIENTE")
    assert rep["activado"] is False and Registry(tmp_path / "reg").index()["active"] is None
    art = Registry(tmp_path / "reg").artifact(rep["model_id"])
    assert art["label_provenance"]["versions"][0]["version"] == 1 and art["leakage_audit"]["periodo_prueba"] == "2026B"


def test_retrain_with_no_feedback_is_not_trainable(tmp_path, hand_bundle, policy):
    rep = retrain(hand_bundle, policy, tmp_path / "vacio", tmp_path / "reg")
    assert rep["estado"] == "NO_ENTRENABLE" and not (tmp_path / "reg").exists()


def test_cli_feedback_loop(tmp_path, capsys):
    src = write_workbook(tmp_path / "in.xlsx", hand_rows())
    out = tmp_path / "rev.xlsx"
    assert main(["feedback-template", "--inputs", str(src), "--period", "2027A", "--out", str(out), "--blind", "--timestamp", "t"]) == 0
    _fill(out, lambda *a: True)
    assert main(["feedback-import", "--files", str(out), "--store", str(tmp_path / "st")]) == 0
    capsys.readouterr()
    assert main(["retrain", "--inputs", str(src), "--period", "2027A", "--feedback-store", str(tmp_path / "st"), "--registry", str(tmp_path / "rg")]) == 3
    assert "POCAS_ETIQUETAS" in capsys.readouterr().out


# ------------------------------------------------------------------------------- integration API


def _request_from_hand():
    rows = hand_rows()
    st = [{"student_id": r[0], "academic_program": r[2], "origin_municipality": r[3], "expectations_text": r[5], "learning_goals_text": r[6]}
          for r in rows["Estudiantes"]]
    vc = [{"vacancy_id": r[0], "project_id": r[2], "project_name": r[3], "project_description": r[4], "project_line": r[5], "organization_id": r[6],
           "organization_name": r[7], "department": r[8], "municipality": r[9], "modality": r[10], "capacity": r[11], "status": r[12],
           "vacancy_type": r[13], "program_profile": r[14], "program_profile_alt": r[15]} for r in rows["Plazas"]]
    dc = [{"student_id": r[0], "direct_type": r[2], "approval_status": r[3], "confirmed_vacancy_id": r[4], "placement_confirmed": r[5] == "SI",
           "approved_municipality": r[6], "approved_modalities": [r[7]] if r[7] else []} for r in rows["Decisiones_Directas"]]
    en = [{"student_id": r[0], "vacancy_id": r[1], "status": r[3]} for r in rows["Matriculas_SIGA"]]
    return {"schema_version": REQUEST_SCHEMA_VERSION, "period": "2027A", "options": {"timestamp": "t", "simulate": True},
            "students": st, "vacancies": vc, "decisions": dc, "enrollments": en}


def test_json_api_matches_excel_path(hand_bundle, policy):
    res = match_request(_request_from_hand())
    assert res["status"] == "OK" and res["schema_version"] == "pyr-match-result/1.0"
    excel = run_match(hand_bundle, "2027A", policy, run_timestamp="t", simulate_general_assignment=True)
    for t in ("Asignaciones_Directas", "Recomendaciones_SIGA", "Sin_Asignacion", "Simulacion_No_Vinculante"):
        key = lambda r: (r["id_estudiante"], r.get("id_plaza"), r.get("rango"), r.get("compatibilidad"), r.get("estado"))  # noqa: E731
        assert sorted(map(key, res["tables"][t])) == sorted(map(key, excel.tables[t])), t
    v03 = match_request({**_request_from_hand(), "policy": "v0.3"})
    assert v03["summary"]["version_algoritmo"] == "hybrid-pyr-v0.3"


def test_json_api_rejects_unknown_or_sensitive_fields_and_reports_validation():
    req = _request_from_hand()
    req["students"][0]["nombre"] = "no permitido"
    res = match_request(req)
    assert res["status"] == "REQUEST_ERROR" and res["issues"][0]["fields"] == ["nombre"]
    assert "nombre" not in allowed_fields("students") and "source" not in allowed_fields("students")
    req = _request_from_hand()
    req["students"].append(dict(req["students"][0]))
    assert match_request(req)["status"] == "VALIDATION_ERROR"
    assert match_request({"schema_version": "x"})["status"] == "REQUEST_ERROR"


def test_cli_match_json(tmp_path):
    (tmp_path / "req.json").write_text(json.dumps(_request_from_hand(), ensure_ascii=False), encoding="utf-8")
    assert main(["match-json", "--request", str(tmp_path / "req.json"), "--out", str(tmp_path / "res.json")]) == 0
    assert json.loads((tmp_path / "res.json").read_text(encoding="utf-8"))["status"] == "OK"
