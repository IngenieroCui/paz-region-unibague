"""Excel adapters: configurable header mapping -> canonical records; result -> auditable workbook.

Only mapped columns are read. A privacy guard refuses mappings that would feed identity, contact,
health, demographic or special-case-justification columns into compatibility features.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from .output_dictionary import OUTPUT_DICTIONARY
from .policy import Policy, canon, canon_modality
from .schema import DirectDecision, Enrollment, InputBundle, Label, Student, Vacancy

DEFAULT_MAPPING_PATH = Path(__file__).resolve().parent / "config" / "mapping_canonical.json"

# Canonical fields that act as compatibility features or are copied to outputs.
FEATURE_FIELDS = {
    "students": {"academic_program", "origin_municipality", "expectations_text", "learning_goals_text", "skills_text",
                 "interests_text", "desired_work_text", "modality_preference"},
    "vacancies": {"project_name", "project_description", "project_line", "organization_name", "municipality", "modality",
                  "program_profile", "program_profile_alt", "activities_text", "requirements_text", "org_needs_text"},
}
FORBIDDEN_TOKENS = ("CEDULA", "SEXO", "GENERO", "EPS", "NACIMIENTO", "CELULAR", "TELEFONO", "CORREO", "DIRECCION",
                    "JUSTIFICACION", "ACUDIENTE", "EMERGENCIA", "DISCAPACIDAD", "ETNIA", "ETNICO", "RELIGION", "ESTRATO",
                    "SALUD", "OBSERVACION", "MOTIVO", "RESPUESTA_CE", "HORARIO")
FORBIDDEN_STUDENT_TOKENS = FORBIDDEN_TOKENS + ("NOMBRE", "APELLIDO")


class MappingError(ValueError):
    pass


def sha256_file(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_mapping(path: str | Path | None = None) -> dict:
    return json.loads(Path(path or DEFAULT_MAPPING_PATH).read_text(encoding="utf-8"))


def guard_mapping(mapping: dict) -> list[str]:
    """Raise if a feature field maps to a forbidden source header. Returns non-blocking warnings."""
    warnings = []
    for entity, spec in mapping["entities"].items():
        for fld, headers in spec["columns"].items():
            for h in headers:
                c = canon(h) or ""
                if fld in FEATURE_FIELDS.get(entity, set()):
                    tokens = FORBIDDEN_STUDENT_TOKENS if entity == "students" else FORBIDDEN_TOKENS
                    bad = [t for t in tokens if t in c]
                    if bad:
                        raise MappingError(f"Mapeo rechazado: el campo de compatibilidad {entity}.{fld} apunta a la columna sensible/identificatoria '{h}'.")
                if fld == "student_id" and "CEDULA" in c:
                    warnings.append("ID_ES_CEDULA: se usa la cédula solo como llave de unión; se recomienda un identificador seudonimizado.")
    return warnings


def _cell_str(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = str(v).strip()
    return s or None


def _cell_int(v: Any) -> int:
    if isinstance(v, bool):
        return -1
    if isinstance(v, int):
        return v
    if isinstance(v, float) and v.is_integer():
        return int(v)
    s = _cell_str(v)
    if s and s.isdigit():
        return int(s)
    return -1  # surfaces as CUPOS_INVALIDOS in validation


def _cell_bool(v: Any, default: bool) -> bool:
    c = canon(v)
    if c is None:
        return default
    return c in ("SI", "S", "TRUE", "VERDADERO", "1", "X", "YES", "HABILITADO")


def _read_entity(workbooks: list[tuple[str, Any]], entity: str, spec: dict, header_row: int) -> tuple[list[dict], str | None]:
    names = {canon(n) for n in spec["sheet"]}
    for fname, wb in workbooks:
        for ws in wb.worksheets:
            if canon(ws.title) in names:
                rows = ws.iter_rows(min_row=header_row, values_only=True)
                header = next(rows, None) or ()
                index = {canon(h): i for i, h in enumerate(header) if canon(h)}
                cols: dict[str, int] = {}
                for fld, aliases in spec["columns"].items():
                    for a in aliases:
                        if canon(a) in index:
                            cols[fld] = index[canon(a)]
                            break
                missing = [f for f in spec.get("required", []) if f not in cols]
                if missing:
                    raise MappingError(f"Hoja '{ws.title}' ({fname}): faltan columnas obligatorias para {entity}: {', '.join(spec['columns'][m][0] for m in missing)}.")
                out = []
                for offset, r in enumerate(rows, start=header_row + 1):
                    if r is None or all(c is None or (isinstance(c, str) and not c.strip()) for c in r):
                        continue
                    rec = {f: (r[i] if i < len(r) else None) for f, i in cols.items()}
                    rec["_row"] = offset
                    out.append(rec)
                return out, ws.title
    if spec.get("optional_sheet"):
        return [], None
    raise MappingError(f"No se encontró la hoja obligatoria para {entity} (nombres aceptados: {', '.join(spec['sheet'])}).")


def read_bundle(paths: list[str | Path], policy: Policy, mapping: dict | None = None) -> InputBundle:
    mapping = mapping or load_mapping()
    bundle = InputBundle()
    bundle.load_warnings += guard_mapping(mapping)
    workbooks = []
    for p in paths:
        p = Path(p)
        bundle.source_files[p.name] = sha256_file(p)
        workbooks.append((p.name, load_workbook(p, read_only=True, data_only=True)))
    hr = mapping.get("header_row", 1)
    E = mapping["entities"]
    try:
        st_rows, _ = _read_entity(workbooks, "students", E["students"], hr)
        for r in st_rows:
            bundle.students.append(Student(
                student_id=_cell_str(r.get("student_id")) or f"<fila {r['_row']} sin ID>",
                period=_cell_str(r.get("period")) or "",
                academic_program=_cell_str(r.get("academic_program")),
                origin_municipality=_cell_str(r.get("origin_municipality")),
                eligible=_cell_bool(r.get("eligible"), True),
                expectations_text=_cell_str(r.get("expectations_text")),
                learning_goals_text=_cell_str(r.get("learning_goals_text")),
                skills_text=_cell_str(r.get("skills_text")),
                interests_text=_cell_str(r.get("interests_text")),
                desired_work_text=_cell_str(r.get("desired_work_text")),
                modality_preference=canon_modality(r.get("modality_preference")),
            ))
        vc_rows, _ = _read_entity(workbooks, "vacancies", E["vacancies"], hr)
        for r in vc_rows:
            bundle.vacancies.append(Vacancy(
                vacancy_id=_cell_str(r.get("vacancy_id")) or f"<fila {r['_row']} sin ID>",
                period=_cell_str(r.get("period")) or "",
                capacity=_cell_int(r.get("capacity")),
                status=policy.alias("status", r.get("status")),
                vacancy_type=policy.alias("vacancy_type", r.get("vacancy_type")),
                project_id=_cell_str(r.get("project_id")),
                project_name=_cell_str(r.get("project_name")),
                project_description=_cell_str(r.get("project_description")),
                project_line=_cell_str(r.get("project_line")),
                organization_id=_cell_str(r.get("organization_id")),
                organization_name=_cell_str(r.get("organization_name")),
                department=_cell_str(r.get("department")),
                municipality=_cell_str(r.get("municipality")),
                modality=canon_modality(r.get("modality")),
                program_profile=_cell_str(r.get("program_profile")),
                program_profile_alt=_cell_str(r.get("program_profile_alt")),
                activities_text=_cell_str(r.get("activities_text")),
                requirements_text=_cell_str(r.get("requirements_text")),
                org_needs_text=_cell_str(r.get("org_needs_text")),
                call_code=_cell_str(r.get("call_code")),
            ))
        dec_rows, _ = _read_entity(workbooks, "decisions", E["decisions"], hr)
        for r in dec_rows:
            mods = tuple(sorted({m for m in (canon_modality(x) for x in str(r.get("approved_modalities") or "").replace(";", ",").split(",")) if m}))
            bundle.decisions.append(DirectDecision(
                student_id=_cell_str(r.get("student_id")) or "",
                period=_cell_str(r.get("period")) or "",
                direct_type=policy.alias("direct_type", r.get("direct_type")),
                approval_status=policy.alias("approval_status", r.get("approval_status")),
                confirmed_vacancy_id=_cell_str(r.get("confirmed_vacancy_id")),
                placement_confirmed=_cell_bool(r.get("placement_confirmed"), False),
                approved_municipality=_cell_str(r.get("approved_municipality")),
                approved_modalities=mods,
                call_code=_cell_str(r.get("call_code")),
                row=r["_row"],
            ))
        en_rows, _ = _read_entity(workbooks, "enrollments", E["enrollments"], hr)
        for r in en_rows:
            bundle.enrollments.append(Enrollment(
                student_id=_cell_str(r.get("student_id")) or "",
                vacancy_id=_cell_str(r.get("vacancy_id")) or "",
                period=_cell_str(r.get("period")) or "",
                status=canon(r.get("status")) or "MATRICULADO",
                row=r["_row"],
            ))
        lb_rows, _ = _read_entity(workbooks, "labels", E["labels"], hr)
        for r in lb_rows:
            try:
                value = float(r.get("value"))
            except (TypeError, ValueError):
                bundle.load_warnings.append(f"ETIQUETA_NO_NUMERICA: fila {r['_row']} ignorada.")
                continue
            bundle.labels.append(Label(_cell_str(r.get("student_id")) or "", _cell_str(r.get("vacancy_id")) or "",
                                       _cell_str(r.get("period")) or "", value, canon(r.get("source"))))
    finally:
        for _, wb in workbooks:
            wb.close()
    return bundle


# ------------------------------------------------------------------------------------------------
# Writer
# ------------------------------------------------------------------------------------------------

HEADER_FILL = PatternFill("solid", fgColor="1F4E78")
HEADER_FONT = Font(bold=True, color="FFFFFF")


def _write_table(ws, rows: list[dict], columns: list[str] | None = None):
    columns = columns or (list(rows[0].keys()) if rows else ["sin_registros"])
    ws.append(columns)
    for r in rows:
        ws.append([r.get(c) for c in columns])
    for i, c in enumerate(columns, start=1):
        cell = ws.cell(row=1, column=i)
        cell.fill, cell.font = HEADER_FILL, HEADER_FONT
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        width = max([len(str(c))] + [len(str(r.get(c) or "")) for r in rows[:200]])
        ws.column_dimensions[get_column_letter(i)].width = min(60, max(10, width + 2))
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(columns))}{max(1, len(rows) + 1)}"


TABLE_COLUMNS = {
    "Asignaciones_Directas": ["id_estudiante", "id_plaza", "id_proyecto", "proyecto", "organizacion", "municipio", "modalidad", "tipo_plaza",
                              "perfil_programa", "tipo_directa", "estado", "es_asignacion_real", "compatibilidad", "cobertura_evidencia",
                              "confianza_evidencia", "verificacion_reglas", "excede_cupos", "explicacion"],
    "Recomendaciones_SIGA": ["id_estudiante", "rango", "id_plaza", "id_proyecto", "proyecto", "organizacion", "municipio", "modalidad", "tipo_plaza",
                             "perfil_programa", "cupos_restantes_al_ejecutar", "compatibilidad", "sobre_umbral", "cobertura_evidencia",
                             "confianza_evidencia", "tipo_resultado", "explicacion"],
    "Sin_Asignacion": ["id_estudiante", "flujo", "estado", "codigo_motivo", "detalle", "siguiente_paso"],
}


def write_result(result, path: str | Path) -> Path:
    path = Path(path)
    wb = Workbook()
    wb.remove(wb.active)
    order = ["Asignaciones_Directas", "Recomendaciones_SIGA", "Plazas_Disponibles", "Sin_Asignacion", "Idoneidad_Por_Plaza",
             "Simulacion_No_Vinculante", "Pares_Evaluados"]
    for name in order:
        if name in result.tables:
            _write_table(wb.create_sheet(name), result.tables[name], TABLE_COLUMNS.get(name))
    for name in sorted(set(result.tables) - set(order)):
        _write_table(wb.create_sheet(name[:31]), result.tables[name])
    summary_rows = [{"clave": k, "valor": v} for k, v in result.summary.items()]
    summary_rows += [{"clave": f"advertencia_{i + 1}", "valor": w} for i, w in enumerate(result.warnings)]
    _write_table(wb.create_sheet("Resumen_Ejecucion"), summary_rows, ["clave", "valor"])
    _write_table(wb.create_sheet("Diccionario_Salida"), OUTPUT_DICTIONARY, ["hoja", "columna", "significado", "valores_permitidos", "naturaleza"])
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
    return path


def read_output_table(path: str | Path, sheet: str) -> list[dict]:
    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        rows = list(wb[sheet].iter_rows(values_only=True))
    finally:
        wb.close()
    if not rows:
        return []
    header = rows[0]
    return [dict(zip(header, r)) for r in rows[1:]]
