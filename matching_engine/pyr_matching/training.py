"""Opt-in supervised re-ranking (`train` / `evaluate` / registry). NOT used unless explicitly requested.

Readiness gates (early exit, nothing is fabricated):
* labels must come from an institution-approved *suitability* source (policy.training.accepted_label_sources);
  historical placements / SIGA enrollments are refused as labels (selection bias, forced placements);
* minimum counts, both classes, >= 2 academic periods for a temporal split (earlier -> train, latest -> test);
* labelled pairs must join to students/plazas present in the supplied inputs.

Model: L2-regularised logistic regression over the hybrid-pyr-v0.2 component scores plus explicit
missingness indicators (never imputed as low ability). No identity or protected attributes exist in the
feature schema. The model only re-scores pairs that already passed every hard constraint.
Promotion requires beating the deterministic baseline on the held-out later period.
"""
from __future__ import annotations

import hashlib
import json
import math
import random
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from .constraints import check_pair
from .policy import COMPONENTS_V02, Policy
from .schema import FEATURE_SCHEMA_VERSION, InputBundle
from .scoring import combine, component_scores
from .semantic import build_backend

FEATURES = [f"{c}" for c in COMPONENTS_V02] + [f"{c}_conocido" for c in COMPONENTS_V02]


class NotTrainable(Exception):
    def __init__(self, reasons: list[str], report: dict):
        self.reasons = reasons
        self.report = report
        super().__init__("; ".join(reasons))


def featurize(raw: dict) -> list[float]:
    return [(raw[c] or 0.0) / 100 for c in COMPONENTS_V02] + [0.0 if raw[c] is None else 1.0 for c in COMPONENTS_V02]


def _sigmoid(z: float) -> float:
    return 1 / (1 + math.exp(-z)) if z >= 0 else math.exp(z) / (1 + math.exp(z))


@dataclass
class LogisticModel:
    model_id: str
    weights: list[float]
    bias: float
    features: list[str]

    def predict_proba(self, raw: dict) -> float:
        x = featurize(raw)
        return _sigmoid(self.bias + sum(w * v for w, v in zip(self.weights, x)))

    def predict_score(self, raw: dict) -> float:
        return 100 * self.predict_proba(raw)

    @classmethod
    def load(cls, path: str | Path) -> "LogisticModel":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        if data.get("feature_schema_version") != FEATURE_SCHEMA_VERSION:
            raise ValueError("El modelo usa otro esquema de características; reentrenar o usar la línea base.")
        return cls(data["model_id"], data["weights"], data["bias"], data["features"])


def fit_logistic(X: list[list[float]], y: list[int], l2: float, lr: float, epochs: int, seed: int) -> tuple[list[float], float]:
    rng = random.Random(seed)
    n, d = len(X), len(X[0])
    w = [rng.uniform(-0.01, 0.01) for _ in range(d)]
    b = 0.0
    for _ in range(epochs):
        gw = [0.0] * d
        gb = 0.0
        for xi, yi in zip(X, y):
            err = _sigmoid(b + sum(wj * xj for wj, xj in zip(w, xi))) - yi
            for j in range(d):
                gw[j] += err * xi[j]
            gb += err
        w = [wj - lr * (g / n + l2 * wj / n) for wj, g in zip(w, gw)]
        b -= lr * gb / n
    return w, b


def auc(scores: list[float], labels: list[int]) -> float | None:
    pos = [s for s, l in zip(scores, labels) if l == 1]
    neg = [s for s, l in zip(scores, labels) if l == 0]
    if not pos or not neg:
        return None
    wins = sum(1.0 if p > q else 0.5 if p == q else 0.0 for p in pos for q in neg)
    return wins / (len(pos) * len(neg))


def ranking_metrics(rows: list[tuple[str, float, int]], k: int) -> dict:
    """rows: (group_id, score, label). Precision@k, recall@k, NDCG@k averaged over groups with a positive."""
    groups = defaultdict(list)
    for g, s, l in rows:
        groups[g].append((s, l))
    p_at, r_at, ndcg = [], [], []
    for items in groups.values():
        total_pos = sum(l for _, l in items)
        if not total_pos:
            continue
        ranked = sorted(items, key=lambda t: -t[0])[:k]
        hits = sum(l for _, l in ranked)
        p_at.append(hits / min(k, len(items)))
        r_at.append(hits / total_pos)
        dcg = sum(l / math.log2(i + 2) for i, (_, l) in enumerate(ranked))
        idcg = sum(1 / math.log2(i + 2) for i in range(min(k, total_pos)))
        ndcg.append(dcg / idcg)
    avg = lambda xs: round(sum(xs) / len(xs), 4) if xs else None  # noqa: E731
    return {f"precision@{k}": avg(p_at), f"recall@{k}": avg(r_at), f"ndcg@{k}": avg(ndcg), "grupos_evaluados": len(p_at)}


def _period_key(p: str):
    return (p[:4], p[4:]) if len(p) >= 5 else (p, "")


def build_dataset(bundle: InputBundle, policy: Policy, encoder=None):
    tc = policy["training"]
    accepted = set(tc["accepted_label_sources"])
    rejected_reason = tc.get("rejected_label_sources_reason", {})
    reasons, report = [], {"etiquetas_recibidas": len(bundle.labels)}
    if not bundle.labels:
        raise NotTrainable(["NO_HAY_ETIQUETAS: no se suministró una hoja Etiquetas con juicios de idoneidad validados."], report)
    by_source = defaultdict(int)
    for lb in bundle.labels:
        by_source[lb.source or "SIN_FUENTE"] += 1
    report["etiquetas_por_fuente"] = dict(sorted(by_source.items()))
    for src in sorted(by_source):
        if src not in accepted:
            reasons.append(f"FUENTE_NO_ACEPTADA {src}: " + rejected_reason.get(src, "fuente no aprobada en policy.training.accepted_label_sources."))
    if reasons:
        raise NotTrainable(reasons, report)
    smap = {(s.student_id, s.period): s for s in bundle.students}
    vmap = {(v.vacancy_id, v.period): v for v in bundle.vacancies}
    rows, unjoined, blocked = [], 0, 0
    backends = {}
    for lb in sorted(bundle.labels, key=lambda l: (l.period, l.student_id, l.vacancy_id)):
        s, v = smap.get((lb.student_id, lb.period)), vmap.get((lb.vacancy_id, lb.period))
        if s is None or v is None:
            unjoined += 1
            continue
        if lb.period not in backends:
            be, _ = build_backend(policy, encoder=encoder)
            be.prepare([x.professional_text() for (_, p), x in smap.items() if p == lb.period] + [x.professional_text() for (_, p), x in vmap.items() if p == lb.period])
            backends[lb.period] = be
        if check_pair(s, v, policy, lb.period, "SIGA" if v.vacancy_type in policy["siga_vacancy_types"] else (v.vacancy_type or "")):
            blocked += 1  # hard-blocked pairs are never scored by any model
            continue
        raw = component_scores(s, v, policy, backends[lb.period])
        rows.append({"period": lb.period, "student": s.student_id, "vacancy": v.vacancy_id, "raw": raw,
                     "y": 1 if lb.value >= tc["positive_threshold"] else 0, "program": s.academic_program or "DESCONOCIDO",
                     "municipality": v.municipality or "DESCONOCIDO"})
    report.update({"etiquetas_sin_union": unjoined, "etiquetas_en_parejas_bloqueadas": blocked, "parejas_utilizables": len(rows)})
    periods = sorted({r["period"] for r in rows}, key=_period_key)
    report["periodos"] = periods
    if len(rows) < tc["min_labels"]:
        reasons.append(f"POCAS_ETIQUETAS: {len(rows)} < {tc['min_labels']}.")
    if sum(r["y"] for r in rows) < tc["min_positive"]:
        reasons.append(f"POCOS_POSITIVOS: < {tc['min_positive']}.")
    if len(periods) < tc["min_periods"]:
        reasons.append(f"POCOS_PERIODOS: {len(periods)} < {tc['min_periods']} (se requiere partición temporal).")
    if reasons:
        raise NotTrainable(reasons, report)
    return rows, periods, report


def train(bundle: InputBundle, policy: Policy, registry_dir: str | Path, command: str = "", encoder=None) -> dict:
    tc = policy["training"]
    rows, periods, report = build_dataset(bundle, policy, encoder)
    test_period = periods[-1]
    tr = [r for r in rows if r["period"] != test_period]
    te = [r for r in rows if r["period"] == test_period]
    leakage = {
        "periodo_prueba": test_period,
        "periodos_entrenamiento": periods[:-1],
        "estudiantes_compartidos_train_test": len({r["student"] for r in tr} & {r["student"] for r in te}),
        "plazas_compartidas_train_test": len({r["vacancy"] for r in tr} & {r["vacancy"] for r in te}),
        "caracteristicas_identidad_o_protegidas": [],
    }
    for split, name in ((tr, "entrenamiento"), (te, "prueba")):
        if len({r["y"] for r in split}) < 2:
            raise NotTrainable([f"UNA_SOLA_CLASE_EN_{name.upper()}"], report)
    Xtr, ytr = [featurize(r["raw"]) for r in tr], [r["y"] for r in tr]
    w, b = fit_logistic(Xtr, ytr, tc["l2"], tc["learning_rate"], tc["epochs"], tc["seed"])
    fingerprint = hashlib.sha256(json.dumps([(r["period"], r["student"], r["vacancy"], r["y"]) for r in rows]).encode()).hexdigest()[:16]
    model_id = f"lr-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}-{fingerprint[:8]}"
    model = LogisticModel(model_id, w, b, FEATURES)
    k = tc["eval_k"]

    def evaluate(split, scorer):
        scores = [scorer(r) for r in split]
        ys = [r["y"] for r in split]
        ll = -sum(y * math.log(max(1e-9, s / 100)) + (1 - y) * math.log(max(1e-9, 1 - s / 100)) for s, y in zip(scores, ys)) / len(ys)
        return {"auc": None if auc(scores, ys) is None else round(auc(scores, ys), 4), "log_loss_aprox": round(ll, 4),
                **ranking_metrics([(r["student"], s, r["y"]) for r, s in zip(split, scores)], k)}

    baseline = lambda r: combine(r["raw"], policy.weights)[0]  # noqa: E731
    learned = lambda r: model.predict_score(r["raw"])  # noqa: E731
    metrics = {"modelo_test": evaluate(te, learned), "linea_base_test": evaluate(te, baseline), "modelo_train": evaluate(tr, learned)}
    fairness = {}
    for attr in ("program", "municipality"):
        grp = defaultdict(list)
        for r in te:
            grp[r[attr]].append(r)
        fairness[attr] = {g: {"n": len(rs), "positivos": sum(r["y"] for r in rs),
                              "puntaje_medio_modelo": round(sum(learned(r) for r in rs) / len(rs), 2),
                              "puntaje_medio_base": round(sum(baseline(r) for r in rs) / len(rs), 2)} for g, rs in sorted(grp.items())}
    m_auc, b_auc = metrics["modelo_test"]["auc"], metrics["linea_base_test"]["auc"]
    promoted = m_auc is not None and b_auc is not None and m_auc - b_auc > tc["promotion_min_auc_delta"]
    overfit_gap = None if metrics["modelo_train"]["auc"] is None or m_auc is None else round(metrics["modelo_train"]["auc"] - m_auc, 4)
    artifact = {
        "model_id": model_id, "model_type": "logistic_regression_l2_reranker", "engine_version": __version__,
        "algorithm_base": policy["algorithm_version"], "feature_schema_version": FEATURE_SCHEMA_VERSION, "features": FEATURES,
        "weights": w, "bias": b, "policy_id": policy["policy_id"], "policy_fingerprint": policy.fingerprint,
        "trained_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "dataset_fingerprint": fingerprint, "dataset_report": report, "leakage_audit": leakage,
        "hyperparameters": {k2: tc[k2] for k2 in ("l2", "learning_rate", "epochs", "positive_threshold")}, "seed": tc["seed"],
        "metrics": metrics, "overfitting_gap_auc_train_minus_test": overfit_gap, "fairness_audit": fairness,
        "constraint_violation_rate": 0.0,
        "status": "PROMOVIBLE" if promoted else "RECHAZADO_NO_SUPERA_LINEA_BASE",
        "command": command,
        "label_sources": report["etiquetas_por_fuente"],
    }
    reg = Registry(registry_dir)
    reg.save(artifact, activate=promoted)
    return artifact


class Registry:
    """File registry: <dir>/<model_id>/model.json and <dir>/registry.json {active, history}."""

    def __init__(self, root: str | Path):
        self.root = Path(root)
        self.index_path = self.root / "registry.json"

    def index(self) -> dict:
        if self.index_path.exists():
            return json.loads(self.index_path.read_text(encoding="utf-8"))
        return {"active": None, "history": []}

    def _write(self, idx):
        self.root.mkdir(parents=True, exist_ok=True)
        self.index_path.write_text(json.dumps(idx, indent=2, ensure_ascii=False), encoding="utf-8")

    def save(self, artifact: dict, activate: bool):
        d = self.root / artifact["model_id"]
        d.mkdir(parents=True, exist_ok=True)
        (d / "model.json").write_text(json.dumps(artifact, indent=2, ensure_ascii=False), encoding="utf-8")
        idx = self.index()
        idx["history"].append({"model_id": artifact["model_id"], "status": artifact["status"], "trained_at_utc": artifact["trained_at_utc"]})
        if activate:
            idx["active"] = artifact["model_id"]
        self._write(idx)

    def activate(self, model_id: str | None):
        if model_id is not None and not (self.root / model_id / "model.json").exists():
            raise FileNotFoundError(model_id)
        idx = self.index()
        idx["history"].append({"model_id": model_id or "LINEA_BASE", "status": "ACTIVADO_MANUALMENTE",
                               "trained_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat()})
        idx["active"] = model_id
        self._write(idx)

    def active_model(self) -> LogisticModel | None:
        mid = self.index().get("active")
        return LogisticModel.load(self.root / mid / "model.json") if mid else None
