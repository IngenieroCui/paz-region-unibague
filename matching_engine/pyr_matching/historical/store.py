"""Persist / reload the canonical historical dataset and convert it to engine inputs.

Writes are refused inside a git working tree unless the target is ignored by git, so institutional
(pseudonymised but still personal) data cannot be committed by accident.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from openpyxl import Workbook, load_workbook

from ..io_excel import _write_table
from ..schema import InputBundle, Student, Vacancy
from .builder import FIELD_TIMING, HistoricalDataset

SHEETS = {
    "students": "ESTUDIANTES_PRE_ASIGNACION",
    "placements": "PLAZAS_PRE_ASIGNACION",
    "allocations": "ASIGNACIONES_OBSERVADAS",
    "quality_feedback": "RETROALIMENTACION_CALIDAD",
    "coverage": "COBERTURA_CAMPOS",
    "issues": "PROBLEMAS_CALIDAD_DATOS",
    "provenance": "PROCEDENCIA",
}


class UnsafeOutputLocation(RuntimeError):
    pass


def assert_safe_output_dir(path: str | Path, allow_inside_repo: bool = False) -> Path:
    """Refuse to write institutional derivatives inside a git checkout unless git ignores the path."""
    p = Path(path).resolve()
    probe = p
    while not probe.exists():
        probe = probe.parent
    for parent in [probe, *probe.parents]:
        if (parent / ".git").exists():
            if allow_inside_repo:
                return p
            try:
                ignored = subprocess.run(["git", "-C", str(parent), "check-ignore", "-q", str(p)], capture_output=True).returncode == 0
            except OSError:
                ignored = False
            if not ignored:
                raise UnsafeOutputLocation(f"Destino dentro del repositorio git ({parent}) y no ignorado: use una carpeta institucional fuera de git.")
            return p
    return p


def write_dataset(ds: HistoricalDataset, out_dir: str | Path, allow_inside_repo: bool = False) -> dict[str, Path]:
    out = assert_safe_output_dir(out_dir, allow_inside_repo)
    out.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    wb.remove(wb.active)
    for attr, sheet in SHEETS.items():
        _write_table(wb.create_sheet(sheet), getattr(ds, attr))
    meta_rows = [{"clave": k, "valor": json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v} for k, v in ds.meta.items()]
    _write_table(wb.create_sheet("RESUMEN"), meta_rows, ["clave", "valor"])
    xlsx = out / "historico_canonico.xlsx"
    wb.save(xlsx)
    js = out / "historico_canonico.json"
    js.write_text(json.dumps({"meta": ds.meta, **{a: getattr(ds, a) for a in SHEETS}}, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    cov = out / "reporte_cobertura.md"
    cov.write_text(coverage_markdown(ds), encoding="utf-8")
    return {"xlsx": xlsx, "json": js, "coverage_md": cov}


def load_dataset(path: str | Path) -> HistoricalDataset:
    p = Path(path)
    if p.suffix.lower() == ".json":
        data = json.loads(p.read_text(encoding="utf-8"))
        return HistoricalDataset(**{a: data.get(a, []) for a in SHEETS}, meta=data.get("meta", {}))
    wb = load_workbook(p, read_only=True, data_only=True)
    try:
        ds = HistoricalDataset()
        for attr, sheet in SHEETS.items():
            rows = list(wb[sheet].iter_rows(values_only=True)) if sheet in wb.sheetnames else []
            if rows and rows[0] != ("sin_registros",):
                setattr(ds, attr, [dict(zip(rows[0], r)) for r in rows[1:]])
        return ds
    finally:
        wb.close()


def coverage_markdown(ds: HistoricalDataset) -> str:
    from .builder import mechanism_summary

    lines = ["# Reporte de cobertura del histórico canónico", "",
             f"- Esquema: `{ds.meta.get('dataset_schema')}` · Periodos: {', '.join(ds.meta.get('periods', []))}",
             f"- Cupos: **{ds.meta.get('capacity_status')}** (modo `{ds.meta.get('capacity_mode')}`)",
             f"- Huella de la clave de seudonimización: `{ds.meta.get('pseudonym_key_fingerprint')}` (la clave no se almacena)",
             f"- Conteos: {json.dumps(ds.meta.get('counts', {}), ensure_ascii=False)}", "",
             "> Las asignaciones observadas describen decisiones pasadas (con autoselección SIGA, disponibilidad y asignaciones directas); "
             "no son etiquetas de idoneidad. La retroalimentación de calidad es posterior a la ubicación y no está validada como idoneidad.", "",
             "## Mecanismos de asignación observados", "", "| Periodo | Mecanismo | n |", "|---|---|---|"]
    for p, c in mechanism_summary(ds).items():
        for m, n in c.items():
            lines.append(f"| {p} | {m} | {n} |")
    lines += ["", "## Cobertura por campo", "", "| Entidad | Periodo | Campo | Registros | Con valor | Cobertura | Estado |", "|---|---|---|---|---|---|---|"]
    for r in ds.coverage:
        lines.append(f"| {r['entidad']} | {r['periodo']} | {r['campo']} | {r['registros']} | {r['con_valor']} | {r['cobertura']:.1%} | {r['estado']} |")
    lines += ["", "## Problemas de calidad de datos", "", "| Código | Periodo | Entidad | n |", "|---|---|---|---|"]
    agg: dict = {}
    for i in ds.issues:
        k = (i["codigo"], i["periodo"], i["entidad"])
        agg[k] = agg.get(k, 0) + int(i.get("n") or 1)
    for (c, p, e), n in sorted(agg.items()):
        lines.append(f"| {c} | {p} | {e} | {n} |")
    return "\n".join(lines) + "\n"


def to_input_bundle(ds: HistoricalDataset, periods: list[str] | None = None, require_capacity: bool = False) -> InputBundle:
    """Engine inputs built ONLY from fields known before the assignment decision (FIELD_TIMING=PRE).

    Allocations and quality feedback are never copied. Capacity is the reconstructed value when present;
    with `require_capacity` a missing capacity raises (no invented seats)."""
    sel = set(periods) if periods else None
    b = InputBundle()
    st_fields = [f for f, t in FIELD_TIMING["students"].items() if t == "PRE"]
    for r in ds.students:
        if sel and r["period"] not in sel:
            continue
        b.students.append(Student(**{f: r.get(f) for f in st_fields}, source=r.get("fuente")))
    for r in ds.placements:
        if sel and r["period"] not in sel:
            continue
        cap = r.get("capacity")
        if cap is None and require_capacity:
            raise ValueError(f"Plaza {r['placement_id']} sin cupo reconstruido; elija un capacity_mode autorizado.")
        b.vacancies.append(Vacancy(
            vacancy_id=r["placement_id"], period=r["period"], capacity=int(cap) if cap is not None else 0, status=r.get("status"),
            vacancy_type=r.get("vacancy_type"), project_id=r.get("project_id"), project_name=r.get("project_name"),
            project_description=r.get("project_description"), project_line=r.get("project_line"), organization_id=r.get("organization_id"),
            organization_name=r.get("organization_name"), department=r.get("department"), municipality=r.get("municipality"),
            modality=r.get("modality"), program_profile=r.get("program_profile"), program_profile_alt=r.get("program_profile_alt"),
            activities_text=r.get("activities_text"), requirements_text=r.get("requirements_text"), source=r.get("fuente")))
    return b


def export_engine_workbook(ds: HistoricalDataset, period: str, path: str | Path, allow_inside_repo: bool = False) -> Path:
    """Write a period in the engine's canonical Excel contract (Estudiantes/Plazas) for `pyr-match match`.
    No Decisiones_Directas are produced: historical approval states are not reconstructable (blocker B3)."""
    from ..fixtures import ST_COLS, VC_COLS
    from ..io_excel import safe_append

    p = assert_safe_output_dir(Path(path).parent, allow_inside_repo) / Path(path).name
    b = to_input_bundle(ds, [period], require_capacity=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "Estudiantes"
    safe_append(ws, ST_COLS)
    for s in b.students:
        safe_append(ws, [s.student_id, s.period, s.academic_program, s.origin_municipality, "SI", s.expectations_text, s.learning_goals_text,
                         s.skills_text, s.interests_text, s.desired_work_text, s.modality_preference])
    ws = wb.create_sheet("Plazas")
    safe_append(ws, VC_COLS)
    for v in b.vacancies:
        safe_append(ws, [v.vacancy_id, v.period, v.project_id, v.project_name, v.project_description, v.project_line, v.organization_id,
                         v.organization_name, v.department, v.municipality, v.modality, v.capacity, v.status, v.vacancy_type, v.program_profile,
                         v.program_profile_alt, v.activities_text, v.requirements_text, None, None])
    p.parent.mkdir(parents=True, exist_ok=True)
    wb.save(p)
    return p
