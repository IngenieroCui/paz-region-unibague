"""Hand-verifiable scenario (pyr_matching/fixtures.py::hand_rows). Expected values derived by hand in docs/DEMO.md."""
from collections import Counter

from conftest import TS, by_student

from pyr_matching.fixtures import hand_rows, write_workbook
from pyr_matching.io_excel import load_mapping, read_bundle
from pyr_matching.pipeline import run_match


def test_confirmed_direct_is_frozen_and_occupies_capacity(hand_result):
    d = by_student(hand_result.tables["Asignaciones_Directas"])
    assert d["E06"]["estado"] == "CONFIRMADA_FIJA" and d["E06"]["id_plaza"] == "V06" and d["E06"]["es_asignacion_real"] == "SI"
    p = {r["id_plaza"]: r for r in hand_result.tables["Plazas_Disponibles"]}
    assert p["V06"]["ocupados_directa_confirmada"] == 1 and p["V06"]["cupos_restantes"] == 0


def test_approved_direct_cases_get_proposals_that_respect_restrictions(hand_result):
    d = by_student(hand_result.tables["Asignaciones_Directas"])
    assert d["E04"]["estado"] == "PROPUESTA_REQUIERE_APROBACION" and d["E04"]["id_plaza"] == "V04"
    assert d["E04"]["municipio"] == "Líbano"  # approved municipality respected
    assert d["E05"]["id_plaza"] == "V05" and d["E05"]["modalidad"] == "SEMIPRESENCIAL"  # approved modality respected
    assert all(r["es_asignacion_real"] == "NO" for r in d.values() if r["estado"] != "CONFIRMADA_FIJA")


def test_infeasible_direct_returns_human_management_instead_of_violating(hand_result):
    u = by_student(hand_result.tables["Sin_Asignacion"])
    assert u["E07"]["estado"] == "REQUIERE_GESTION_HUMANA"
    assert u["E07"]["codigo_motivo"] == "SIN_PLAZA_COMPATIBLE_CON_RESTRICCIONES_APROBADAS"
    assert "MUNICIPIO_RESTRINGIDO" in u["E07"]["siguiente_paso"]


def test_capacity_exhaustion_between_direct_cases(hand_result):
    d = by_student(hand_result.tables["Asignaciones_Directas"])
    u = by_student(hand_result.tables["Sin_Asignacion"])
    assert d["E04"]["id_plaza"] == "V04" and "E14" not in d  # V04 capacity 1; E04 has stronger evidence
    assert u["E14"]["codigo_motivo"] == "CUPOS_AGOTADOS_ENTRE_DIRECTAS"


def test_call_winners_are_never_selected_by_similarity(hand_result):
    u = by_student(hand_result.tables["Sin_Asignacion"])
    assert u["E13"]["codigo_motivo"] == "CONVOCATORIA_SIN_PLAZA_SELECCIONADA"
    assert "E13" not in by_student(hand_result.tables["Asignaciones_Directas"])


def test_pending_and_missing_approval_are_not_auto_approved(hand_result):
    u = by_student(hand_result.tables["Sin_Asignacion"])
    assert u["E08"]["estado"] == u["E15"]["estado"] == "PENDIENTE_APROBACION_INSTITUCIONAL"
    assert u["E15"]["codigo_motivo"] == "ESTADO_APROBACION_DESCONOCIDO"
    recs = {r["id_estudiante"] for r in hand_result.tables["Recomendaciones_SIGA"]}
    assert not recs & {"E08", "E15", "E04", "E05", "E06", "E07", "E13", "E14"}


def test_rejected_direct_becomes_ordinary_elective(hand_result):
    recs = [r for r in hand_result.tables["Recomendaciones_SIGA"] if r["id_estudiante"] == "E09"]
    assert recs and all(r["tipo_resultado"] == "RECOMENDACION_NO_VINCULANTE" for r in recs)


def test_electives_are_only_recommendations_ranked_and_eligible(hand_result):
    recs = hand_result.tables["Recomendaciones_SIGA"]
    assert {r["tipo_resultado"] for r in recs} == {"RECOMENDACION_NO_VINCULANTE"}
    top1 = {r["id_estudiante"]: r["id_plaza"] for r in recs if r["rango"] == 1}
    assert top1 == {"E01": "V01", "E02": "V02", "E03": "V03", "E09": "V01", "E12": "V01"}
    # V01 (capacity 1) is recommended to two students: recommendations do not consume capacity.
    assert Counter(top1.values())["V01"] == 3
    # Only NORMAL, approved, available plazas reach SIGA recommendations.
    assert {r["id_plaza"] for r in recs} <= {"V01", "V02", "V03"}
    assert not any(r["id_plaza"] in ("V07", "V08", "V04", "V05", "V06") for r in recs)


def test_academic_program_incompatibility_blocks(hand_result):
    recs = hand_result.tables["Recomendaciones_SIGA"]
    assert all(r["id_plaza"] != "V02" for r in recs if r["id_estudiante"] in ("E01", "E03"))  # V02 is PSI-only
    assert {r["id_plaza"] for r in recs if r["id_estudiante"] == "E01"} == {"V01", "V03"}  # V03 via alternate profile
    alt = next(r for r in recs if r["id_estudiante"] == "E01" and r["id_plaza"] == "V03")
    exact = next(r for r in recs if r["id_estudiante"] == "E01" and r["id_plaza"] == "V01")
    assert alt["rango"] == 2 and exact["rango"] == 1


def test_no_valid_candidate_reported(hand_result):
    u = by_student(hand_result.tables["Sin_Asignacion"])
    assert u["E11"]["codigo_motivo"] == "SIN_OPCIONES_ELEGIBLES" and "PROGRAMA_NO_COMPATIBLE" in u["E11"]["detalle"]


def test_existing_siga_enrollment_is_locked_and_excluded(hand_result):
    p = {r["id_plaza"]: r for r in hand_result.tables["Plazas_Disponibles"]}
    assert p["V08"]["ocupados_siga_confirmada"] == 1 and p["V08"]["cupos_restantes"] == 0
    assert "E10" not in {r["id_estudiante"] for r in hand_result.tables["Recomendaciones_SIGA"]}
    assert "E10" not in by_student(hand_result.tables["Sin_Asignacion"])


def test_partial_feature_coverage_is_unknown_not_zero(hand_result):
    pairs = [r for r in hand_result.tables["Pares_Evaluados"] if r["id_estudiante"] == "E12"]
    assert pairs and all(r["c_semantic"] is None and r["c_lexical"] is None and r["c_skills"] is None for r in pairs)
    assert all(r["peso_efectivo_semantic"] == 0 for r in pairs)
    rec = next(r for r in hand_result.tables["Recomendaciones_SIGA"] if r["id_estudiante"] == "E12" and r["rango"] == 1)
    assert rec["confianza_evidencia"] == "BAJA" and "desconocido" in rec["explicacion"]


def test_reserved_capacity_and_simulation_never_exceed(hand_result):
    p = {r["id_plaza"]: r for r in hand_result.tables["Plazas_Disponibles"]}
    assert p["V04"]["reservados_directa_propuesta"] == 1 and p["V04"]["cupos_restantes"] == 0
    sim = hand_result.tables["Simulacion_No_Vinculante"]
    assert {r["tipo_resultado"] for r in sim} == {"SIMULACION_NO_VINCULANTE"}
    used = Counter(r["id_plaza"] for r in sim)
    assert all(used[v] <= p[v]["cupos_restantes"] for v in used)
    assert len({r["id_estudiante"] for r in sim}) == len(sim)
    assert hand_result.summary["violaciones_restricciones_duras"] == 0


def test_summary_traceability(hand_result):
    s = hand_result.summary
    assert s["version_algoritmo"] == "hybrid-pyr-v0.2" and s["politica_estado"] == "PROVISIONAL_NO_APROBADA_POR_UNIBAGUE"
    assert s["modelo_supervisado"].startswith("NINGUNO")
    assert "hand.xlsx=" in s["archivos_fuente_sha256"] and len(s["politica_huella"]) == 16
    assert s["directas_confirmadas"] == 1 and s["directas_propuestas"] == 2 and s["requieren_gestion_humana"] == 3 and s["pendientes_aprobacion"] == 2


def test_rerun_is_deterministic_and_order_independent(tmp_path, policy):
    rows = hand_rows()
    a = run_match(read_bundle([write_workbook(tmp_path / "a.xlsx", rows)], policy, load_mapping()), "2027A", policy, run_timestamp=TS, simulate_general_assignment=True)
    rev = {k: list(reversed(v)) for k, v in rows.items()}
    b = run_match(read_bundle([write_workbook(tmp_path / "b.xlsx", rev)], policy, load_mapping()), "2027A", policy, run_timestamp=TS, simulate_general_assignment=True)
    strip = lambda s: {k: v for k, v in s.items() if k not in ("duracion_ms", "archivos_fuente_sha256")}  # noqa: E731
    assert a.tables == b.tables and strip(a.summary) == strip(b.summary)


def test_deterministic_ties(tmp_path, policy):
    rows = hand_rows()
    # Two identical NORMAL plazas for the same program: ranking ties resolve by plaza ID.
    twin = list(rows["Plazas"][0]); twin[0] = "V00"
    rows["Plazas"].append(twin)
    res = run_match(read_bundle([write_workbook(tmp_path / "t.xlsx", rows)], policy, load_mapping()), "2027A", policy, run_timestamp=TS)
    e01 = [r for r in res.tables["Recomendaciones_SIGA"] if r["id_estudiante"] == "E01"]
    assert [r["id_plaza"] for r in e01[:2]] == ["V00", "V01"] and e01[0]["compatibilidad"] == e01[1]["compatibilidad"]
