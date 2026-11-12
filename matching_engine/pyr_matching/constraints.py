"""Deterministic eligibility layer. Runs BEFORE any scoring/optimisation; blocked edges never reach them.

Every rule is a switchable policy item (see docs/POLICY_DECISIONS.md). A hard rule only applies to the
extent the institutional data records it: e.g. a municipality restriction exists only when an approved
decision carries an approved municipality. Unknown values that a hard rule needs block the edge with a
`*_NO_VERIFICABLE` code instead of being guessed.
"""
from __future__ import annotations

from .policy import Policy, canon_modality, canon_place
from .schema import DirectDecision, Student, Vacancy

BLOCKER_TEXT = {
    "PERIODO_DISTINTO": "La plaza pertenece a otro periodo.",
    "PLAZA_NO_APROBADA": "El estado de la plaza no está habilitado por la política.",
    "TIPO_PLAZA_NO_HABILITADO": "El tipo de plaza no corresponde a este flujo (SIGA o tipo de directa).",
    "PROGRAMA_NO_COMPATIBLE": "El programa del estudiante no está en el perfil ni en el perfil alterno de la plaza.",
    "PROGRAMA_NO_VERIFICABLE": "Falta el programa del estudiante; la regla de perfil no puede verificarse.",
    "MUNICIPIO_RESTRINGIDO": "La plaza está fuera del municipio aprobado institucionalmente.",
    "MUNICIPIO_NO_VERIFICABLE": "La plaza no tiene municipio; no puede verificarse la restricción aprobada.",
    "MODALIDAD_RESTRINGIDA": "La modalidad de la plaza no está entre las modalidades aprobadas.",
    "MODALIDAD_NO_VERIFICABLE": "La plaza no tiene modalidad; no puede verificarse la restricción aprobada.",
    "ESTUDIANTE_NO_HABILITADO": "El estudiante no está habilitado para el periodo.",
    "SIN_CUPO": "La plaza no tiene cupos restantes.",
}


def program_relation(student: Student, vacancy: Vacancy) -> str:
    """'exact' | 'alt' | 'none' | 'unknown_vacancy' | 'unknown_student'."""
    profile = canon_place(vacancy.program_profile)
    alt = canon_place(vacancy.program_profile_alt)
    if not profile and not alt:
        return "unknown_vacancy"
    prog = canon_place(student.academic_program)
    if not prog:
        return "unknown_student"
    if prog == profile:
        return "exact"
    if prog == alt:
        return "alt"
    return "none"


def check_pair(
    student: Student,
    vacancy: Vacancy,
    policy: Policy,
    period: str,
    flow: str,
    decision: DirectDecision | None = None,
    remaining: int | None = None,
) -> list[str]:
    """Return blocker codes for (student, vacancy) in a flow: 'SIGA' or a direct type."""
    b: list[str] = []
    if vacancy.period != period:
        b.append("PERIODO_DISTINTO")
    if not student.eligible:
        b.append("ESTUDIANTE_NO_HABILITADO")
    if (vacancy.status or "") not in policy["allowed_vacancy_statuses"]:
        b.append("PLAZA_NO_APROBADA")
    allowed_types = policy["siga_vacancy_types"] if flow == "SIGA" else policy["direct_type_vacancy_types"].get(flow, [])
    if (vacancy.vacancy_type or "") not in allowed_types:
        b.append("TIPO_PLAZA_NO_HABILITADO")
    if policy["program_profile_rule"] == "hard":
        rel = program_relation(student, vacancy)
        if rel == "none":
            b.append("PROGRAMA_NO_COMPATIBLE")
        elif rel == "unknown_student":
            b.append("PROGRAMA_NO_VERIFICABLE")
    if decision is not None:
        if decision.approved_municipality:
            if not vacancy.municipality:
                b.append("MUNICIPIO_NO_VERIFICABLE")
            elif canon_place(vacancy.municipality) != canon_place(decision.approved_municipality):
                b.append("MUNICIPIO_RESTRINGIDO")
        if decision.approved_modalities:
            vm = canon_modality(vacancy.modality)
            if not vm:
                b.append("MODALIDAD_NO_VERIFICABLE")
            elif vm not in decision.approved_modalities:
                b.append("MODALIDAD_RESTRINGIDA")
    if remaining is not None and remaining <= 0:
        b.append("SIN_CUPO")
    return b
