"""Canonical logical schema (independent of institutional Excel headers).

Source headers are mapped onto these records by `pyr_matching.mapping`. Only the fields below
are ever loaded; every other column in an institutional workbook is ignored and never reaches
scoring, logs or outputs. Free-text fields are *professional* text only (see docs/FAIRNESS_PRIVACY.md).
"""
from __future__ import annotations

from dataclasses import dataclass, field

OUTPUT_SCHEMA_VERSION = "pyr-match-result/1.0"
FEATURE_SCHEMA_VERSION = "pyr-features/1.0"

# Direct (non-SIGA) categories documented in the AS-IS process. Never collapsed into "remote".
DIRECT_TYPES = ("CASO_ESPECIAL", "MUNICIPIO_ORIGEN", "CONVOCATORIA")
APPROVAL_STATES = ("APROBADO", "PENDIENTE", "RECHAZADO")


@dataclass(frozen=True)
class Student:
    student_id: str
    period: str
    academic_program: str | None = None
    origin_municipality: str | None = None
    eligible: bool = True
    # Professional free text. Historical terms only have the two pre-registration answers.
    expectations_text: str | None = None
    learning_goals_text: str | None = None
    # Planned for 2027 collection: unknown (None) for historical students, never zero.
    skills_text: str | None = None
    interests_text: str | None = None
    desired_work_text: str | None = None
    modality_preference: str | None = None

    def professional_text(self) -> str:
        return " ".join(
            t for t in (self.expectations_text, self.learning_goals_text, self.skills_text, self.interests_text, self.desired_work_text) if t
        )


@dataclass(frozen=True)
class Vacancy:
    vacancy_id: str
    period: str
    capacity: int
    status: str | None
    vacancy_type: str | None
    project_id: str | None = None
    project_name: str | None = None
    project_description: str | None = None
    project_line: str | None = None
    organization_id: str | None = None
    organization_name: str | None = None
    department: str | None = None
    municipality: str | None = None
    modality: str | None = None
    program_profile: str | None = None
    program_profile_alt: str | None = None
    activities_text: str | None = None
    requirements_text: str | None = None
    org_needs_text: str | None = None
    call_code: str | None = None

    def professional_text(self) -> str:
        return " ".join(
            t
            for t in (self.project_name, self.project_line, self.project_description, self.activities_text, self.requirements_text, self.org_needs_text)
            if t
        )


@dataclass(frozen=True)
class DirectDecision:
    student_id: str
    period: str
    direct_type: str | None
    approval_status: str | None
    confirmed_vacancy_id: str | None = None
    placement_confirmed: bool = False
    approved_municipality: str | None = None
    approved_modalities: tuple[str, ...] = ()
    call_code: str | None = None
    row: int | None = None  # source row, for diagnostics only


@dataclass(frozen=True)
class Enrollment:
    student_id: str
    vacancy_id: str
    period: str
    status: str | None = "MATRICULADO"
    row: int | None = None


@dataclass(frozen=True)
class Label:
    student_id: str
    vacancy_id: str
    period: str
    value: float
    source: str | None


@dataclass
class InputBundle:
    students: list[Student] = field(default_factory=list)
    vacancies: list[Vacancy] = field(default_factory=list)
    decisions: list[DirectDecision] = field(default_factory=list)
    enrollments: list[Enrollment] = field(default_factory=list)
    labels: list[Label] = field(default_factory=list)
    source_files: dict[str, str] = field(default_factory=dict)  # path name -> sha256
    load_warnings: list[str] = field(default_factory=list)
