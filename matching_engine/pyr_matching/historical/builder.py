"""Reproducible, privacy-safe reconstruction of the canonical HISTORICAL datasets from institutional
Excel exports (Tablero Maestro, pre-registration forms, project databases, evaluations).

Logical datasets produced (see docs/HISTORICAL_DATA.md):

* STUDENTS_BEFORE_ASSIGNMENT  – pseudonymous student, period, program, origin municipality and the
  professional free text available at decision time (pre-registration answers).
* PLACEMENTS_BEFORE_ASSIGNMENT – stable placement ID, organisation/project IDs, description, profile,
  location, modality, type, status, requirements (2026B call questionnaire when joinable) and capacity
  ONLY when an explicitly authorised reconstruction mode is selected.
* OBSERVED_ALLOCATIONS – who was actually placed where, through which mechanism. POST-decision data:
  never a prediction feature, never a suitability label.
* QUALITY_FEEDBACK – post-placement evaluations (`Ev. Plazas`), kept with provenance and
  `estado_validacion = NO_VALIDADA_COMO_IDONEIDAD` until the institution approves them (policy D14).

Guarantees
* Only configured columns are read (`config/historical_sources_tablero.json`); identity, contact,
  health, demographic and special-case-justification columns are never read. A guard refuses configs
  whose feature fields point to such headers.
* Student codes are replaced by keyed HMAC-SHA256 pseudonyms (stable across runs and periods with the
  same secret key; the key never lives in the repository). Raw codes never leave this module.
* Every record keeps provenance (file::sheet::row). Duplicates and referential problems are reported,
  never silently resolved. Nothing is invented: missing values stay missing.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

from ..io_excel import FORBIDDEN_STUDENT_TOKENS, FORBIDDEN_TOKENS, sha256_file
from ..policy import Policy, canon, canon_modality, canon_place

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "historical_sources_tablero.json"
KINDS = ("preinscripcion", "tablero_estudiantes", "tablero_plazas", "evaluacion_plazas", "convocatoria_organizaciones")
CAPACITY_MODES = ("none", "approved_column", "row_count", "observed_count")

# Leakage registry: when each canonical field becomes known. Only PRE fields may feed prediction.
FIELD_TIMING = {
    "students": {f: "PRE" for f in ("student_id", "period", "academic_program", "origin_municipality", "expectations_text",
                                    "learning_goals_text", "skills_text", "interests_text", "desired_work_text", "modality_preference")},
    "placements": {**{f: "PRE" for f in ("placement_id", "period", "organization_id", "organization_name", "organization_type", "project_id",
                                         "project_name", "project_description", "project_line", "department", "municipality", "modality",
                                         "program_profile", "program_profile_alt", "vacancy_type", "status", "activities_text",
                                         "requirements_text", "requested_seats")},
                   "capacity": "PRE_RECONSTRUIDA", "seat_rows": "POST", "observed_allocations": "POST"},
    "allocations": "POST",
    "quality_feedback": "POST",
}
# Identity/sensitive tokens that may never be the source of ANY canonical historical field, except the
# join key (student code), which is pseudonymised immediately.
_EXTRA_FORBIDDEN = ("ASESOR", "ACUDIENTE", "TIPO_DE_CASO", "CASO_ESPECIAL", "JUSTIFICACION", "CEDULA", "CC")


class HistoricalConfigError(ValueError):
    pass


def _header_of(alias) -> str:
    return alias if isinstance(alias, str) else (alias.get("header") or alias.get("prefix") or "")


def _has_token(canon_header: str, token: str) -> bool:
    # short tokens (CC, EPS) must match a whole word; long ones may match inside ('CEDULA' in 'NUMERO_DE_CEDULA')
    return token in canon_header.split("_") if len(token) <= 3 else token in canon_header


def guard_config(cfg: dict) -> None:
    """Refuse configurations that would read identity, contact, health, demographic or special-case
    justification columns into ANY canonical historical field."""
    tokens = tuple(dict.fromkeys(FORBIDDEN_STUDENT_TOKENS + _EXTRA_FORBIDDEN))
    for kind, spec in cfg["kinds"].items():
        for fld, aliases in {**spec.get("columns", {}), **spec.get("multi_columns", {})}.items():
            for a in aliases:
                h = _header_of(a)
                c = canon(h) or ""
                bad = [t for t in tokens if _has_token(c, t)]
                if fld in ("organization_name", "project_name"):
                    bad = [t for t in bad if t != "NOMBRE"]  # 'Nombre de la Organización' / 'Nombre del Proyecto'
                if fld in ("student_code", "student_codes"):
                    bad = [t for t in bad if t in ("CEDULA", "CC", "NOMBRE", "APELLIDO", "CORREO")]
                if bad:
                    raise HistoricalConfigError(f"Configuración rechazada: {kind}.{fld} apunta a la columna sensible '{h}' ({', '.join(bad)}).")


class Pseudonymizer:
    """Keyed, stable pseudonyms. Same key -> same pseudonym for the same code across files/periods."""

    def __init__(self, key: bytes):
        if not key or len(key) < 16:
            raise HistoricalConfigError("Clave de seudonimización ausente o corta (>= 16 bytes). Defina PYR_PSEUDONYM_KEY o --pseudonym-key-file (fuera de git).")
        self._key = key

    @classmethod
    def from_env_or_file(cls, key_file: str | None = None, env: str = "PYR_PSEUDONYM_KEY") -> "Pseudonymizer":
        if key_file:
            return cls(Path(key_file).read_bytes().strip())
        val = os.environ.get(env)
        if not val:
            raise HistoricalConfigError(f"Defina la variable {env} o use --pseudonym-key-file. La clave nunca debe guardarse en el repositorio.")
        return cls(val.encode("utf-8"))

    def student(self, code: Any) -> str | None:
        c = _norm_code(code)
        if not c:
            return None
        return "S" + hmac.new(self._key, c.encode("utf-8"), hashlib.sha256).hexdigest()[:16].upper()

    @property
    def key_fingerprint(self) -> str:
        return hashlib.sha256(b"pyr-key-fp|" + self._key).hexdigest()[:12]


def _norm_code(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = "".join(ch for ch in str(v).strip() if ch.isalnum()).upper()
    return s or None


def _text(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = " ".join(str(v).split())
    return s or None


def _num(v: Any) -> float | None:
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", ".").strip())
    except ValueError:
        return None


def _hid(prefix: str, *parts: Any, n: int = 10) -> str:
    key = "|".join(canon(p) or "" for p in parts)
    return prefix + hashlib.sha256(key.encode("utf-8")).hexdigest()[:n].upper()


def _resolve_columns(header: tuple, spec: dict) -> tuple[dict[str, int], dict[str, list[int]]]:
    canon_h = [canon(h) for h in header]
    cols: dict[str, int] = {}
    for fld, aliases in spec.get("columns", {}).items():
        for a in aliases:
            idx = None
            if isinstance(a, str):
                idx = next((i for i, h in enumerate(canon_h) if h and h == canon(a)), None)
            elif "occurrence" in a:
                hits = [i for i, h in enumerate(canon_h) if h and h == canon(a["header"])]
                idx = hits[a["occurrence"] - 1] if len(hits) >= a["occurrence"] else None
            elif "prefix" in a:
                pre = canon(a["prefix"])
                idx = next((i for i, h in enumerate(canon_h) if h and h.startswith(pre)), None)
            if idx is not None:
                cols[fld] = idx
                break
    multi = {fld: sorted({i for a in aliases for i, h in enumerate(canon_h) if h and h == canon(a)})
             for fld, aliases in spec.get("multi_columns", {}).items()}
    return cols, multi


@dataclass
class HistoricalDataset:
    students: list[dict] = field(default_factory=list)
    placements: list[dict] = field(default_factory=list)
    allocations: list[dict] = field(default_factory=list)
    quality_feedback: list[dict] = field(default_factory=list)
    issues: list[dict] = field(default_factory=list)
    coverage: list[dict] = field(default_factory=list)
    provenance: list[dict] = field(default_factory=list)
    meta: dict = field(default_factory=dict)

    def periods(self) -> list[str]:
        from ..training import period_key

        return sorted({r["period"] for r in self.students} | {r["period"] for r in self.placements}, key=period_key)


def _read_sheet(path: Path, sheets: list[str], spec: dict, kind: str, header_row: int = 1):
    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        wanted = {canon(s) for s in sheets}
        ws = next((w for w in wb.worksheets if canon(w.title) in wanted), None)
        if ws is None:
            raise HistoricalConfigError(f"{path.name}: no se encontró la hoja {sheets} para {kind}.")
        it = ws.iter_rows(min_row=header_row, values_only=True)
        header = next(it, None) or ()
        cols, multi = _resolve_columns(header, spec)
        missing = [f for f in spec.get("required", []) if f not in cols and f not in multi]
        if missing:
            raise HistoricalConfigError(f"{path.name}::{ws.title}: faltan columnas para {kind}: {', '.join(missing)}.")
        out = []
        for rn, r in enumerate(it, start=header_row + 1):
            if r is None or all(c is None or (isinstance(c, str) and not c.strip()) for c in r):
                continue
            rec = {f: (r[i] if i < len(r) else None) for f, i in cols.items()}
            for f, idxs in multi.items():
                rec[f] = [r[i] for i in idxs if i < len(r)]
            rec["_source"] = f"{path.name}::{ws.title}::{rn}"
            out.append(rec)
        return out, ws.title, sorted(cols), {f: len(v) for f, v in multi.items()}
    finally:
        wb.close()


def build_historical_dataset(manifest: dict, pseudonymizer: Pseudonymizer, policy: Policy | None = None,
                             config: dict | None = None, base_dir: str | Path | None = None) -> HistoricalDataset:
    """Build the canonical historical datasets from a manifest of LOCAL Excel exports.

    manifest = {"sources": [{"kind", "period", "path", "sheet"?}], "capacity_mode": "none"|...}
    """
    cfg = config or json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    guard_config(cfg)
    policy = policy or Policy.load()
    cap_mode = manifest.get("capacity_mode", "none")
    if cap_mode not in CAPACITY_MODES:
        raise HistoricalConfigError(f"capacity_mode debe ser uno de {CAPACITY_MODES}.")
    base = Path(base_dir) if base_dir else Path(".")
    ds = HistoricalDataset()
    issues = ds.issues

    def issue(code, period, entity, detail="", count=1):
        issues.append({"codigo": code, "periodo": period, "entidad": entity, "detalle": detail, "n": count})

    raw: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    seen_files: dict[str, str] = {}
    for src in manifest["sources"]:
        kind, period = src["kind"], str(src["period"])
        if kind not in KINDS:
            raise HistoricalConfigError(f"Tipo de fuente desconocido: {kind}.")
        path = Path(src["path"])
        path = path if path.is_absolute() else base / path
        digest = sha256_file(path)
        if digest in seen_files and seen_files[digest] == f"{kind}|{period}":
            issue("ARCHIVO_DUPLICADO_IGNORADO", period, kind, path.name)
            continue
        seen_files[digest] = f"{kind}|{period}"
        spec = cfg["kinds"][kind]
        rows, sheet, cols_found, multi_found = _read_sheet(path, src.get("sheet") and [src["sheet"]] or spec["default_sheet"], spec, kind, src.get("header_row", 1))
        ds.provenance.append({"tipo": kind, "periodo": period, "archivo": path.name, "hoja": sheet, "sha256": digest, "filas": len(rows),
                              "columnas_leidas": ", ".join(cols_found + [f"{k}x{v}" for k, v in multi_found.items()])})
        for r in rows:
            r["_period"] = period
        raw[period][kind].extend(rows)

    for period in sorted(raw):
        _build_period(ds, period, raw[period], pseudonymizer, policy, cap_mode, issue)

    ds.coverage = coverage_report(ds)
    ds.meta = {
        "dataset_schema": "pyr-historical/1.0",
        "built_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "capacity_mode": cap_mode,
        "capacity_status": "NO_RECONSTRUIDA" if cap_mode == "none" else "RECONSTRUIDA_NO_VERIFICADA_INSTITUCIONALMENTE",
        "pseudonym_key_fingerprint": pseudonymizer.key_fingerprint,
        "config_mapping_id": cfg.get("mapping_id"),
        "periods": ds.periods(),
        "counts": {"students": len(ds.students), "placements": len(ds.placements), "allocations": len(ds.allocations),
                   "quality_feedback": len(ds.quality_feedback), "issues": len(issues)},
        "label_policy": "ASIGNACIONES_OBSERVADAS no son etiquetas de idoneidad; RETROALIMENTACION_CALIDAD = NO_VALIDADA_COMO_IDONEIDAD hasta aprobación (D14).",
    }
    return ds


def _build_period(ds: HistoricalDataset, period: str, kinds: dict[str, list[dict]], pz: Pseudonymizer, policy: Policy, cap_mode: str, issue):
    # ---- students (cohort = Tablero 'Estudiantes'; texts from pre-registration) --------------
    pre: dict[str, dict] = {}
    pre_dups = 0
    for r in kinds.get("preinscripcion", []):
        sid = pz.student(r.get("student_code"))
        if sid is None:
            issue("PREINSCRIPCION_SIN_CODIGO", period, "preinscripcion", r["_source"])
            continue
        ts = r.get("timestamp")
        prev = pre.get(sid)
        if prev is not None:
            pre_dups += 1
            # keep the LATEST answer (most recent pre-decision statement); ties keep the first
            if not (isinstance(ts, datetime) and isinstance(prev.get("timestamp"), datetime) and ts > prev["timestamp"]):
                continue
        pre[sid] = r
    if pre_dups:
        issue("PREINSCRIPCION_DUPLICADA", period, "preinscripcion", "se conserva la respuesta más reciente", pre_dups)

    students: dict[str, dict] = {}
    alloc_type: dict[str, str | None] = {}
    for r in kinds.get("tablero_estudiantes", []):
        sid = pz.student(r.get("student_code"))
        if sid is None:
            issue("ESTUDIANTE_SIN_CODIGO", period, "tablero_estudiantes", r["_source"])
            continue
        prog = _text(r.get("academic_program"))
        if sid in students:
            if canon_place(students[sid]["academic_program"]) != canon_place(prog):
                issue("ESTUDIANTE_DUPLICADO_CONFLICTIVO", period, "tablero_estudiantes", f"{sid} (se conserva la primera fila)")
            else:
                issue("ESTUDIANTE_DUPLICADO", period, "tablero_estudiantes", sid)
            continue
        p = pre.get(sid, {})
        students[sid] = {
            "student_id": sid, "period": period, "academic_program": prog,
            "origin_municipality": _text(r.get("origin_municipality")),
            "expectations_text": _text(p.get("expectations_text")), "learning_goals_text": _text(p.get("learning_goals_text")),
            "skills_text": _text(p.get("skills_text")), "interests_text": _text(p.get("interests_text")),
            "desired_work_text": _text(p.get("desired_work_text")), "modality_preference": canon_modality(p.get("modality_preference")),
            "preinscripcion_encontrada": "SI" if p else "NO", "fuente": r["_source"],
        }
        alloc_type[sid] = canon(r.get("allocation_type"))
    orphan_pre = len(set(pre) - set(students))
    if orphan_pre:
        issue("PREINSCRIPCION_SIN_ESTUDIANTE_EN_TABLERO", period, "preinscripcion", "preinscritos no presentes en el tablero (no matriculados u otro periodo)", orphan_pre)
    no_pre = sum(1 for s in students.values() if s["preinscripcion_encontrada"] == "NO")
    if no_pre:
        issue("ESTUDIANTE_SIN_PREINSCRIPCION", period, "tablero_estudiantes", "sin texto de expectativas/aprendizajes", no_pre)

    # ---- placements (one row = one seat-row of a placement; identical keys are merged) -------
    calls: dict[str, dict] = {}
    for r in kinds.get("convocatoria_organizaciones", []):
        key = canon(r.get("organization_name"))
        if key:
            if key in calls:
                issue("CONVOCATORIA_ORGANIZACION_REPETIDA", period, "convocatoria_organizaciones", "se conserva la primera respuesta")
                continue
            calls[key] = r
    placements: dict[str, dict] = {}
    seats: list[tuple[str, str, str | None, str]] = []  # (placement_id, sid, row_alloc_type, source)
    for r in kinds.get("tablero_plazas", []):
        org, proj = _text(r.get("organization_name")), _text(r.get("project_name"))
        vtype = policy.alias("vacancy_type", r.get("vacancy_type"))
        profile = _text(r.get("program_profile"))
        muni = _text(r.get("municipality"))
        pid = _hid(f"P{period}-", period, org, proj, muni, vtype, profile)
        p = placements.get(pid)
        if p is None:
            call = calls.get(canon(org) or "", {}) if vtype in ("CONVOCATORIA", "CONVOCATORIA_UNIBAGUE") else {}
            p = placements[pid] = {
                "placement_id": pid, "period": period, "organization_id": _hid("O-", org), "organization_name": org,
                "organization_type": _text(r.get("organization_type")), "project_id": _hid("PR-", org, proj), "project_name": proj,
                "project_description": _text(r.get("project_description")), "project_line": _text(r.get("project_line")),
                "department": _text(r.get("department")), "municipality": muni, "modality": canon_modality(r.get("modality")),
                "program_profile": profile, "program_profile_alt": _text(r.get("program_profile_alt")),
                "vacancy_type": vtype, "status": policy.alias("status", r.get("status")),
                "activities_text": _text(call.get("activities_text")), "requirements_text": _text(call.get("requirements_text")),
                "requested_seats": _num(call.get("requested_seats")), "approved_seats": None,
                "seat_rows": 0, "observed_allocations": 0, "capacity": None, "capacity_source": "NO_RECONSTRUIDA",
                "requisitos_fuente": "CONVOCATORIA_2026B" if call else None, "fuente": r["_source"],
            }
        else:
            for f in ("project_description", "project_line", "modality", "program_profile_alt", "organization_type"):
                newv = _text(r.get(f)) if f != "modality" else canon_modality(r.get(f))
                if p[f] and newv and canon(p[f]) != canon(newv):
                    issue("PLAZA_FILAS_INCONSISTENTES", period, "tablero_plazas", f"{pid}.{f}")
                p[f] = p[f] or newv
        p["seat_rows"] += 1
        a = _num(r.get("approved_seats"))
        if a is not None:
            p["approved_seats"] = max(p["approved_seats"] or 0, int(a))
        for code in r.get("student_codes") or []:
            sid = pz.student(code)
            if sid:
                seats.append((pid, sid, canon(r.get("row_allocation_type")), r["_source"]))
    for org_key in set(calls) - {canon(p["organization_name"]) for p in placements.values()}:
        issue("CONVOCATORIA_SIN_PLAZA", period, "convocatoria_organizaciones", "organización del cuestionario sin plaza en el tablero")

    # ---- observed allocations -------------------------------------------------------------------
    by_student: dict[str, list] = defaultdict(list)
    for pid, sid, row_type, src in seats:
        by_student[sid].append((pid, row_type, src))
    allocations = []
    for sid in sorted(by_student):
        entries = by_student[sid]
        distinct = sorted({e[0] for e in entries})
        if len(entries) > len(distinct):
            issue("ASIGNACION_REPETIDA_MISMA_PLAZA", period, "tablero_plazas", sid)
        conflict = len(distinct) > 1
        if conflict:
            issue("ASIGNACION_MULTIPLE", period, "tablero_plazas", f"{sid} en {len(distinct)} plazas")
        if sid not in students:
            issue("ASIGNACION_SIN_ESTUDIANTE", period, "tablero_plazas", sid)
        for pid in distinct:
            p = placements[pid]
            p["observed_allocations"] += 1
            row_type = next((e[1] for e in entries if e[0] == pid and e[1]), None)
            t = alloc_type.get(sid) or row_type
            if t == "SIGA":
                mech = "SIGA"
            elif t in ("DIRECTA", "ASIGNACION_DIRECTA") or (t and t.startswith("DIRECT")):
                mech = "DIRECTA_" + (p["vacancy_type"] or "DESCONOCIDO")
            else:
                mech = "DESCONOCIDO"
            s = students.get(sid)
            from ..constraints import program_relation
            from ..schema import Student, Vacancy

            rel = program_relation(Student(sid, period, s["academic_program"] if s else None),
                                   Vacancy(pid, period, 0, None, None, program_profile=p["program_profile"], program_profile_alt=p["program_profile_alt"])) if s else "estudiante_no_encontrado"
            allocations.append({"student_id": sid, "placement_id": pid, "period": period, "mechanism": mech,
                                "allocation_type_raw": t, "vacancy_type": p["vacancy_type"], "assignment_status": "OBSERVADA",
                                "program_relation": rel, "conflicto_multiple": "SI" if conflict else "NO",
                                "student_found": "SI" if s else "NO", "fuente": next(e[2] for e in entries if e[0] == pid)})
    unalloc = sum(1 for sid in students if sid not in by_student)
    if unalloc:
        issue("ESTUDIANTE_SIN_ASIGNACION_OBSERVADA", period, "tablero_estudiantes", "sin código en ningún bloque de plaza", unalloc)
    out_of_profile = sum(1 for a in allocations if a["program_relation"] == "none")
    if out_of_profile:
        issue("ASIGNACION_HISTORICA_FUERA_DE_PERFIL", period, "asignaciones", "conflicto histórico, no error del motor", out_of_profile)

    # ---- capacity (only with an explicit, authorised mode) --------------------------------------
    for p in placements.values():
        if cap_mode == "approved_column" and p["approved_seats"] is not None:
            p["capacity"], p["capacity_source"] = int(p["approved_seats"]), "COLUMNA_APROBADOS_NO_VERIFICADA"
        elif cap_mode == "row_count":
            p["capacity"], p["capacity_source"] = p["seat_rows"], "CONTEO_FILAS_NO_VERIFICADO"
        elif cap_mode == "observed_count":
            p["capacity"], p["capacity_source"] = p["observed_allocations"], "COTA_INFERIOR_ASIGNACIONES_OBSERVADAS"
        if cap_mode != "none" and p["capacity"] is not None and p["observed_allocations"] > p["capacity"]:
            issue("SOBRECUPO_HISTORICO", period, "plazas", p["placement_id"])
    if cap_mode == "approved_column":
        miss = sum(1 for p in placements.values() if p["capacity"] is None)
        if miss:
            issue("CUPOS_NO_RECONSTRUIBLES", period, "plazas", "sin valor en 'Aprobados'", miss)

    # ---- quality feedback (post-placement; never a feature; not a suitability label) -----------
    alloc_by_sid = defaultdict(list)
    for a in allocations:
        alloc_by_sid[a["student_id"]].append(a)
    for r in kinds.get("evaluacion_plazas", []):
        sid = pz.student(r.get("student_code"))
        ev_period = _text(r.get("period")) or period
        if ev_period != period:
            issue("EVALUACION_DE_OTRO_PERIODO", period, "evaluacion_plazas", ev_period)
        cands = [a for a in alloc_by_sid.get(sid, []) if canon(placements[a["placement_id"]]["organization_name"]) == canon(r.get("organization_name"))]
        if len(cands) != 1:
            issue("EVALUACION_SIN_UNION" if not cands else "EVALUACION_UNION_AMBIGUA", period, "evaluacion_plazas", r["_source"].rsplit("::", 1)[0])
            continue
        for who, fld, scale in (("ASESOR", "advisor_total", 100.0), ("ESTUDIANTE", "student_total", 100.0)):
            val = _num(r.get(fld))
            if val is None:
                continue
            ds.quality_feedback.append({
                "student_id": sid, "placement_id": cands[0]["placement_id"], "period": period, "evaluador": who,
                "puntaje_normalizado": round(max(0.0, min(1.0, val / scale)), 4), "puntaje_original": val,
                "tipo_senal": "CALIDAD_PLAZA_POST_UBICACION", "estado_validacion": "NO_VALIDADA_COMO_IDONEIDAD",
                "estado_revisor": "DESCONOCIDO", "disponible_en": "POST_ASIGNACION", "fuente": r["_source"],
            })

    ds.students.extend(students[k] for k in sorted(students))
    ds.placements.extend(placements[k] for k in sorted(placements))
    ds.allocations.extend(allocations)


COVERAGE_FIELDS = {
    "students": ("academic_program", "origin_municipality", "expectations_text", "learning_goals_text", "skills_text", "interests_text",
                 "desired_work_text", "modality_preference"),
    "placements": ("program_profile", "program_profile_alt", "project_description", "project_line", "municipality", "modality",
                   "vacancy_type", "status", "activities_text", "requirements_text", "capacity"),
    "allocations": ("mechanism",),
}


def coverage_report(ds: HistoricalDataset) -> list[dict]:
    out = []
    for entity, fields in COVERAGE_FIELDS.items():
        rows = getattr(ds, entity)
        for period in sorted({r["period"] for r in rows}):
            pr = [r for r in rows if r["period"] == period]
            for f in fields:
                if entity == "allocations":
                    n_ok = sum(1 for r in pr if r[f] != "DESCONOCIDO")
                else:
                    n_ok = sum(1 for r in pr if r.get(f) not in (None, ""))
                out.append({"entidad": entity, "periodo": period, "campo": f, "registros": len(pr), "con_valor": n_ok,
                            "cobertura": round(n_ok / len(pr), 4) if pr else 0.0,
                            "estado": "NO_EXISTE_EN_FUENTE" if n_ok == 0 else ("PARCIAL" if n_ok < len(pr) else "COMPLETO")})
    return out


def mechanism_summary(ds: HistoricalDataset) -> dict:
    out = defaultdict(Counter)
    for a in ds.allocations:
        out[a["period"]][a["mechanism"]] += 1
    return {p: dict(sorted(c.items())) for p, c in sorted(out.items())}
