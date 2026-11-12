"""Phase 5: reconcile actual SIGA enrollments (imported later) with direct placements and capacity.

Institutional enrollments are facts: the engine never deletes or moves them. It classifies each one,
flags conflicts (double allocation, over-capacity, non-publishable plaza, program mismatch) for
human review and, when a previous match output is given, measures where the chosen plaza ranked in
the student's recommendations. That rank is *monitoring feedback*, not a suitability label.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from .constraints import program_relation
from .pipeline import MatchResult
from .policy import Policy
from .schema import InputBundle


def reconcile(bundle: InputBundle, enrollments, period: str, policy: Policy, previous_recs: list[dict] | None = None,
              run_timestamp: str | None = None) -> MatchResult:
    students = {s.student_id: s for s in bundle.students if s.period == period}
    vacancies = {v.vacancy_id: v for v in bundle.vacancies if v.period == period}
    active = set(policy["active_enrollment_statuses"])
    enr = sorted((e for e in enrollments if e.period == period), key=lambda e: (e.student_id, e.vacancy_id))
    direct_confirmed = {d.student_id: d.confirmed_vacancy_id for d in bundle.decisions
                        if d.period == period and d.approval_status == "APROBADO" and d.placement_confirmed and d.confirmed_vacancy_id}
    rec_rank: dict[tuple[str, str], int] = {}
    rec_students: set[str] = set()
    for r in previous_recs or []:
        rec_rank[(str(r["id_estudiante"]), str(r["id_plaza"]))] = int(r["rango"])
        rec_students.add(str(r["id_estudiante"]))

    occupied = Counter(direct_confirmed.values())
    per_student = Counter(e.student_id for e in enr if (e.status or "") in active)
    rows = []
    for e in enr:
        flags = []
        v = vacancies.get(e.vacancy_id)
        s = students.get(e.student_id)
        is_active = (e.status or "") in active
        if not is_active:
            flags.append("MATRICULA_NO_ACTIVA")
        if s is None:
            flags.append("ESTUDIANTE_NO_ENCONTRADO")
        if v is None:
            flags.append("PLAZA_NO_ENCONTRADA")
        if is_active and per_student[e.student_id] > 1:
            flags.append("DOBLE_MATRICULA")
        if is_active and e.student_id in direct_confirmed and direct_confirmed[e.student_id] != e.vacancy_id:
            flags.append("DOBLE_ASIGNACION_CON_DIRECTA")
        if v is not None and is_active:
            if v.vacancy_type not in policy["siga_vacancy_types"] or v.status not in policy["allowed_vacancy_statuses"]:
                flags.append("PLAZA_NO_PUBLICABLE_SIGA")
            if s is not None and policy["program_profile_rule"] == "hard" and program_relation(s, v) == "none":
                flags.append("PROGRAMA_FUERA_DE_PERFIL")
            if not (e.student_id in direct_confirmed and direct_confirmed[e.student_id] == e.vacancy_id):
                occupied[e.vacancy_id] += 1
        rank = rec_rank.get((e.student_id, e.vacancy_id))
        rows.append({
            "id_estudiante": e.student_id, "id_plaza": e.vacancy_id, "estado_siga": e.status,
            "estado_conciliacion": "CONFIRMADA_SIGA" if is_active and not flags else ("REVISION_HUMANA" if flags and is_active else "NO_ACTIVA"),
            "alertas": ",".join(flags),
            "rango_en_recomendaciones": rank,
            "estaba_en_top_k": None if previous_recs is None or e.student_id not in rec_students else ("SI" if rank else "NO"),
        })
    over = {vid for vid, n in occupied.items() if vid in vacancies and n > vacancies[vid].capacity}
    for r in rows:
        if r["id_plaza"] in over and r["estado_conciliacion"] != "NO_ACTIVA":
            r["alertas"] = ",".join(filter(None, [r["alertas"], "SOBRECUPO_PLAZA"]))
            r["estado_conciliacion"] = "REVISION_HUMANA"
    plazas = [{"id_plaza": vid, "cupos_originales": v.capacity, "ocupados_total": occupied[vid],
               "cupos_restantes": max(0, v.capacity - occupied[vid]), "sobrecupo": "SI" if vid in over else "NO"}
              for vid, v in sorted(vacancies.items())]
    enrolled_or_direct = {r["id_estudiante"] for r in rows if r["estado_conciliacion"] != "NO_ACTIVA"} | set(direct_confirmed)
    pendientes = [{"id_estudiante": sid, "estado": "SIN_MATRICULA_NI_DIRECTA_CONFIRMADA"} for sid in sorted(students) if sid not in enrolled_or_direct]
    hits = [r for r in rows if r["estaba_en_top_k"] in ("SI", "NO")]
    summary = {
        "periodo": period,
        "fecha_conciliacion_utc": run_timestamp or datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "matriculas_recibidas": len(rows),
        "confirmadas_siga": sum(r["estado_conciliacion"] == "CONFIRMADA_SIGA" for r in rows),
        "requieren_revision": sum(r["estado_conciliacion"] == "REVISION_HUMANA" for r in rows),
        "plazas_con_sobrecupo": len(over),
        "estudiantes_sin_ubicacion": len(pendientes),
        "tasa_eleccion_en_top_k": round(sum(r["estaba_en_top_k"] == "SI" for r in hits) / len(hits), 4) if hits else None,
        "nota": "La tasa de elección en top-k es monitoreo; no es una etiqueta de idoneidad (sesgo de selección SIGA).",
        "politica_id": policy["policy_id"],
    }
    res = MatchResult(summary=summary)
    res.tables = {"Conciliacion_SIGA": rows, "Plazas_Conciliadas": plazas, "Estudiantes_Sin_Ubicacion": pendientes}
    return res
