"""Phase 5 – human-in-the-loop expert review of recommended pairs (Excel) and validated, versioned import.

Workflow
1. `make_review_workbook` turns a match result into `Revision_Pares` rows (pseudonymous IDs, plaza data,
   academic profile, score + components, constraint status, evidence coverage, explanation) with
   dropdown-validated reviewer columns. `blind=True` hides score/explanation to reduce anchoring bias
   (recommended when the reviews will become training labels).
2. Authorised reviewers fill `evaluacion_idoneidad` (1-5 or NO_EVALUABLE), `id_revisor`, `fecha_revision`;
   an authorised approver sets `estado_aprobacion = APROBADA` and `aprobado_por`.
3. `import_feedback` validates every row (row fingerprint against tampering of key columns, domains,
   approval, reviewer present, approver != reviewer, run metadata) and writes an immutable, versioned
   JSON snapshot to a feedback store OUTSIDE git. Free-text comments are counted, never stored as
   labels or features. Unapproved rows and historical allocations can never become labels.
"""
from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.worksheet.datavalidation import DataValidation

from .historical.store import assert_safe_output_dir
from .io_excel import _write_table, safe_append
from .schema import Label

FEEDBACK_SCHEMA = "pyr-feedback/1.0"
LABEL_SOURCE = "REVISION_EXPERTA_PAR"
SCALE = {"1": 0.0, "2": 0.25, "3": 0.5, "4": 0.75, "5": 1.0}
SCALE_TEXT = ["1 - Muy baja", "2 - Baja", "3 - Media", "4 - Alta", "5 - Muy alta", "NO_EVALUABLE"]
APPROVAL = ["PENDIENTE", "APROBADA", "RECHAZADA"]
REVIEW_COLS = ["evaluacion_idoneidad", "id_revisor", "fecha_revision", "comentario_revisor", "estado_aprobacion", "aprobado_por"]
KEY_COLS = ["id_revision", "periodo", "id_estudiante", "id_plaza", "contexto", "huella_fila"]


def _fp(*parts) -> str:
    return hashlib.sha256("|".join(str(p) for p in parts).encode("utf-8")).hexdigest()[:20]


def make_review_workbook(result, bundle, period: str, path: str | Path, policy, per_student: int = 3, blind: bool = False,
                         allow_inside_repo: bool = False) -> Path:
    p = Path(path)
    assert_safe_output_dir(p.parent, allow_inside_repo)
    smap = {s.student_id: s for s in bundle.students if s.period == period}
    pairs = {(r["id_estudiante"], r["id_plaza"]): r for r in result.tables.get("Pares_Evaluados", [])}
    run_id = _fp(result.summary.get("politica_huella"), result.summary.get("version_algoritmo"), period, result.summary.get("fecha_ejecucion_utc"),
                 result.summary.get("archivos_fuente_sha256"))
    rows = []
    for r in result.tables.get("Recomendaciones_SIGA", []):
        if r["rango"] <= per_student:
            rows.append((r, "SIGA_RECOMENDADA", r["rango"]))
    for r in result.tables.get("Asignaciones_Directas", []):
        if r["estado"] == "PROPUESTA_REQUIERE_APROBACION":
            rows.append((r, "DIRECTA_PROPUESTA", 1))
    out = []
    for r, ctx, rank in sorted(rows, key=lambda x: (x[0]["id_estudiante"], x[2], x[0]["id_plaza"])):
        sid, vid = r["id_estudiante"], r["id_plaza"]
        pr = pairs.get((sid, vid), {})
        comps = "; ".join(f"{k[2:]}={v}" for k, v in pr.items() if k.startswith("c_") and v is not None)
        rid = _fp(run_id, sid, vid, ctx)
        row = {"id_revision": rid, "periodo": period, "id_estudiante": sid, "programa_estudiante": smap[sid].academic_program if sid in smap else None,
               "id_plaza": vid, "proyecto": r.get("proyecto"), "organizacion": r.get("organizacion"), "municipio": r.get("municipio"),
               "modalidad": r.get("modalidad"), "perfil_programa": r.get("perfil_programa"), "contexto": ctx, "rango": rank,
               "compatibilidad": None if blind else r.get("compatibilidad"), "componentes": None if blind else comps,
               "estado_restricciones": "CUMPLE_REGLAS_OBLIGATORIAS", "cobertura_evidencia": r.get("cobertura_evidencia"),
               "confianza_evidencia": r.get("confianza_evidencia"), "explicacion": None if blind else r.get("explicacion"),
               "huella_fila": _fp(rid, sid, vid, period, ctx), "fuente_etiqueta": LABEL_SOURCE,
               **{c: ("PENDIENTE" if c == "estado_aprobacion" else None) for c in REVIEW_COLS}}
        out.append(row)
    wb = Workbook()
    ws = wb.active
    ws.title = "Instrucciones"
    for line in [
        "Revisión experta de parejas estudiante-plaza (Paz y Región). Uso exclusivo de revisores autorizados.",
        "1. Califique evaluacion_idoneidad (1-5) según el ajuste formativo y profesional de la pareja, o NO_EVALUABLE si falta información.",
        "2. id_revisor = código seudónimo del revisor (no nombres). fecha_revision = AAAA-MM-DD.",
        "3. comentario_revisor: opcional; NO escriba datos personales, de salud ni justificaciones de casos especiales. Nunca se usa para entrenar.",
        "4. Un aprobador distinto del revisor cambia estado_aprobacion a APROBADA y completa aprobado_por. Solo filas APROBADAS se importan.",
        "5. No modifique columnas de identificación (id_revision, periodo, id_estudiante, id_plaza, contexto, huella_fila): la importación lo detecta.",
        "6. Una calificación es un juicio de idoneidad; NO registre aquí la asignación histórica ni la elección SIGA del estudiante.",
        f"Modo ciego (sin puntaje ni explicación del motor): {'SI' if blind else 'NO'}.",
    ]:
        safe_append(ws, [line])
    ws.column_dimensions["A"].width = 140
    _write_table(wb.create_sheet("Revision_Pares"), out, list(out[0].keys()) if out else ["sin_registros"])
    meta = {"feedback_schema": FEEDBACK_SCHEMA, "run_id": run_id, "periodo": period, "version_algoritmo": result.summary.get("version_algoritmo"),
            "politica_id": result.summary.get("politica_id"), "politica_huella": result.summary.get("politica_huella"),
            "modo_ciego": "SI" if blind else "NO", "filas": len(out), "generado_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat()}
    _write_table(wb.create_sheet("Metadatos"), [{"clave": k, "valor": v} for k, v in meta.items()], ["clave", "valor"])
    if out:
        rv = wb["Revision_Pares"]
        header = [c.value for c in rv[1]]
        n = len(out) + 1
        for col, options in (("evaluacion_idoneidad", SCALE_TEXT), ("estado_aprobacion", APPROVAL)):
            letter = rv.cell(row=1, column=header.index(col) + 1).column_letter
            dv = DataValidation(type="list", formula1='"' + ",".join(options) + '"', allow_blank=True, showErrorMessage=True)
            rv.add_data_validation(dv)
            dv.add(f"{letter}2:{letter}{n}")
    p.parent.mkdir(parents=True, exist_ok=True)
    wb.save(p)
    return p


class FeedbackError(ValueError):
    pass


def _read_sheet(path, name):
    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        if name not in wb.sheetnames:
            raise FeedbackError(f"{Path(path).name}: falta la hoja {name}.")
        rows = list(wb[name].iter_rows(values_only=True))
    finally:
        wb.close()
    return [dict(zip(rows[0], r)) for r in rows[1:]] if rows else []


def _score(v) -> float | None:
    if v is None:
        return None
    s = str(v).strip().split(" ")[0]
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        s = str(int(v)) if float(v).is_integer() else s
    return SCALE.get(s)


def import_feedback(paths: list[str | Path], store_dir: str | Path, allow_inside_repo: bool = False) -> dict:
    """Validate review workbooks and write a new immutable feedback version. Returns the version manifest."""
    from .io_excel import sha256_file

    store = assert_safe_output_dir(store_dir, allow_inside_repo)
    accepted, rejected = [], defaultdict(int)
    sources, comments = [], 0
    for path in paths:
        meta = {r["clave"]: r["valor"] for r in _read_sheet(path, "Metadatos")}
        if meta.get("feedback_schema") != FEEDBACK_SCHEMA:
            raise FeedbackError(f"{Path(path).name}: esquema de retroalimentación desconocido.")
        sources.append({"archivo": Path(path).name, "sha256": sha256_file(path), "run_id": meta.get("run_id"), "periodo": meta.get("periodo"),
                        "politica_huella": meta.get("politica_huella"), "modo_ciego": meta.get("modo_ciego")})
        for r in _read_sheet(path, "Revision_Pares"):
            if not r.get("id_revision"):
                continue
            if r.get("comentario_revisor"):
                comments += 1
            expected = _fp(_fp(meta.get("run_id"), r.get("id_estudiante"), r.get("id_plaza"), r.get("contexto")), r.get("id_estudiante"),
                           r.get("id_plaza"), r.get("periodo"), r.get("contexto"))
            if r.get("id_revision") != _fp(meta.get("run_id"), r.get("id_estudiante"), r.get("id_plaza"), r.get("contexto")) or r.get("huella_fila") != expected:
                rejected["HUELLA_NO_COINCIDE (columnas de identificación modificadas)"] += 1
                continue
            status = (str(r.get("estado_aprobacion") or "").strip().upper())
            if status != "APROBADA":
                rejected[f"NO_APROBADA ({status or 'VACIO'})"] += 1
                continue
            if r.get("fuente_etiqueta") != LABEL_SOURCE:
                rejected["FUENTE_ETIQUETA_INVALIDA"] += 1
                continue
            reviewer, approver = str(r.get("id_revisor") or "").strip(), str(r.get("aprobado_por") or "").strip()
            if not reviewer:
                rejected["SIN_REVISOR"] += 1
                continue
            if not approver:
                rejected["SIN_APROBADOR"] += 1
                continue
            if approver == reviewer:
                rejected["APROBADOR_IGUAL_A_REVISOR"] += 1
                continue
            raw = r.get("evaluacion_idoneidad")
            if raw is not None and str(raw).strip().upper() == "NO_EVALUABLE":
                rejected["NO_EVALUABLE"] += 1
                continue
            val = _score(raw)
            if val is None:
                rejected["EVALUACION_FUERA_DE_DOMINIO"] += 1
                continue
            accepted.append({"id_revision": r["id_revision"], "student_id": str(r["id_estudiante"]), "vacancy_id": str(r["id_plaza"]),
                             "period": str(r["periodo"]), "value": val, "source": LABEL_SOURCE, "reviewer": reviewer, "approver": approver,
                             "review_date": str(r.get("fecha_revision") or ""), "run_id": meta.get("run_id"), "context": r.get("contexto"),
                             "blind": meta.get("modo_ciego") == "SI"})
    # several reviewers on the same pair -> mean; disagreement flagged
    by_pair = defaultdict(list)
    for a in accepted:
        by_pair[(a["student_id"], a["vacancy_id"], a["period"])].append(a)
    labels = []
    disagreements = 0
    for (sid, vid, per), items in sorted(by_pair.items()):
        vals = [i["value"] for i in items]
        if max(vals) - min(vals) >= 0.5:
            disagreements += 1
        labels.append({"student_id": sid, "vacancy_id": vid, "period": per, "value": round(sum(vals) / len(vals), 4), "source": LABEL_SOURCE,
                       "n_revisores": len({i["reviewer"] for i in items}), "desacuerdo": max(vals) - min(vals) >= 0.5,
                       "ciego": all(i["blind"] for i in items), "run_ids": sorted({i["run_id"] for i in items})})
    store.mkdir(parents=True, exist_ok=True)
    idx_path = store / "feedback_index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.exists() else {"schema": FEEDBACK_SCHEMA, "versions": []}
    version = len(idx["versions"]) + 1
    payload = {"schema": FEEDBACK_SCHEMA, "version": version, "imported_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
               "sources": sources, "labels": labels,
               "report": {"filas_aceptadas": len(accepted), "parejas_etiquetadas": len(labels), "rechazos": dict(rejected),
                          "parejas_con_desacuerdo": disagreements, "comentarios_no_almacenados": comments}}
    digest = hashlib.sha256(json.dumps(payload["labels"], sort_keys=True).encode()).hexdigest()[:12]
    fname = f"feedback_v{version:04d}_{digest}.json"
    (store / fname).write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    idx["versions"].append({"version": version, "file": fname, "sha_labels": digest, "imported_utc": payload["imported_utc"], **payload["report"]})
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"version": version, "file": str(store / fname), **payload["report"]}


def load_feedback_labels(store_dir: str | Path, up_to_version: int | None = None) -> tuple[list[Label], dict]:
    """All approved labels up to a version (later versions override the same pair). Returns (labels, provenance)."""
    store = Path(store_dir)
    idx_path = store / "feedback_index.json"
    if not idx_path.exists():
        return [], {"versions": []}
    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    latest: dict[tuple, dict] = {}
    used = []
    for v in idx["versions"]:
        if up_to_version and v["version"] > up_to_version:
            break
        data = json.loads((store / v["file"]).read_text(encoding="utf-8"))
        if hashlib.sha256(json.dumps(data["labels"], sort_keys=True).encode()).hexdigest()[:12] != v["sha_labels"]:
            raise FeedbackError(f"Versión {v['version']} alterada (huella distinta).")
        used.append({"version": v["version"], "file": v["file"], "sha_labels": v["sha_labels"]})
        for lb in data["labels"]:
            latest[(lb["student_id"], lb["vacancy_id"], lb["period"])] = lb
    labels = [Label(l["student_id"], l["vacancy_id"], l["period"], float(l["value"]), l["source"]) for l in latest.values()]
    return labels, {"versions": used, "parejas": len(labels)}
