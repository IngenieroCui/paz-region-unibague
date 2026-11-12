"""Batch matching pipeline (phases 1-4 and 6 of the institutional flow; phase 5 lives in reconcile.py).

1. Validate cleaned inputs for the requested period (schema, unique IDs, references).
2. Lock institutionally confirmed placements (direct confirmed + SIGA enrollments already recorded).
3. Approved direct cases without an exact placement: hard constraints + capacity-aware optimiser ->
   PROPOSALS that still need institutional approval. Infeasible -> REQUIERE_GESTION_HUMANA.
4. Remaining (published) capacity -> ranked, non-binding SIGA recommendations per student and a
   suitability ranking per plaza. Optional, explicitly labelled simulation of a general assignment.
6. Structured result (tables + summary) that io_excel / JSON adapters export.

Nothing here approves a special case, selects a call winner, or enrolls a student.
"""
from __future__ import annotations

import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone

from . import __version__
from .audit import audit_result
from .constraints import BLOCKER_TEXT, check_pair
from .optimizer import Edge, min_cost_assignment
from .policy import Policy
from .schema import OUTPUT_SCHEMA_VERSION, DirectDecision, InputBundle, Student, Vacancy
from .scoring import PairScore, backend_texts, score_pair
from .semantic import build_backend


class ValidationFailed(Exception):
    def __init__(self, issues: list[dict]):
        self.issues = issues
        super().__init__(f"{len(issues)} problema(s) de validación bloqueante(s).")


@dataclass
class MatchResult:
    tables: dict[str, list[dict]] = field(default_factory=dict)
    summary: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def to_json_dict(self) -> dict:
        return {"schema_version": OUTPUT_SCHEMA_VERSION, "summary": self.summary, "warnings": self.warnings, "tables": self.tables}


# ------------------------------------------------------------------------------------------------
# Phase 1: validation
# ------------------------------------------------------------------------------------------------

def validate(bundle: InputBundle, period: str, policy: Policy) -> tuple[list[dict], list[str]]:
    """Return (blocking issues, warnings). Messages carry IDs/rows/codes only, never personal values."""
    issues: list[dict] = []
    warnings: list[str] = []
    st = [s for s in bundle.students if s.period == period]
    vc = [v for v in bundle.vacancies if v.period == period]
    if not st:
        issues.append({"code": "SIN_ESTUDIANTES_EN_PERIODO", "sheet": "Estudiantes", "detail": period})
    if not vc:
        issues.append({"code": "SIN_PLAZAS_EN_PERIODO", "sheet": "Plazas", "detail": period})
    for name, recs, key in (("Estudiantes", st, "student_id"), ("Plazas", vc, "vacancy_id")):
        for dup, n in Counter(getattr(r, key) for r in recs).items():
            if n > 1:
                srcs = sorted({r.source for r in recs if getattr(r, key) == dup and r.source})
                issue = {"code": "ID_DUPLICADO", "sheet": name, "id": dup}
                if srcs:
                    issue["fuentes"] = "; ".join(srcs)  # file::sheet::row, never cell contents
                issues.append(issue)
    for v in vc:
        if not isinstance(v.capacity, int) or v.capacity < 0:
            issues.append({"code": "CUPOS_INVALIDOS", "sheet": "Plazas", "id": v.vacancy_id})
    sids = {s.student_id for s in st}
    vids = {v.vacancy_id for v in vc}
    dec = [d for d in bundle.decisions if d.period == period]
    for dup, n in Counter(d.student_id for d in dec).items():
        if n > 1:
            issues.append({"code": "DECISION_DIRECTA_DUPLICADA", "sheet": "Decisiones_Directas", "id": dup})
    for d in dec:
        if d.student_id not in sids:
            issues.append({"code": "DECISION_SIN_ESTUDIANTE", "sheet": "Decisiones_Directas", "id": d.student_id, "row": d.row})
    active = set(policy["active_enrollment_statuses"])
    enr = [e for e in bundle.enrollments if e.period == period and (e.status or "") in active]
    for dup, n in Counter(e.student_id for e in enr).items():
        if n > 1:
            issues.append({"code": "MATRICULA_DUPLICADA", "sheet": "Matriculas_SIGA", "id": dup})
    for e in enr:
        if e.vacancy_id not in vids:
            issues.append({"code": "MATRICULA_PLAZA_INEXISTENTE", "sheet": "Matriculas_SIGA", "id": e.student_id, "row": e.row})
        if e.student_id not in sids:
            issues.append({"code": "MATRICULA_SIN_ESTUDIANTE", "sheet": "Matriculas_SIGA", "id": e.student_id, "row": e.row})
    other = sum(1 for s in bundle.students if s.period != period) + sum(1 for v in bundle.vacancies if v.period != period)
    if other:
        warnings.append(f"OTROS_PERIODOS_IGNORADOS: {other} registro(s) de periodos distintos a {period} no se usan.")
    return issues, warnings


# ------------------------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------------------------

def _vac_cols(v: Vacancy) -> dict:
    return {
        "id_plaza": v.vacancy_id,
        "id_proyecto": v.project_id,
        "proyecto": v.project_name,
        "organizacion": v.organization_name,
        "municipio": v.municipality,
        "modalidad": v.modality,
        "tipo_plaza": v.vacancy_type,
        "perfil_programa": v.program_profile,
    }


def _blocker_summary(blocks: Counter) -> str:
    if not blocks:
        return "Sin plazas evaluables."
    return "; ".join(f"{code} x{n}" for code, n in sorted(blocks.items(), key=lambda x: (-x[1], x[0])))


def _rank_key(ps: PairScore):
    return (-(ps.total or 0.0), ps.vacancy_id)


# ------------------------------------------------------------------------------------------------
# Main entry
# ------------------------------------------------------------------------------------------------

def run_match(
    bundle: InputBundle,
    period: str,
    policy: Policy,
    *,
    semantic_override: str | None = None,
    encoder=None,
    model=None,
    behavior_model=None,
    simulate_general_assignment: bool = False,
    pairs_detail: str = "top",
    run_timestamp: str | None = None,
) -> MatchResult:
    t0 = time.perf_counter()
    _check_model_compatibility(policy, model, behavior_model)
    issues, warnings = validate(bundle, period, policy)
    if issues:
        raise ValidationFailed(issues)
    warnings = list(bundle.load_warnings) + warnings

    students = sorted((s for s in bundle.students if s.period == period), key=lambda s: s.student_id)
    vacancies = sorted((v for v in bundle.vacancies if v.period == period), key=lambda v: v.vacancy_id)
    smap = {s.student_id: s for s in students}
    vmap = {v.vacancy_id: v for v in vacancies}
    decisions = {d.student_id: d for d in bundle.decisions if d.period == period}
    active = set(policy["active_enrollment_statuses"])
    enrollments = sorted((e for e in bundle.enrollments if e.period == period and (e.status or "") in active), key=lambda e: e.student_id)

    backend, sem_warn = build_backend(policy, semantic_override, encoder=encoder)
    warnings += sem_warn
    backend.prepare(backend_texts(policy, students, vacancies))
    threshold = policy["minimum_recommended_score"]

    capacity = {v.vacancy_id: v.capacity for v in vacancies}
    occ_confirmed_direct: Counter = Counter()
    occ_siga: Counter = Counter()
    occ_proposed: Counter = Counter()

    directas: list[dict] = []
    sin_asignacion: list[dict] = []
    pairs_out: list[dict] = []
    placed: set[str] = set()

    def remaining(vid: str) -> int:
        return max(0, capacity[vid] - occ_confirmed_direct[vid] - occ_siga[vid] - (occ_proposed[vid] if policy["reserve_proposed_direct_capacity"] else 0))

    def unplaced(s_id: str, estado: str, codigo: str, siguiente: str, flujo: str, detalle: str = ""):
        sin_asignacion.append({"id_estudiante": s_id, "flujo": flujo, "estado": estado, "codigo_motivo": codigo, "detalle": detalle, "siguiente_paso": siguiente})

    # ---- Phase 2a: SIGA enrollments already confirmed by the institution ---------------------
    siga_enrolled: dict[str, str] = {}
    for e in enrollments:
        siga_enrolled[e.student_id] = e.vacancy_id
        occ_siga[e.vacancy_id] += 1
        placed.add(e.student_id)

    # ---- Phase 2b: confirmed direct placements (frozen) ---------------------------------------
    approved_open: list[DirectDecision] = []
    for sid in sorted(decisions):
        d = decisions[sid]
        s = smap[sid]
        flow = d.direct_type or "DESCONOCIDO"
        if d.direct_type is None:
            unplaced(sid, "REQUIERE_GESTION_HUMANA", "TIPO_DIRECTA_DESCONOCIDO", "Registrar el tipo de asignación directa aprobado.", flow)
            continue
        if d.approval_status not in ("APROBADO", "PENDIENTE", "RECHAZADO"):
            unplaced(sid, "PENDIENTE_APROBACION_INSTITUCIONAL", "ESTADO_APROBACION_DESCONOCIDO", "Registrar la decisión institucional (APROBADO/PENDIENTE/RECHAZADO); no se asume aprobación.", flow)
            continue
        if d.approval_status == "PENDIENTE":
            unplaced(sid, "PENDIENTE_APROBACION_INSTITUCIONAL", "DECISION_PENDIENTE", "Esperar la decisión del comité/coordinación; no se generan propuestas.", flow)
            continue
        if d.approval_status == "RECHAZADO":
            continue  # handled as an ordinary elective student below
        if sid in siga_enrolled:
            unplaced(sid, "REQUIERE_GESTION_HUMANA", "DOBLE_ASIGNACION_DIRECTA_Y_SIGA", "Resolver si prevalece la directa o la matrícula SIGA.", flow, f"SIGA: {siga_enrolled[sid]}")
            continue
        if d.placement_confirmed and d.confirmed_vacancy_id:
            v = vmap.get(d.confirmed_vacancy_id)
            if v is None:
                unplaced(sid, "REQUIERE_GESTION_HUMANA", "PLAZA_CONFIRMADA_INEXISTENTE", "Corregir el ID de plaza confirmada (no existe en el periodo).", flow, d.confirmed_vacancy_id)
                continue
            checks = check_pair(s, v, policy, period, flow, d)
            over = remaining(v.vacancy_id) <= 0
            occ_confirmed_direct[v.vacancy_id] += 1
            placed.add(sid)
            if over:
                warnings.append(f"CONFIRMADA_EXCEDE_CUPOS: plaza {v.vacancy_id} supera sus cupos con asignaciones confirmadas; requiere revisión humana.")
            ps = score_pair(s, v, policy, backend, [], model, behavior_model)
            directas.append({
                "id_estudiante": sid, **_vac_cols(v), "tipo_directa": d.direct_type,
                "estado": "CONFIRMADA_FIJA", "es_asignacion_real": "SI",
                "compatibilidad": ps.total, "cobertura_evidencia": round(ps.coverage, 4), "confianza_evidencia": ps.confidence,
                "verificacion_reglas": "OK" if not checks else "ALERTA: " + ",".join(checks),
                "excede_cupos": "SI" if over else "NO",
                "explicacion": "Ubicación confirmada por la institución; el motor no la modifica. " + ps.explanation,
            })
            if pairs_detail != "none":
                pairs_out.append(_pair_row(ps, "DIRECTA_CONFIRMADA", period))
            continue
        approved_open.append(d)

    # ---- Phase 3: approved direct cases without exact placement -> proposals -----------------
    direct_edges: list[Edge] = []
    direct_reason: dict[str, tuple[str, str, str]] = {}
    direct_scores: dict[tuple[str, str], PairScore] = {}
    for d in approved_open:
        sid, flow = d.student_id, d.direct_type
        s = smap[sid]
        if d.direct_type in policy["direct_types_requiring_exact_vacancy"] and not d.confirmed_vacancy_id:
            direct_reason[sid] = ("REQUIERE_GESTION_HUMANA", "CONVOCATORIA_SIN_PLAZA_SELECCIONADA", "La selección de convocatorias es institucional: registrar la plaza seleccionada.")
            continue
        if d.direct_type in policy["direct_types_requiring_approved_municipality"] and not d.approved_municipality:
            direct_reason[sid] = ("REQUIERE_GESTION_HUMANA", "MUNICIPIO_APROBADO_FALTANTE", "Registrar el municipio aprobado; el motor no infiere restricciones territoriales.")
            continue
        targets = [vmap[d.confirmed_vacancy_id]] if d.confirmed_vacancy_id and d.confirmed_vacancy_id in vmap else ([] if d.confirmed_vacancy_id else vacancies)
        if d.confirmed_vacancy_id and not targets:
            direct_reason[sid] = ("REQUIERE_GESTION_HUMANA", "PLAZA_OBJETIVO_INEXISTENTE", "Corregir el ID de la plaza aprobada.")
            continue
        blocks: Counter = Counter()
        for v in targets:
            b = check_pair(s, v, policy, period, flow, d, remaining(v.vacancy_id))
            if b:
                blocks.update(b)
                continue
            ps = score_pair(s, v, policy, backend, [], model, behavior_model)
            direct_scores[(sid, v.vacancy_id)] = ps
            direct_edges.append(Edge(sid, v.vacancy_id, ps.total))
        if not any(e.student_id == sid for e in direct_edges):
            direct_reason[sid] = (
                "REQUIERE_GESTION_HUMANA",
                "SIN_PLAZA_COMPATIBLE_CON_RESTRICCIONES_APROBADAS",
                "Gestionar una plaza que cumpla las restricciones aprobadas; no se violan restricciones. Bloqueos: " + _blocker_summary(blocks),
            )
    open_ids = [d.student_id for d in approved_open if d.student_id not in direct_reason]
    chosen = min_cost_assignment(open_ids, {v.vacancy_id: remaining(v.vacancy_id) for v in vacancies}, direct_edges)
    chosen_by_student = {e.student_id: e for e in chosen}
    for d in approved_open:
        sid = d.student_id
        if sid in direct_reason:
            estado, code, nxt = direct_reason[sid]
            unplaced(sid, estado, code, nxt, d.direct_type)
            continue
        e = chosen_by_student.get(sid)
        if e is None:
            unplaced(sid, "REQUIERE_GESTION_HUMANA", "CUPOS_AGOTADOS_ENTRE_DIRECTAS", "Las plazas compatibles con sus restricciones quedaron ocupadas por el óptimo global de directas; gestionar cupo adicional.", d.direct_type)
            continue
        v = vmap[e.vacancy_id]
        ps = direct_scores[(sid, v.vacancy_id)]
        occ_proposed[v.vacancy_id] += 1
        alternatives = sum(1 for x in direct_edges if x.student_id == sid)
        directas.append({
            "id_estudiante": sid, **_vac_cols(v), "tipo_directa": d.direct_type,
            "estado": "PROPUESTA_REQUIERE_APROBACION", "es_asignacion_real": "NO",
            "compatibilidad": ps.total, "cobertura_evidencia": round(ps.coverage, 4), "confianza_evidencia": ps.confidence,
            "verificacion_reglas": "OK", "excede_cupos": "NO",
            "explicacion": f"Propuesta del optimizador entre {alternatives} plaza(s) que cumplen las restricciones aprobadas. " + ps.explanation,
        })
    if pairs_detail != "none":
        for key in sorted(direct_scores):
            pairs_out.append(_pair_row(direct_scores[key], "DIRECTA_PROPUESTA_CANDIDATA", period))

    # ---- Phase 4: SIGA electivity recommendations ---------------------------------------------
    excluded_pending = {sid for sid, d in decisions.items() if d.approval_status != "RECHAZADO"}
    if policy.get("pending_direct_receive_siga_recommendations"):
        excluded_pending = {sid for sid, d in decisions.items() if d.approval_status == "APROBADO"}
    electives = [s for s in students if s.student_id not in placed and s.student_id not in excluded_pending]
    published = [v for v in vacancies if v.vacancy_type in policy["siga_vacancy_types"]]
    recs: list[dict] = []
    per_vacancy: dict[str, list[PairScore]] = defaultdict(list)
    sim_edges: list[Edge] = []
    top_k = policy["top_k"]
    for s in electives:
        if not s.eligible:
            unplaced(s.student_id, "SIN_RECOMENDACION", "ESTUDIANTE_NO_HABILITADO", "Verificar habilitación académica para el periodo.", "SIGA")
            continue
        scored: list[PairScore] = []
        blocks: Counter = Counter()
        for v in published:
            b = check_pair(s, v, policy, period, "SIGA", None, remaining(v.vacancy_id))
            if b:
                blocks.update(b)
                continue
            scored.append(score_pair(s, v, policy, backend, [], model, behavior_model))
        scored.sort(key=_rank_key)
        if not scored:
            unplaced(s.student_id, "SIN_RECOMENDACION", "SIN_OPCIONES_ELEGIBLES", "Revisar oferta de plazas para su programa o gestionar plaza.", "SIGA", _blocker_summary(blocks))
            continue
        for rank, ps in enumerate(scored[:top_k], start=1):
            v = vmap[ps.vacancy_id]
            recs.append({
                "id_estudiante": s.student_id, "rango": rank, **_vac_cols(v),
                "cupos_restantes_al_ejecutar": remaining(v.vacancy_id),
                "compatibilidad": ps.total, "sobre_umbral": "SI" if ps.total >= threshold else "NO",
                "cobertura_evidencia": round(ps.coverage, 4), "confianza_evidencia": ps.confidence,
                "tipo_resultado": "RECOMENDACION_NO_VINCULANTE",
                "componentes_sin_evidencia": ",".join(k for k in ps.missing if k != "historical") or None,
                "alertas": ",".join(ps.flags) or None,
                "explicacion": ps.explanation,
            })
            if pairs_detail == "top":
                pairs_out.append(_pair_row(ps, "SIGA_RECOMENDADA", period))
        if pairs_detail == "all":
            for ps in scored:
                pairs_out.append(_pair_row(ps, "SIGA_EVALUADA", period))
        for ps in scored:
            per_vacancy[ps.vacancy_id].append(ps)
            sim_edges.append(Edge(ps.student_id, ps.vacancy_id, ps.total))

    idoneidad: list[dict] = []
    for vid in sorted(per_vacancy):
        ranked = sorted(per_vacancy[vid], key=lambda p: (-(p.total or 0), -p.coverage, p.student_id))[: policy.get("top_k_students_per_vacancy", 10)]
        for rank, ps in enumerate(ranked, start=1):
            idoneidad.append({"id_plaza": vid, "rango": rank, "id_estudiante": ps.student_id, "compatibilidad": ps.total,
                              "cobertura_evidencia": round(ps.coverage, 4), "confianza_evidencia": ps.confidence, "tipo_resultado": "IDONEIDAD_INFORMATIVA"})

    simulacion: list[dict] = []
    if simulate_general_assignment:
        chosen_sim = min_cost_assignment([s.student_id for s in electives], {v.vacancy_id: remaining(v.vacancy_id) for v in published}, sim_edges)
        for e in chosen_sim:
            simulacion.append({"id_estudiante": e.student_id, "id_plaza": e.vacancy_id, "compatibilidad": e.score, "tipo_resultado": "SIMULACION_NO_VINCULANTE"})

    # ---- Capacities ---------------------------------------------------------------------------
    plazas: list[dict] = []
    for v in vacancies:
        plazas.append({
            **_vac_cols(v), "estado_plaza": v.status, "periodo": v.period,
            "cupos_originales": v.capacity, "ocupados_directa_confirmada": occ_confirmed_direct[v.vacancy_id],
            "ocupados_siga_confirmada": occ_siga[v.vacancy_id], "reservados_directa_propuesta": occ_proposed[v.vacancy_id],
            "cupos_restantes": remaining(v.vacancy_id),
            "publicable_siga": "SI" if v.vacancy_type in policy["siga_vacancy_types"] and v.status in policy["allowed_vacancy_statuses"] else "NO",
        })

    # ---- Summary ------------------------------------------------------------------------------
    def cov(items, attr):
        return round(sum(1 for x in items if getattr(x, attr)) / len(items), 4) if items else 0.0

    estados = Counter(r["estado"] for r in directas) + Counter(r["estado"] for r in sin_asignacion)
    summary = {
        "periodo": period,
        "fecha_ejecucion_utc": run_timestamp or datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "version_motor": __version__,
        "version_algoritmo": policy["algorithm_version"] + (f"+{model.model_id}" if model else ""),
        "modelo_supervisado": model.model_id if model else "NINGUNO (no entrenado; línea base explicable)",
        "modelo_comportamiento_historico": (behavior_model.model_id + " (EXPERIMENTAL; peso " + f"{policy.weights.get('historical', 0):g})") if behavior_model else "NINGUNO",
        "componentes_entrenados": "re-ranqueador supervisado " + model.model_id if model else "ninguno: pesos configurados manualmente (provisionales), no aprendidos",
        "politica_id": policy["policy_id"],
        "politica_estado": policy.get("policy_status"),
        "politica_huella": policy.fingerprint,
        "esquema_salida": OUTPUT_SCHEMA_VERSION,
        "backend_semantico": backend.name,
        "backend_semantico_version": backend.version,
        "estudiantes_periodo": len(students),
        "plazas_periodo": len(vacancies),
        "cupos_totales": sum(capacity.values()),
        "matriculas_siga_previas": len(enrollments),
        "directas_confirmadas": estados["CONFIRMADA_FIJA"],
        "directas_propuestas": estados["PROPUESTA_REQUIERE_APROBACION"],
        "requieren_gestion_humana": estados["REQUIERE_GESTION_HUMANA"],
        "pendientes_aprobacion": estados["PENDIENTE_APROBACION_INSTITUCIONAL"],
        "estudiantes_electivos": len(electives),
        "estudiantes_con_recomendacion": len({r["id_estudiante"] for r in recs}),
        "sin_opciones_elegibles": sum(1 for r in sin_asignacion if r["codigo_motivo"] == "SIN_OPCIONES_ELEGIBLES"),
        "cupos_restantes_siga": sum(remaining(v.vacancy_id) for v in published),
        "simulacion_general": "SI (no vinculante)" if simulate_general_assignment else "NO",
        "cobertura_estudiantes_programa": cov(students, "academic_program"),
        "cobertura_estudiantes_expectativas": cov(students, "expectations_text"),
        "cobertura_estudiantes_aprendizajes": cov(students, "learning_goals_text"),
        "cobertura_estudiantes_habilidades": cov(students, "skills_text"),
        "cobertura_estudiantes_intereses": cov(students, "interests_text"),
        "cobertura_estudiantes_trabajo_deseado": cov(students, "desired_work_text"),
        "cobertura_estudiantes_municipio_origen": cov(students, "origin_municipality"),
        "cobertura_plazas_perfil": cov(vacancies, "program_profile"),
        "cobertura_plazas_descripcion": cov(vacancies, "project_description"),
        "cobertura_plazas_requisitos": cov(vacancies, "requirements_text"),
        "cobertura_plazas_necesidades_org": cov(vacancies, "org_needs_text"),
        "cobertura_plazas_municipio": cov(vacancies, "municipality"),
        "cobertura_plazas_modalidad": cov(vacancies, "modality"),
        "pesos_configurados": ", ".join(f"{k}={v:g}" for k, v in policy.weights.items()),
        "umbral_provisional": threshold,
        "regla_perfil_programa": policy["program_profile_rule"],
        "violaciones_restricciones_duras": 0,
        "archivos_fuente_sha256": "; ".join(f"{k}={v}" for k, v in sorted(bundle.source_files.items())),
        "advertencias": len(warnings),
    }
    result = MatchResult(warnings=warnings, summary=summary)
    result.tables = {
        "Asignaciones_Directas": sorted(directas, key=lambda r: (r["estado"], r["id_estudiante"])),
        "Recomendaciones_SIGA": recs,
        "Idoneidad_Por_Plaza": idoneidad,
        "Plazas_Disponibles": plazas,
        "Sin_Asignacion": sorted(sin_asignacion, key=lambda r: (r["estado"], r["id_estudiante"])),
        "Pares_Evaluados": pairs_out,
    }
    if simulate_general_assignment:
        result.tables["Simulacion_No_Vinculante"] = sorted(simulacion, key=lambda r: r["id_estudiante"])

    # Defensive invariants. (1) legacy bookkeeping check; (2) independent recomputation from inputs that
    # separates institutional (historical) conflicts from engine-generated violations.
    legacy = _audit(directas, simulacion, plazas, capacity)
    audit_rows, audit_counts = audit_result(bundle, period, policy, result.tables)
    summary.update(audit_counts)
    summary["violaciones_restricciones_duras"] = audit_counts["violaciones_generadas_por_motor"] + len(legacy)
    if legacy or audit_counts["violaciones_generadas_por_motor"]:  # pragma: no cover - would be an engine bug
        raise AssertionError("Invariante violado: " + "; ".join(legacy + [f"{r['codigo']} {r['id_estudiante']} {r['id_plaza']}" for r in audit_rows if r["origen"] == "GENERADO_POR_MOTOR"]))
    result.tables["Auditoria_Restricciones"] = audit_rows
    summary["duracion_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    return result


def _check_model_compatibility(policy: Policy, model, behavior_model) -> None:
    """A model can only re-score pairs for the algorithm/feature schema it was trained on, and a
    historical-BEHAVIOUR model can never act as the suitability re-ranker (and vice versa)."""
    if model is not None:
        track = getattr(model, "track", "suitability")
        if track != "suitability":
            raise ValueError(f"MODELO_NO_ES_DE_IDONEIDAD: el modelo {model.model_id} es de pista '{track}'; no puede usarse como re-ranqueador de idoneidad.")
        base = getattr(model, "algorithm_base", None)
        if base and base != policy["algorithm_version"]:
            raise ValueError(f"MODELO_INCOMPATIBLE: {model.model_id} fue entrenado sobre {base}, la política usa {policy['algorithm_version']}.")
    if behavior_model is not None:
        if getattr(behavior_model, "track", None) != "behavior":
            raise ValueError("El modelo de comportamiento histórico debe tener pista 'behavior'.")
        if policy["algorithm_version"] != "hybrid-pyr-v0.3":
            raise ValueError("La señal histórica solo existe en hybrid-pyr-v0.3.")


def _pair_row(ps: PairScore, contexto: str, period: str) -> dict:
    row = {"id_estudiante": ps.student_id, "id_plaza": ps.vacancy_id, "contexto": contexto, "periodo": period,
           "elegible": "SI" if ps.eligible else "NO", "compatibilidad": ps.total, "cobertura_evidencia": round(ps.coverage, 4),
           "confianza_evidencia": ps.confidence}
    for k, v in ps.raw.items():
        row[f"c_{k}"] = None if v is None else round(v, 4)
    for k, v in ps.effective.items():
        row[f"peso_efectivo_{k}"] = round(v, 4)
    row["bloqueos"] = ",".join(ps.blockers)
    row["modelo"] = ps.model_id or ""
    row["sin_evidencia"] = ",".join(k for k in ps.missing if k != "historical") or None
    row["alertas"] = ",".join(ps.flags) or None
    return row


def _audit(directas, simulacion, plazas, capacity) -> list[str]:
    problems = []
    sim_used = Counter(r["id_plaza"] for r in simulacion)
    for p in plazas:
        if sim_used[p["id_plaza"]] > p["cupos_restantes"]:
            problems.append(f"simulación excede cupos {p['id_plaza']}")
        if p["cupos_restantes"] < 0:
            problems.append(f"cupos negativos {p['id_plaza']}")
    seen = Counter(r["id_estudiante"] for r in directas) + Counter(r["id_estudiante"] for r in simulacion)
    problems += [f"estudiante repetido {s}" for s, n in seen.items() if n > 1]
    for r in directas:
        if r["estado"] == "PROPUESTA_REQUIERE_APROBACION" and r["verificacion_reglas"] != "OK":
            problems.append(f"propuesta con bloqueo {r['id_estudiante']}")
    return problems


__all__ = ["run_match", "MatchResult", "ValidationFailed", "validate", "BLOCKER_TEXT"]
