import json

import pytest
from conftest import TS

from pyr_matching import match_files
from pyr_matching.cli import main
from pyr_matching.fixtures import hand_rows, write_workbook
from pyr_matching.io_excel import MappingError, guard_mapping, load_mapping, read_bundle, read_output_table, write_result
from pyr_matching.pipeline import ValidationFailed, run_match
from pyr_matching.policy import Policy, PolicyError


def _run(tmp_path, policy, rows, name="x.xlsx"):
    return run_match(read_bundle([write_workbook(tmp_path / name, rows)], policy, load_mapping()), "2027A", policy, run_timestamp=TS)


def test_duplicate_enrollment_is_blocking(tmp_path, policy):
    rows = hand_rows()
    rows["Matriculas_SIGA"].append(["E10", "V01", "2027A", "Matriculado"])
    with pytest.raises(ValidationFailed) as e:
        _run(tmp_path, policy, rows)
    assert {i["code"] for i in e.value.issues} == {"MATRICULA_DUPLICADA"}


def test_duplicate_ids_and_bad_references_are_blocking(tmp_path, policy):
    rows = hand_rows()
    rows["Estudiantes"].append(list(rows["Estudiantes"][0]))
    rows["Plazas"][0][11] = "dos"  # capacity not an integer
    rows["Decisiones_Directas"].append(["E99", "2027A", "Caso especial", "Aprobado", None, "NO", None, None, None])
    with pytest.raises(ValidationFailed) as e:
        _run(tmp_path, policy, rows)
    assert {"ID_DUPLICADO", "CUPOS_INVALIDOS", "DECISION_SIN_ESTUDIANTE"} <= {i["code"] for i in e.value.issues}


def test_validation_messages_never_contain_free_text(tmp_path, policy):
    rows = hand_rows()
    rows["Estudiantes"].append(list(rows["Estudiantes"][0]))
    with pytest.raises(ValidationFailed) as e:
        _run(tmp_path, policy, rows)
    assert "software" not in json.dumps(e.value.issues)


def test_missing_required_column_is_reported(tmp_path, policy):
    from openpyxl import Workbook

    wb = Workbook(); ws = wb.active; ws.title = "Estudiantes"; ws.append(["ID_Estudiante", "Periodo"])
    wb.create_sheet("Plazas").append(["ID_Plaza"])
    wb.save(tmp_path / "bad.xlsx")
    with pytest.raises(MappingError, match="Programa"):
        read_bundle([tmp_path / "bad.xlsx"], policy, load_mapping())


def test_privacy_guard_rejects_sensitive_feature_mapping():
    m = load_mapping()
    m["entities"]["students"]["columns"]["expectations_text"] = ["JUSTIFICACIÓN CE"]
    with pytest.raises(MappingError):
        guard_mapping(m)
    m = load_mapping()
    m["entities"]["students"]["columns"]["origin_municipality"] = ["Sexo"]
    with pytest.raises(MappingError):
        guard_mapping(m)
    m = load_mapping()
    m["entities"]["students"]["columns"]["student_id"] = ["Número de Cédula"]
    assert any("CEDULA" in w for w in guard_mapping(m))


def test_unmapped_sensitive_columns_are_never_loaded_or_exported(tmp_path, policy):
    from openpyxl import load_workbook

    path = write_workbook(tmp_path / "s.xlsx", hand_rows())
    wb = load_workbook(path)
    ws = wb["Estudiantes"]
    ws.cell(row=1, column=ws.max_column + 1, value="Nombre de la EPS a la que se encuentra afiliado")
    ws.cell(row=2, column=ws.max_column, value="EPS-SECRETA-123")
    wb.save(path)
    out = tmp_path / "o.xlsx"
    res = match_files([path], "2027A", out, run_timestamp=TS)
    assert "EPS-SECRETA-123" not in json.dumps(res.to_json_dict(), default=str)
    wb = load_workbook(out, read_only=True)
    for sh in wb.worksheets:
        for row in sh.iter_rows(values_only=True):
            assert "EPS-SECRETA-123" not in [str(c) for c in row]


def test_excel_round_trip_types_and_layout(tmp_path, hand_result):
    from openpyxl import load_workbook

    out = write_result(hand_result, tmp_path / "out.xlsx")
    wb = load_workbook(out)
    assert wb.sheetnames[:4] == ["Asignaciones_Directas", "Recomendaciones_SIGA", "Plazas_Disponibles", "Sin_Asignacion"]
    for name in ("Resumen_Ejecucion", "Diccionario_Salida", "Pares_Evaluados", "Idoneidad_Por_Plaza", "Simulacion_No_Vinculante"):
        assert name in wb.sheetnames
    ws = wb["Recomendaciones_SIGA"]
    assert ws.freeze_panes == "A2" and ws.auto_filter.ref.startswith("A1:")
    recs = read_output_table(out, "Recomendaciones_SIGA")
    assert recs == hand_result.tables["Recomendaciones_SIGA"]
    assert isinstance(recs[0]["compatibilidad"], float) and isinstance(recs[0]["rango"], int)


def test_policy_validation():
    raw = Policy.load().raw
    with pytest.raises(PolicyError):
        Policy({**raw, "weights": {**raw["weights"], "program": 31}})
    with pytest.raises(PolicyError):
        Policy({**raw, "algorithm_version": "hybrid-v0.1"})
    with pytest.raises(PolicyError):
        Policy({**raw, "program_profile_rule": "maybe"})


def test_soft_program_rule_scores_instead_of_blocking(tmp_path):
    raw = Policy.load().raw
    soft = Policy({**raw, "program_profile_rule": "soft"})
    res = _run(tmp_path, soft, hand_rows())
    e11 = [r for r in res.tables["Recomendaciones_SIGA"] if r["id_estudiante"] == "E11"]
    assert e11 and all(r["tipo_resultado"] == "RECOMENDACION_NO_VINCULANTE" for r in e11)


def test_cli_end_to_end(tmp_path, capsys):
    src = write_workbook(tmp_path / "in.xlsx", hand_rows())
    assert main(["validate", "--inputs", str(src), "--period", "2027A"]) == 0
    assert main(["match", "--inputs", str(src), "--period", "2027A", "--out", str(tmp_path / "o.xlsx"),
                 "--json-out", str(tmp_path / "o.json"), "--timestamp", TS, "--simulate"]) == 0
    data = json.loads((tmp_path / "o.json").read_text(encoding="utf-8"))
    assert data["schema_version"] == "pyr-match-result/1.0" and "Recomendaciones_SIGA" in data["tables"]
    assert main(["validate", "--inputs", str(src), "--period", "1999A"]) == 2


def test_cli_reconcile(tmp_path):
    src = write_workbook(tmp_path / "in.xlsx", hand_rows())
    out = tmp_path / "o.xlsx"
    assert main(["match", "--inputs", str(src), "--period", "2027A", "--out", str(out), "--timestamp", TS]) == 0
    rows = hand_rows()
    siga = {"Matriculas_SIGA": [["E01", "V01", "2027A", "Matriculado"], ["E09", "V01", "2027A", "Matriculado"],
                                ["E04", "V02", "2027A", "Matriculado"], ["E03", "V03", "2027A", "Matriculado"]]}
    enr = write_workbook(tmp_path / "siga.xlsx", siga)
    rec_out = tmp_path / "rec.xlsx"
    assert main(["reconcile", "--inputs", str(src), "--period", "2027A", "--enrollments", str(enr),
                 "--previous-output", str(out), "--out", str(rec_out)]) == 0
    conc = {r["id_estudiante"]: r for r in read_output_table(rec_out, "Conciliacion_SIGA")}
    assert "SOBRECUPO_PLAZA" in conc["E01"]["alertas"] and "SOBRECUPO_PLAZA" in conc["E09"]["alertas"]
    assert "PROGRAMA_FUERA_DE_PERFIL" in conc["E04"]["alertas"]
    assert conc["E03"]["estado_conciliacion"] == "CONFIRMADA_SIGA" and conc["E03"]["rango_en_recomendaciones"] == 1
    del rows


def test_example_institutional_mapping_passes_privacy_guard():
    from pathlib import Path

    import pyr_matching

    m = load_mapping(Path(pyr_matching.__file__).parent / "config" / "mapping_tablero_2026b_EJEMPLO.json")
    assert guard_mapping(m) == []


def test_cli_train_without_labels_exits_3(tmp_path, capsys):
    src = write_workbook(tmp_path / "in.xlsx", hand_rows())
    assert main(["train", "--inputs", str(src), "--period", "2027A", "--labels", str(src), "--registry", str(tmp_path / "reg")]) == 3
    assert "NO_HAY_ETIQUETAS" in capsys.readouterr().out
