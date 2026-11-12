"""`hybrid-pyr-v0.2`: explainable, missing-data-aware compatibility for the PyR Excel contract.

Intended semantic changes vs `hybrid-v0.1` (documented in docs/MATCHING_ENGINE_PYR.md):
* `academic` becomes `program`: plaza "Perfil" / "Perfil alterno" (observed institutional fields)
  instead of the platform's is_required program list. Alternate profile scores `alt_profile_score`.
* `experience`/`interests`/`preference` (platform-only fields) are replaced by `semantic`
  (real NLP similarity over professional text) and `lexical` (hybrid-v0.1 `textScore`, reused verbatim).
* `skills` compares declared skills (from 2027) with plaza requirements/organisation needs; unknown until
  the University collects them – it is never scored as 0 for historical students.
* `location` is soft and informational only (origin municipality vs plaza municipality). Approved
  geographic/modality restrictions are HARD rules in `constraints.py`, never this score.
* `modality` only exists when a student modality preference is recorded.
Unavailable components keep effective weight 0 and the rest are renormalised (same rule as v0.1).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from .constraints import program_relation
from .policy import COMPONENTS_V02, Policy, canon_modality, canon_place
from .schema import Student, Vacancy
from .text import js_round, text_score

COMPONENT_LABEL = {
    "program": "programa/perfil",
    "skills": "habilidades vs requisitos",
    "semantic": "similitud semántica",
    "lexical": "coincidencia léxica",
    "location": "territorio (informativo)",
    "modality": "modalidad preferida",
}


@dataclass
class PairScore:
    student_id: str
    vacancy_id: str
    total: float | None
    raw: dict[str, float | None]
    effective: dict[str, float]
    coverage: float  # share of configured weight with evidence (0..1)
    blockers: list[str] = field(default_factory=list)
    model_id: str | None = None
    explanation: str = ""

    @property
    def eligible(self) -> bool:
        return not self.blockers

    @property
    def confidence(self) -> str:
        """Evidence tier from coverage. Renormalised scores with little evidence must not look certain."""
        return "ALTA" if self.coverage >= 0.7 else "MEDIA" if self.coverage >= 0.4 else "BAJA"


def _round2(x: float) -> float:
    return js_round(x * 100) / 100


def component_scores(student: Student, vacancy: Vacancy, policy: Policy, semantic_backend) -> dict[str, float | None]:
    rel = program_relation(student, vacancy)
    program = {"exact": 100.0, "alt": float(policy["alt_profile_score"]), "none": 0.0}.get(rel)
    if policy["program_profile_rule"] == "off":
        program = None
    s_text = student.professional_text()
    v_text = vacancy.professional_text()
    semantic = semantic_backend.similarity(s_text, v_text) if s_text and v_text else None
    lexical = text_score(s_text, v_text) if s_text and v_text else None
    req = " ".join(t for t in (vacancy.requirements_text, vacancy.org_needs_text, vacancy.activities_text) if t)
    skills = text_score(student.skills_text, req) if student.skills_text and req else None
    location = None
    if student.origin_municipality and vacancy.municipality:
        same = canon_place(student.origin_municipality) == canon_place(vacancy.municipality)
        location = float(policy["location_match_score"] if same else policy["location_mismatch_score"])
    modality = None
    if student.modality_preference and vacancy.modality:
        modality = 100.0 if canon_modality(student.modality_preference) == canon_modality(vacancy.modality) else 0.0
    return {"program": program, "skills": skills, "semantic": semantic, "lexical": lexical, "location": location, "modality": modality}


def combine(raw: dict[str, float | None], weights: dict[str, float]) -> tuple[float, dict[str, float], float]:
    available = sum(weights[k] for k in COMPONENTS_V02 if raw[k] is not None)
    configured = sum(weights.values())
    eff = {k: (weights[k] * 100 / available if raw[k] is not None and available else 0.0) for k in COMPONENTS_V02}
    total = sum((raw[k] or 0.0) * eff[k] / 100 for k in COMPONENTS_V02)
    return _round2(min(100.0, max(0.0, total))), eff, (available / configured if configured else 0.0)


def explain(ps: PairScore, threshold: float) -> str:
    if ps.blockers:
        return "Pareja bloqueada por reglas obligatorias: " + ", ".join(ps.blockers) + ". No se calcula compatibilidad."
    known = [k for k in COMPONENTS_V02 if ps.raw[k] is not None and ps.effective[k] > 0]
    unknown = [COMPONENT_LABEL[k] for k in COMPONENTS_V02 if ps.raw[k] is None]
    top = sorted(known, key=lambda k: (-(ps.raw[k] or 0) * ps.effective[k], COMPONENTS_V02.index(k)))[:3]
    parts = [f"Compatibilidad {ps.total:.2f}/100 ({'sobre' if ps.total >= threshold else 'bajo'} el umbral provisional {threshold:g})."]
    if top:
        parts.append("Aportes principales: " + "; ".join(f"{COMPONENT_LABEL[k]} {ps.raw[k]:.0f}" for k in top) + ".")
    if unknown:
        parts.append("Sin evidencia (desconocido, no penaliza; pesos renormalizados): " + ", ".join(unknown) + ".")
    parts.append(f"Cobertura de evidencia: {ps.coverage * 100:.0f}% del peso configurado (confianza {ps.confidence}).")
    if ps.confidence == "BAJA":
        parts.append("Advertencia: el puntaje se apoya en muy poca evidencia; no interpretarlo como alta idoneidad.")
    if ps.model_id:
        parts.append(f"Puntaje recalibrado por modelo supervisado {ps.model_id}.")
    return " ".join(parts)


def score_pair(student: Student, vacancy: Vacancy, policy: Policy, semantic_backend, blockers: list[str], model=None) -> PairScore:
    raw = component_scores(student, vacancy, policy, semantic_backend)
    total, eff, coverage = combine(raw, policy.weights)
    ps = PairScore(student.student_id, vacancy.vacancy_id, None if blockers else total, raw, eff, coverage, list(blockers))
    if model is not None and not blockers:
        ps.total = _round2(model.predict_score(raw))
        ps.model_id = model.model_id
    ps.explanation = explain(ps, policy["minimum_recommended_score"])
    if ps.total is not None and not math.isfinite(ps.total):  # pragma: no cover - defensive
        raise ValueError("Puntaje no finito.")
    return ps
