"""Versioned Python/JSON integration interface (no Excel, no web server, no platform dependency).

Request  `pyr-match-request/1.0`:
    {"schema_version": "pyr-match-request/1.0", "period": "2027A",
     "policy": "v0.2" | "v0.3",                       # optional, default v0.2 (or pass policy=Policy in Python)
     "options": {"semantic": "tfidf", "simulate": false, "pairs": "top", "timestamp": "..."},
     "students":   [{"student_id", "academic_program", "origin_municipality"?, "eligible"?, "expectations_text"?, ...}],
     "vacancies":  [{"vacancy_id", "capacity", "status", "vacancy_type", "program_profile"?, ...}],
     "decisions":  [{"student_id", "direct_type", "approval_status", "confirmed_vacancy_id"?, ...}],
     "enrollments":[{"student_id", "vacancy_id", "status"?}]}
Response `pyr-match-result/1.0` (same tables/summary as the Excel output) or
    {"schema_version": "pyr-match-result/1.0", "status": "VALIDATION_ERROR" | "REQUEST_ERROR", "issues": [...]}

Unknown fields are REJECTED (not ignored) so identity or sensitive attributes cannot slip into the engine
through an integration. Values are raw institutional values; the same aliases as the Excel path apply.
"""
from __future__ import annotations

import dataclasses
import hashlib
import json

from .pipeline import ValidationFailed, run_match
from .policy import POLICY_V03_PATH, Policy, canon_modality
from .schema import OUTPUT_SCHEMA_VERSION, DirectDecision, Enrollment, InputBundle, Student, Vacancy

REQUEST_SCHEMA_VERSION = "pyr-match-request/1.0"
_ENTITIES = {"students": Student, "vacancies": Vacancy, "decisions": DirectDecision, "enrollments": Enrollment}
_INTERNAL = {"source", "row", "period"}


def allowed_fields(entity: str) -> list[str]:
    return [f.name for f in dataclasses.fields(_ENTITIES[entity]) if f.name not in _INTERNAL]


def _err(status, issues):
    return {"schema_version": OUTPUT_SCHEMA_VERSION, "status": status, "issues": issues}


def bundle_from_request(req: dict, policy: Policy) -> tuple[InputBundle, list[dict]]:
    issues = []
    period = str(req["period"])
    b = InputBundle()
    for entity, cls in _ENTITIES.items():
        allowed = set(allowed_fields(entity))
        required = {"students": {"student_id"}, "vacancies": {"vacancy_id", "capacity"}, "decisions": {"student_id"},
                    "enrollments": {"student_id", "vacancy_id"}}[entity]
        for i, rec in enumerate(req.get(entity) or []):
            if not isinstance(rec, dict):
                issues.append({"code": "REGISTRO_INVALIDO", "entity": entity, "index": i})
                continue
            unknown = sorted(set(rec) - allowed)
            if unknown:
                issues.append({"code": "CAMPO_NO_PERMITIDO", "entity": entity, "index": i, "fields": unknown})
                continue
            missing = sorted(required - set(rec))
            if missing:
                issues.append({"code": "CAMPO_OBLIGATORIO_FALTANTE", "entity": entity, "index": i, "fields": missing})
                continue
            vals = {k: v for k, v in rec.items()}
            vals["period"] = period
            if entity == "vacancies":
                vals["status"] = policy.alias("status", vals.get("status"))
                vals["vacancy_type"] = policy.alias("vacancy_type", vals.get("vacancy_type"))
                vals["modality"] = canon_modality(vals.get("modality"))
                if not isinstance(vals.get("capacity"), int) or isinstance(vals.get("capacity"), bool):
                    vals["capacity"] = -1  # surfaces as CUPOS_INVALIDOS
                vals.setdefault("status", None)
                vals.setdefault("vacancy_type", None)
            if entity == "students":
                vals["modality_preference"] = canon_modality(vals.get("modality_preference"))
            if entity == "decisions":
                vals["direct_type"] = policy.alias("direct_type", vals.get("direct_type"))
                vals["approval_status"] = policy.alias("approval_status", vals.get("approval_status"))
                vals.setdefault("direct_type", None)
                vals.setdefault("approval_status", None)
                vals["approved_modalities"] = tuple(sorted({m for m in (canon_modality(x) for x in (vals.get("approved_modalities") or [])) if m}))
            if entity == "enrollments":
                from .policy import canon

                vals["status"] = canon(vals.get("status")) or "MATRICULADO"
            for k, v in list(vals.items()):
                if isinstance(v, str):
                    vals[k] = v.strip() or None
            getattr(b, entity).append(cls(**vals))
    return b, issues


def match_request(req: dict, policy: Policy | None = None, model=None, behavior_model=None) -> dict:
    if not isinstance(req, dict) or req.get("schema_version") != REQUEST_SCHEMA_VERSION:
        return _err("REQUEST_ERROR", [{"code": "ESQUEMA_DESCONOCIDO", "expected": REQUEST_SCHEMA_VERSION}])
    if not req.get("period"):
        return _err("REQUEST_ERROR", [{"code": "PERIODO_FALTANTE"}])
    if policy is None:
        choice = req.get("policy", "v0.2")
        if choice not in ("v0.2", "v0.3"):
            return _err("REQUEST_ERROR", [{"code": "POLITICA_DESCONOCIDA", "allowed": ["v0.2", "v0.3"]}])
        policy = Policy.load(POLICY_V03_PATH if choice == "v0.3" else None)
    bundle, issues = bundle_from_request(req, policy)
    if issues:
        return _err("REQUEST_ERROR", issues)
    opts = req.get("options") or {}
    bundle.source_files["request.json"] = hashlib.sha256(json.dumps(req, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()
    try:
        res = run_match(bundle, str(req["period"]), policy, semantic_override=opts.get("semantic"), model=model, behavior_model=behavior_model,
                        simulate_general_assignment=bool(opts.get("simulate")), pairs_detail=opts.get("pairs", "top"), run_timestamp=opts.get("timestamp"))
    except ValidationFailed as exc:
        return _err("VALIDATION_ERROR", exc.issues)
    return {"status": "OK", **res.to_json_dict()}
