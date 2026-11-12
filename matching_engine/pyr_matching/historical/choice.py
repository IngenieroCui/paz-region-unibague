"""Choice-situation reconstruction shared by the behaviour model (Track A) and historical evaluation.

A *choice situation* = (student, period, mechanism, candidate set, observed placement). The candidate set
is an APPROXIMATION of what the student could choose at decision time, built only from pre-decision
fields and the hard constraints of the active policy:

* `eligible_with_uptake` (default): placements of the period that pass every hard rule for the flow AND
  received at least one observed allocation (evidence they were actually offered). Uptake is post-decision
  information, but it is used only to approximate availability, never as a score feature.
* `eligible_all`: every placement that passes the hard rules (over-states availability).

Neither variant knows the real order of arrival or the moment a placement filled up in SIGA, so the
reconstructed choice sets are larger than the real ones. This is reported as a limitation, always.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from ..constraints import check_pair
from ..policy import Policy
from ..schema import Student, Vacancy
from ..scoring import backend_texts
from ..semantic import build_backend
from .builder import HistoricalDataset
from .store import to_input_bundle

CANDIDATE_MODES = ("eligible_with_uptake", "eligible_all")


@dataclass
class ChoiceSituation:
    student: Student
    period: str
    mechanism: str
    observed: str  # placement_id
    candidates: list[Vacancy]
    observed_in_candidates: bool
    meta: dict = field(default_factory=dict)


@dataclass
class PeriodContext:
    period: str
    students: dict[str, Student]
    vacancies: dict[str, Vacancy]
    backend: object
    situations: list[ChoiceSituation]
    excluded: dict[str, int]


def _flow(mechanism: str) -> str:
    if mechanism == "SIGA":
        return "SIGA"
    return mechanism.replace("DIRECTA_", "", 1)


def build_period_context(ds: HistoricalDataset, period: str, policy: Policy, mechanisms=("SIGA",), candidate_mode: str = "eligible_with_uptake",
                         semantic_override: str | None = None, encoder=None) -> PeriodContext:
    if candidate_mode not in CANDIDATE_MODES:
        raise ValueError(f"candidate_mode debe ser uno de {CANDIDATE_MODES}")
    b = to_input_bundle(ds, [period])
    students = {s.student_id: s for s in b.students}
    vacancies = {v.vacancy_id: v for v in b.vacancies}
    backend, _ = build_backend(policy, semantic_override, encoder=encoder)
    # Unsupervised preprocessing fitted ONLY on this period's pre-decision texts (no labels, no future).
    backend.prepare(backend_texts(policy, list(students.values()), list(vacancies.values())))
    uptake = defaultdict(int)
    for a in ds.allocations:
        if a["period"] == period:
            uptake[a["placement_id"]] += 1
    excluded = defaultdict(int)
    situations = []
    per_student = defaultdict(list)
    for a in ds.allocations:
        if a["period"] == period:
            per_student[a["student_id"]].append(a)
    for sid in sorted(per_student):
        allocs = per_student[sid]
        if len(allocs) != 1:
            excluded["ASIGNACION_MULTIPLE"] += 1
            continue
        a = allocs[0]
        if a["mechanism"] not in mechanisms:
            excluded[f"MECANISMO_{a['mechanism']}"] += 1
            continue
        s = students.get(sid)
        if s is None:
            excluded["ESTUDIANTE_NO_ENCONTRADO"] += 1
            continue
        flow = _flow(a["mechanism"])
        cands = []
        for vid in sorted(vacancies):
            v = vacancies[vid]
            if candidate_mode == "eligible_with_uptake" and not uptake[vid]:
                continue
            if not check_pair(s, v, policy, period, flow):
                cands.append(v)
        in_set = any(v.vacancy_id == a["placement_id"] for v in cands)
        situations.append(ChoiceSituation(s, period, a["mechanism"], a["placement_id"], cands, in_set))
    return PeriodContext(period, students, vacancies, backend, situations, dict(excluded))
