"""Reference port of the platform scorer `hybrid-v0.1`.

Source of truth: `supabase/functions/_shared/matching/engine.ts`. This module exists so the
standalone engine can (a) prove parity with the code the team already tested and (b) reuse the
exact component formulas inside `hybrid-pyr-v0.2`. It takes and returns plain dicts shaped like
the TypeScript types (snake_case keys identical to the TS objects).

Do NOT edit formulas here. New behaviour belongs in a new algorithm version
(`pyr_matching.scoring`, `hybrid-pyr-v0.2`). Parity is enforced by `tests/test_parity_hybrid_v01.py`
against `parity/golden_hybrid_v01.json`, which is produced by running the TypeScript engine.
"""
from __future__ import annotations

import math
from typing import Any

from .text import join_text, js_num, js_round, normalize_tokens, text_score  # noqa: F401 (re-export)

ALGORITHM_VERSION = "hybrid-v0.1"
COMPONENTS = ("academic", "skills", "experience", "interests", "location", "preference", "semantic")


def validate_configuration(c: Any) -> dict:
    def fail():
        raise ValueError("Configuración inválida: versión, pesos, umbral o reglas.")

    if not isinstance(c, dict):
        fail()
    t = c.get("minimum_recommended_score")
    if c.get("algorithm_version") != ALGORITHM_VERSION or isinstance(t, bool) or not isinstance(t, (int, float)) or not math.isfinite(t) or t < 0 or t > 100:
        fail()
    w = c.get("weights")
    if not isinstance(w, dict) or len(w) != len(COMPONENTS) or any(
        isinstance(w.get(k), bool) or not isinstance(w.get(k), (int, float)) or not math.isfinite(w[k]) or w[k] < 0 for k in COMPONENTS
    ):
        fail()
    if any(abs(w[k] * 10000 - js_round(w[k] * 10000)) > 1e-7 for k in COMPONENTS) or sum(int(js_round(w[k] * 10000)) for k in COMPONENTS) != 1000000:
        fail()
    r = c.get("rules")
    if not isinstance(r, dict) or len(r) != 2 or not isinstance(r.get("requiredSkillsAreHardConstraint"), bool) or not isinstance(r.get("semanticEnabled"), bool):
        fail()
    return {"algorithm_version": c["algorithm_version"], "minimum_recommended_score": t, "weights": dict(w), "rules": dict(r)}


def constraints(student: dict, position: dict, config: dict) -> list[dict]:
    blockers: list[dict] = []
    required = [p for p in position["programs"] if p["is_required"]]
    if required and not any(p["academic_program_id"] == student["academic_program_id"] for p in required):
        blockers.append({"code": "ACADEMIC_PROGRAM_REQUIRED"})
    skills = {s["skill_id"] for s in student["skills"]}
    if config["rules"]["requiredSkillsAreHardConstraint"]:
        for s in position["skills"]:
            if s["is_required"] and s["skill_id"] not in skills:
                blockers.append({"code": "REQUIRED_SKILL_MISSING", "skill_id": s["skill_id"]})
    return blockers


def position_text(p: dict) -> str:
    pr = p["project"]
    parts = [pr["name"], pr.get("summary"), pr.get("description"), p["title"], p.get("description")]
    for r in p["requirements"]:
        parts += [r["label"], r.get("description")]
    parts += [s["name"] for s in p["skills"]]
    return join_text(parts)


def experience_text(s: dict) -> str:
    return join_text([x for e in s["experiences"] for x in (e["title"], e.get("organization_name"), e.get("description"))])


def interests_text(s: dict) -> str:
    return join_text([x for i in s["interests"] for x in (i["label"], i.get("description"))])


def preference_text(s: dict) -> str:
    return join_text([s.get("desired_work_description"), s.get("bio")])


def student_semantic_text(s: dict) -> str:
    """Explicit professional whitelist: no documents, identifiers, identity or geography."""
    parts = [preference_text(s), experience_text(s), interests_text(s)]
    for k in s["skills"]:
        parts += [k["name"], k.get("evidence_text")]
    return join_text(parts)


def location_score(student: dict, municipality: str | None) -> float | None:
    if not municipality:
        return None
    pref = next((p for p in student["preferences"] if p["municipality_id"] == municipality), None)
    if pref:
        return max(50, 100 - 10 * (pref["preference_order"] - 1))
    if student.get("current_municipality_id") == municipality:
        return 70
    if student.get("origin_municipality_id") == municipality:
        return 60
    return 40 if (student.get("current_municipality_id") or student.get("origin_municipality_id") or student["preferences"]) else None


def embedding_score(a: list[float], b: list[float]) -> float | None:
    if not a or len(a) != len(b) or not all(math.isfinite(x) for x in a) or not all(math.isfinite(y) for y in b):
        return None
    dot = na = nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if not na or not nb:
        return None
    cosine = dot / (math.sqrt(na) * math.sqrt(nb))
    return max(0.0, min(1.0, cosine)) * 100 if math.isfinite(cosine) else None


_LOW_LABEL = {"skills": "habilidades solicitadas", "experience": "experiencia declarada", "interests": "intereses declarados"}


def calculate_pair(student: dict, position: dict, config: dict, semantic: float | None = None) -> dict:
    blockers = constraints(student, position, config)
    owned = {s["skill_id"] for s in student["skills"]}
    matched = [s for s in position["skills"] if s["skill_id"] in owned]
    requested_weight = sum(2 if s["is_required"] else 1 for s in position["skills"])
    target = position_text(position)
    programs = position["programs"]
    raw: dict[str, float | None] = {
        "academic": (100 if any(p["academic_program_id"] == student["academic_program_id"] for p in programs) else 0) if programs else None,
        "skills": 100 * sum(2 if s["is_required"] else 1 for s in matched) / requested_weight if requested_weight else None,
        "experience": text_score(experience_text(student), target),
        "interests": text_score(interests_text(student), target),
        "location": location_score(student, position["project"].get("municipality_id")),
        "preference": text_score(preference_text(student), target),
        "semantic": semantic
        if config["rules"]["semanticEnabled"] and semantic is not None and math.isfinite(semantic) and 0 <= semantic <= 100
        else None,
    }
    weights = config["weights"]
    available_weight = 0
    for k in COMPONENTS:
        available_weight = available_weight + (weights[k] if raw[k] is not None else 0)
    component_scores = {
        k: {
            "raw_score": raw[k],
            "configured_weight": weights[k],
            "effective_weight": weights[k] * 100 / available_weight if raw[k] is not None and available_weight else 0,
            "available": raw[k] is not None,
        }
        for k in COMPONENTS
    }
    total = 0
    for k in COMPONENTS:
        total = total + (raw[k] if raw[k] is not None else 0) * component_scores[k]["effective_weight"] / 100
    total_score = None if blockers else js_round(min(100, max(0, total)) * 100) / 100

    recs: list[dict] = []
    for s in position["skills"]:
        if s["is_required"] and s["skill_id"] not in owned:
            recs.append({"code": "REQUIRED_SKILL_MISSING", "component": "skills", "skill_id": s["skill_id"], "message": f"Falta la habilidad requerida: {s['name']}."})
    if any(b["code"] == "ACADEMIC_PROGRAM_REQUIRED" for b in blockers):
        recs.append({"code": "ACADEMIC_PROGRAM_REQUIRED", "component": "academic", "message": "Revisar una plaza compatible con el programa requerido."})
    for k in ("skills", "experience", "interests"):
        if raw[k] is not None and raw[k] < 50:
            recs.append({"code": "LOW_" + k.upper(), "component": k, "message": f"Poca coincidencia en {_LOW_LABEL[k]}."})
    muni = position["project"].get("municipality_id")
    pref = next((p for p in student["preferences"] if p["municipality_id"] == muni), None)
    if raw["location"] is not None and not pref:
        recs.append({"code": "OUTSIDE_LOCATION_PREFERENCES", "component": "location", "message": "El proyecto está fuera de las preferencias territoriales declaradas; no es una prohibición."})
    if not available_weight:
        recs.append({"code": "NO_WEIGHTED_EVIDENCE", "message": "No hay evidencia disponible con peso positivo; revisar la configuración y los perfiles."})
    threshold = config["minimum_recommended_score"]
    recs.append({
        "code": "RECOMMENDED" if total_score is not None and total_score >= threshold else "BELOW_THRESHOLD_OR_BLOCKED",
        "message": f"Umbral de esta ejecución: {js_num(threshold)}.",
    })
    strengths = sorted(
        [k for k in COMPONENTS if raw[k] is not None and raw[k] >= 75],
        key=lambda k: (-component_scores[k]["effective_weight"], COMPONENTS.index(k)),
    )[:3]
    gaps = [k for k in COMPONENTS if raw[k] is not None and raw[k] < 50]
    pref_note = f" (preferencia {js_num(pref['preference_order'])})" if pref else ""
    parts = [
        "Compatibilidad calculada: pareja bloqueada por restricciones obligatorias." if blockers else f"Compatibilidad calculada: {js_num(total_score)}/100.",
        "Programa: no disponible." if raw["academic"] is None else ("El programa aparece entre los programas asociados." if raw["academic"] == 100 else "El programa no coincide."),
        f"Habilidades solicitadas coincidentes: {len(matched)}/{len(position['skills'])}.",
        "Territorio: no disponible." if raw["location"] is None else f"Compatibilidad territorial: {js_num(raw['location'])}/100{pref_note}.",
        f"Componentes fuertes: {', '.join(strengths) or 'sin evidencia suficiente'}.",
        f"Brechas: {', '.join(gaps) or 'sin coincidencias bajas disponibles'}.",
        "Semántica no disponible; pesos renormalizados." if raw["semantic"] is None else "Semántica disponible mediante embeddings.",
        "Sin componentes disponibles con peso positivo: total 0, pesos efectivos 0." if not available_weight else "",
    ]
    return {
        "student_id": student["id"],
        "project_position_id": position["id"],
        "is_eligible": not blockers,
        "total_score": total_score,
        "component_scores": component_scores,
        "blockers": blockers,
        "recommendations": recs,
        "explanation": " ".join(p for p in parts if p),
    }
