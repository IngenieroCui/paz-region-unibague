"""Track A – EXPERIMENTAL model of historical allocation BEHAVIOUR (not suitability).

What it learns: which of the (approximately reconstructed) eligible placements a student historically
ended up in, mainly through SIGA self-selection. It answers "what did students like this tend to pick?",
NOT "which placement is best for the student". Consequences enforced in code:

* model_track = "behavior"; it is stored in a separate registry track, can never be loaded as a
  suitability re-ranker, and can only enter scoring as the v0.3 `historical` component when a policy
  explicitly gives that component a weight (provisional weight = 0);
* non-chosen placements are NOT negative labels: the model is a conditional logit (softmax over the
  student's own candidate set), i.e. it only learns relative preference among options that were
  plausibly available, conditioned on the hard constraints;
* direct placements (special case, municipality of origin, calls) are excluded by default: they are
  institutional decisions under restrictions, not choices;
* status is always EXPERIMENTAL with explicit limitations (unknown arrival order / fill times, candidate
  sets over-estimate availability, cohort and offer drift between periods).
"""
from __future__ import annotations

import hashlib
import json
import math
import random
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from .policy import Policy
from .training import TRACK_BEHAVIOR, Registry, feature_names, featurize, model_components, period_key, raw_components

LIMITATIONS = [
    "Aprende tendencias de asignaciones pasadas (autoselección SIGA bajo disponibilidad), no idoneidad estudiante-plaza.",
    "Los conjuntos de opciones son aproximados: no se conoce el orden de llegada ni el momento en que cada plaza se llenó.",
    "Las plazas no elegidas no se tratan como negativas: modelo de elección condicional sobre opciones elegibles.",
    "Asignaciones directas (caso especial, municipio de origen, convocatoria) excluidas: son decisiones institucionales.",
    "Deriva entre periodos (oferta, cohortes, políticas) puede invalidar patrones; solo se evalúa con partición temporal.",
]


class NotEnoughHistory(Exception):
    def __init__(self, reasons, report):
        self.reasons, self.report = reasons, report
        super().__init__("; ".join(reasons))


class BehaviorModel:
    track = TRACK_BEHAVIOR

    def __init__(self, model_id: str, weights: list[float], components: tuple[str, ...], offset: float = 0.0,
                 algorithm_base: str = "hybrid-pyr-v0.3", policy_fingerprint: str | None = None):
        self.model_id, self.weights, self.components, self.offset = model_id, weights, tuple(components), offset
        self.algorithm_base, self.policy_fingerprint = algorithm_base, policy_fingerprint

    def utility(self, raw: dict) -> float:
        return sum(w * x for w, x in zip(self.weights, featurize(raw, self.components)))

    def predict_score(self, raw: dict) -> float:
        z = self.utility(raw) - self.offset
        return 100 / (1 + math.exp(-z)) if z >= 0 else 100 * math.exp(z) / (1 + math.exp(z))

    @classmethod
    def load(cls, path: str | Path, policy: Policy | None = None) -> "BehaviorModel":
        d = json.loads(Path(path).read_text(encoding="utf-8"))
        if d.get("model_track") != TRACK_BEHAVIOR:
            raise ValueError("MODELO_DE_OTRA_PISTA: se esperaba un modelo de comportamiento histórico.")
        if policy is not None:
            if d["algorithm_base"] != policy["algorithm_version"] or d["feature_schema_version"] != policy.feature_schema_version:
                raise ValueError("MODELO_INCOMPATIBLE: algoritmo/esquema de características distinto al de la política.")
        return cls(d["model_id"], d["weights"], tuple(d["components"]), d.get("offset", 0.0), d["algorithm_base"], d.get("policy_fingerprint"))


def _situation_matrix(ctx, policy, comps):
    """[(features per candidate, index of observed)] for situations whose observed choice is in the set."""
    out = []
    for sit in ctx.situations:
        if not sit.observed_in_candidates or len(sit.candidates) < 2:
            continue
        X = [featurize(raw_components(sit.student, v, policy, ctx.backend), comps) for v in sit.candidates]
        y = next(i for i, v in enumerate(sit.candidates) if v.vacancy_id == sit.observed)
        out.append((X, y, [v.vacancy_id for v in sit.candidates], sit.student.student_id))
    return out


def fit_conditional_logit(data, l2: float, lr: float, epochs: int, seed: int) -> list[float]:
    d = len(data[0][0][0])
    rng = random.Random(seed)
    w = [rng.uniform(-0.01, 0.01) for _ in range(d)]
    n = len(data)
    for _ in range(epochs):
        g = [0.0] * d
        for X, y, _, _ in data:
            u = [sum(wj * xj for wj, xj in zip(w, x)) for x in X]
            m = max(u)
            e = [math.exp(ui - m) for ui in u]
            z = sum(e)
            p = [ei / z for ei in e]
            for j in range(d):
                g[j] += sum(pi * x[j] for pi, x in zip(p, X)) - X[y][j]
        w = [wj - lr * (gj / n + l2 * wj / n) for wj, gj in zip(w, g)]
    return w


def choice_metrics(data, scorer, ks=(1, 3, 5)) -> dict:
    """Recall@k (= hit@k with one observed choice), MRR, NDCG@k over choice situations."""
    if not data:
        return {"situaciones": 0}
    hits = {k: 0 for k in ks}
    rr, ndcg = 0.0, {k: 0.0 for k in ks}
    for X, y, ids, _ in data:
        s = [scorer(x, i) for x, i in zip(X, ids)]
        order = sorted(range(len(s)), key=lambda i: (-s[i], ids[i]))
        rank = order.index(y) + 1
        rr += 1 / rank
        for k in ks:
            if rank <= k:
                hits[k] += 1
                ndcg[k] += 1 / math.log2(rank + 1)
    n = len(data)
    out = {"situaciones": n, "mrr": round(rr / n, 4)}
    for k in ks:
        out[f"recall@{k}"] = round(hits[k] / n, 4)
        out[f"ndcg@{k}"] = round(ndcg[k] / n, 4)
    out["tamano_medio_conjunto"] = round(sum(len(X) for X, *_ in data) / n, 2)
    out["recall@5_aleatorio_esperado"] = round(sum(min(1.0, 5 / len(X)) for X, *_ in data) / n, 4)
    return out


def train_behavior(ds, policy: Policy, registry_dir: str | Path | None = None, test_period: str | None = None,
                   candidate_mode: str = "eligible_with_uptake", semantic_override: str | None = None, encoder=None, command: str = "") -> dict:
    """Fit on periods strictly BEFORE the test period; evaluate on the untouched test period."""
    from .historical.choice import build_period_context

    cfg = policy.get("behavior") or {}
    if policy["algorithm_version"] != "hybrid-pyr-v0.3":
        raise ValueError("El modelo de comportamiento usa las características de hybrid-pyr-v0.3.")
    periods = sorted({a["period"] for a in ds.allocations}, key=period_key)
    test_period = test_period or (periods[-1] if periods else None)
    train_periods = [p for p in periods if period_key(p) < period_key(test_period)] if test_period else []
    comps = model_components(policy)
    mechs = tuple(cfg.get("train_mechanisms", ["SIGA"]))
    ctxs = {p: build_period_context(ds, p, policy, mechs, candidate_mode, semantic_override, encoder) for p in train_periods + ([test_period] if test_period else [])}
    train_data = [row for p in train_periods for row in _situation_matrix(ctxs[p], policy, comps)]
    test_data = _situation_matrix(ctxs[test_period], policy, comps) if test_period else []
    report = {
        "periodos_entrenamiento": train_periods, "periodo_prueba": test_period, "modo_conjunto_candidatos": candidate_mode,
        "mecanismos_usados": list(mechs), "situaciones_entrenamiento": len(train_data), "situaciones_prueba": len(test_data),
        "excluidas": {p: c.excluded for p, c in ctxs.items()},
        "eleccion_fuera_de_conjunto": {p: sum(1 for s in c.situations if not s.observed_in_candidates) for p, c in ctxs.items()},
        "estudiantes_repetidos_train_test": len({r[3] for r in train_data} & {r[3] for r in test_data}),
    }
    reasons = []
    if len(train_periods) < cfg.get("min_periods", 2) - 1 or not train_periods:
        reasons.append("POCOS_PERIODOS_PREVIOS")
    if len(train_data) < cfg.get("min_observed_allocations", 150):
        reasons.append(f"POCAS_SITUACIONES_DE_ELECCION: {len(train_data)} < {cfg.get('min_observed_allocations', 150)}")
    if reasons:
        raise NotEnoughHistory(reasons, report)
    w = fit_conditional_logit(train_data, cfg.get("l2", 1.0), cfg.get("learning_rate", 0.5), cfg.get("epochs", 400), cfg.get("seed", 20261112))
    utilities = [sum(wj * xj for wj, xj in zip(w, x)) for X, *_ in train_data for x in X]
    offset = sum(utilities) / len(utilities)
    fp = hashlib.sha256(json.dumps([(r[3], r[2][r[1]]) for r in train_data]).encode()).hexdigest()[:16]
    model_id = f"beh-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}-{fp[:8]}"
    model = BehaviorModel(model_id, w, comps, offset, policy["algorithm_version"], policy.fingerprint)
    baseline_total = lambda x, _id: sum(policy.weights[c] * x[i] for i, c in enumerate(comps))  # noqa: E731  (v0.3 provisional weights, renormalisation-free proxy)
    metrics = {
        "modelo_prueba": choice_metrics(test_data, lambda x, _i: sum(wj * xj for wj, xj in zip(w, x))),
        "modelo_entrenamiento": choice_metrics(train_data, lambda x, _i: sum(wj * xj for wj, xj in zip(w, x))),
        "pesos_provisionales_prueba": choice_metrics(test_data, baseline_total),
    }
    artifact = {
        "model_id": model_id, "model_type": "conditional_logit_choice_model", "model_track": TRACK_BEHAVIOR, "status": "EXPERIMENTAL",
        "engine_version": __version__, "algorithm_base": policy["algorithm_version"], "feature_schema_version": policy.feature_schema_version,
        "components": list(comps), "features": feature_names(comps), "weights": w, "offset": offset,
        "policy_id": policy["policy_id"], "policy_fingerprint": policy.fingerprint, "dataset_fingerprint": fp,
        "historical_dataset_meta": {k: ds.meta.get(k) for k in ("dataset_schema", "pseudonym_key_fingerprint", "capacity_mode", "periods")},
        "trained_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(), "report": report, "metrics": metrics,
        "limitations": LIMITATIONS, "is_suitability_model": False, "command": command,
    }
    if registry_dir:
        Registry(registry_dir, track=TRACK_BEHAVIOR).save(artifact, activate=False)
    artifact["_model"] = model
    return artifact
