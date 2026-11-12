"""Independent post-hoc audit of a match result.

v0.2 only checked a string column written by the pipeline itself (`verificacion_reglas`), and mixed
two very different things in one number. This module recomputes every rule FROM THE INPUTS, without
trusting pipeline bookkeeping, and reports two separate, independently verified metrics:

* `HISTORICO_INSTITUCIONAL` – conflicts already present in institutional decisions (confirmed direct
  placements, SIGA enrollments): over-capacity, out-of-profile, double allocation. The engine never
  moves these; it only reports them for human review. They are NOT engine errors.
* `GENERADO_POR_MOTOR` – any hard-rule or capacity violation in rows the engine produced (direct
  proposals, SIGA recommendations, simulation). This MUST be zero; a non-zero value is an engine bug
  and `run_match` refuses to return the result.
"""
from __future__ import annotations

from collections import Counter

from .constraints import check_pair
from .policy import Policy
from .schema import InputBundle

HIST = "HISTORICO_INSTITUCIONAL"
MOTOR = "GENERADO_POR_MOTOR"


def _row(origen, codigo, sid=None, vid=None, detalle=""):
    return {"origen": origen, "codigo": codigo, "id_estudiante": sid, "id_plaza": vid, "detalle": detalle}


def audit_result(bundle: InputBundle, period: str, policy: Policy, tables: dict[str, list[dict]]) -> tuple[list[dict], dict]:
    smap = {s.student_id: s for s in bundle.students if s.period == period}
    vmap = {v.vacancy_id: v for v in bundle.vacancies if v.period == period}
    decisions = {d.student_id: d for d in bundle.decisions if d.period == period}
    active = set(policy["active_enrollment_statuses"])
    enrollments = [e for e in bundle.enrollments if e.period == period and (e.status or "") in active]
    directas = tables.get("Asignaciones_Directas", [])
    recs = tables.get("Recomendaciones_SIGA", [])
    sim = tables.get("Simulacion_No_Vinculante", [])
    rows: list[dict] = []

    # ---------------- institutional (historical) facts -----------------------------------------
    confirmed = [r for r in directas if r["estado"] == "CONFIRMADA_FIJA"]
    inst_load: Counter = Counter()
    for e in enrollments:
        inst_load[e.vacancy_id] += 1
        s, v = smap.get(e.student_id), vmap.get(e.vacancy_id)
        if s and v:
            for b in check_pair(s, v, policy, period, "SIGA"):
                rows.append(_row(HIST, f"MATRICULA_SIGA_{b}", e.student_id, e.vacancy_id, "Matrícula institucional fuera de regla; no se modifica."))
    for r in confirmed:
        inst_load[r["id_plaza"]] += 1
        s, v, d = smap.get(r["id_estudiante"]), vmap.get(r["id_plaza"]), decisions.get(r["id_estudiante"])
        if s and v and d:
            for b in check_pair(s, v, policy, period, d.direct_type or "", d):
                rows.append(_row(HIST, f"DIRECTA_CONFIRMADA_{b}", s.student_id, v.vacancy_id, "Ubicación confirmada fuera de regla; no se modifica."))
    enrolled_students = {e.student_id for e in enrollments}
    for r in confirmed:
        if r["id_estudiante"] in enrolled_students:
            rows.append(_row(HIST, "DOBLE_ASIGNACION_INSTITUCIONAL", r["id_estudiante"], r["id_plaza"]))
    for vid, n in sorted(inst_load.items()):
        v = vmap.get(vid)
        if v is not None and n > v.capacity:
            rows.append(_row(HIST, "SOBRECUPO_INSTITUCIONAL", None, vid, f"{n} ocupados institucionales > {v.capacity} cupos"))

    # ---------------- engine-generated rows ----------------------------------------------------
    proposals = [r for r in directas if r["estado"] == "PROPUESTA_REQUIERE_APROBACION"]
    prop_load = Counter(r["id_plaza"] for r in proposals)
    for r in proposals:
        sid, vid = r["id_estudiante"], r["id_plaza"]
        s, v, d = smap.get(sid), vmap.get(vid), decisions.get(sid)
        if s is None or v is None or d is None:
            rows.append(_row(MOTOR, "PROPUESTA_SIN_REFERENCIA", sid, vid))
            continue
        if d.approval_status != "APROBADO":
            rows.append(_row(MOTOR, "PROPUESTA_SIN_APROBACION", sid, vid))
        if d.confirmed_vacancy_id and d.confirmed_vacancy_id != vid:
            rows.append(_row(MOTOR, "PROPUESTA_DISTINTA_A_PLAZA_APROBADA", sid, vid))
        if d.direct_type in policy["direct_types_requiring_exact_vacancy"] and not d.confirmed_vacancy_id:
            rows.append(_row(MOTOR, "CONVOCATORIA_SELECCIONADA_POR_MOTOR", sid, vid))
        for b in check_pair(s, v, policy, period, d.direct_type or "", d):
            rows.append(_row(MOTOR, f"PROPUESTA_{b}", sid, vid))
    for vid, n in sorted(prop_load.items()):
        v = vmap.get(vid)
        if v is not None and n > max(0, v.capacity - inst_load[vid]):
            rows.append(_row(MOTOR, "SOBRECUPO_GENERADO_PROPUESTAS", None, vid, f"{n} propuestas > {max(0, v.capacity - inst_load[vid])} cupos libres"))

    reserve = policy["reserve_proposed_direct_capacity"]
    def free_after_engine(vid):
        v = vmap[vid]
        return v.capacity - inst_load[vid] - (prop_load[vid] if reserve else 0)

    placed = {r["id_estudiante"] for r in directas} | enrolled_students
    excluded = {sid for sid, d in decisions.items() if d.approval_status != "RECHAZADO"}
    if policy.get("pending_direct_receive_siga_recommendations"):
        excluded = {sid for sid, d in decisions.items() if d.approval_status == "APROBADO"}
    for r in recs:
        sid, vid = r["id_estudiante"], r["id_plaza"]
        s, v = smap.get(sid), vmap.get(vid)
        if s is None or v is None:
            rows.append(_row(MOTOR, "RECOMENDACION_SIN_REFERENCIA", sid, vid))
            continue
        if r.get("tipo_resultado") != "RECOMENDACION_NO_VINCULANTE":
            rows.append(_row(MOTOR, "RECOMENDACION_PRESENTADA_COMO_VINCULANTE", sid, vid))
        if sid in placed or sid in excluded:
            rows.append(_row(MOTOR, "RECOMENDACION_A_ESTUDIANTE_NO_ELECTIVO", sid, vid))
        for b in check_pair(s, v, policy, period, "SIGA", None, free_after_engine(vid)):
            rows.append(_row(MOTOR, f"RECOMENDACION_{b}", sid, vid))
    sim_load = Counter(r["id_plaza"] for r in sim)
    for r in sim:
        sid, vid = r["id_estudiante"], r["id_plaza"]
        s, v = smap.get(sid), vmap.get(vid)
        if s is None or v is None:
            rows.append(_row(MOTOR, "SIMULACION_SIN_REFERENCIA", sid, vid))
            continue
        for b in check_pair(s, v, policy, period, "SIGA"):
            rows.append(_row(MOTOR, f"SIMULACION_{b}", sid, vid))
    for vid, n in sorted(sim_load.items()):
        if vid in vmap and n > max(0, free_after_engine(vid)):
            rows.append(_row(MOTOR, "SOBRECUPO_GENERADO_SIMULACION", None, vid))
    engine_students = Counter(r["id_estudiante"] for r in proposals) + Counter(r["id_estudiante"] for r in sim)
    for sid, n in engine_students.items():
        if n > 1 or (sid in {r["id_estudiante"] for r in confirmed} | enrolled_students):
            rows.append(_row(MOTOR, "ESTUDIANTE_ASIGNADO_MAS_DE_UNA_VEZ", sid))

    rows.sort(key=lambda r: (r["origen"], r["codigo"], r["id_estudiante"] or "", r["id_plaza"] or ""))
    counts = {
        "conflictos_historicos_institucionales": sum(1 for r in rows if r["origen"] == HIST),
        "violaciones_generadas_por_motor": sum(1 for r in rows if r["origen"] == MOTOR),
        "auditoria_independiente": "SI (reglas recalculadas desde los insumos)",
    }
    return rows, counts
