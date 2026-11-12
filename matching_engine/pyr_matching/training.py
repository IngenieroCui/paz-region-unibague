"""Track B – supervised SUITABILITY re-ranking (`train` / registry). NOT used unless explicitly requested.

Readiness gates (early exit, nothing is fabricated):
* labels must come from an institution-approved *suitability* source (policy.training.accepted_label_sources);
  historical placements / SIGA enrollments are refused as labels (selection bias, forced placements);
* minimum counts, both classes, >= 2 academic periods for a temporal split (earlier -> train, latest -> test);
* labelled pairs must join to students/plazas present in the supplied inputs.

Model: L2-regularised logistic regression over the component scores of the policy's algorithm
(hybrid-pyr-v0.2 or v0.3) plus explicit missingness indicators (never imputed as low ability). No identity
or protected attributes exist in the feature schema. The model only re-scores pairs that already passed
every hard constraint.

Promotion safeguards (v0.3):
* training NEVER activates a model unless `training.auto_activate` is explicitly true (default false);
* a candidate must beat the deterministic baseline AND the currently active model on the held-out later
  period, must not degrade any program/municipality subgroup beyond `max_subgroup_auc_drop`, and needs a
  minimum test size;
* activation (`Registry.activate`) re-checks track, status, feature schema, algorithm, policy fingerprint
  and accepted label sources, and requires a named approver. Behaviour models (Track A) live in a
  separate registry track and can never be activated as suitability models.
"""
from __future__ import annotations

import hashlib
import json
import math
import random
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from .constraints import check_pair
from .policy import COMPONENTS_BY_VERSION, COMPONENTS_V02, FEATURE_SCHEMA_BY_VERSION, Policy
from .schema import FEATURE_SCHEMA_VERSION, InputBundle
from .scoring import backend_texts, combine, component_scores, component_scores_v03
from .semantic import build_backend

FEATURES = [f"{c}" for c in COMPONENTS_V02] + [f"{c}_conocido" for c in COMPONENTS_V02]
TRACK_SUITABILITY = "suitability"
TRACK_BEHAVIOR = "behavior"
PROMOTABLE = "PROMOVIBLE"


class NotTrainable(Exception):
    def __init__(self, reasons: list[str], report: dict):
        self.reasons = reasons
        self.report = report
        super().__init__("; ".join(reasons))


class RegistryError(ValueError):
    pass


def feature_names(components) -> list[str]:
    return list(components) + [f"{c}_conocido" for c in components]


def featurize(raw: dict, components=COMPONENTS_V02) -> list[float]:
    return [(raw.get(c) or 0.0) / 100 for c in components] + [0.0 if raw.get(c) is None else 1.0 for c in components]


def model_components(policy: Policy) -> tuple[str, ...]:
    """Components a model may use as features. The experimental `historical` signal is excluded from
    suitability features so behaviour predictions never leak into suitability models."""
    return tuple(c for c in policy.components if c != "historical")


def raw_components(student, vacancy, policy: Policy, backend) -> dict:
    if policy["algorithm_version"] == "hybrid-pyr-v0.3":
        return component_scores_v03(student, vacancy, policy, backend)
    return component_scores(student, vacancy, policy, backend)


def _sigmoid(z: float) -> float:
    return 1 / (1 + math.exp(-z)) if z >= 0 else math.exp(z) / (1 + math.exp(z))


@dataclass
class LogisticModel:
    model_id: str
    weights: list[float]
    bias: float
    features: list[str]
    components: tuple[str, ...] = COMPONENTS_V02
    track: str = TRACK_SUITABILITY
    algorithm_base: str | None = None
    policy_fingerprint: str | None = None
    meta: dict = field(default_factory=dict)

    def predict_proba(self, raw: dict) -> float:
        x = featurize(raw, self.components)
        return _sigmoid(self.bias + sum(w * v for w, v in zip(self.weights, x)))

    def predict_score(self, raw: dict) -> float:
        return 100 * self.predict_proba(raw)

    @classmethod
    def from_artifact(cls, data: dict, expected_track: str | None = TRACK_SUITABILITY, policy: Policy | None = None) -> "LogisticModel":
        base = data.get("algorithm_base") or "hybrid-pyr-v0.2"
        expected_schema = FEATURE_SCHEMA_BY_VERSION.get(base, FEATURE_SCHEMA_VERSION)
        if data.get("feature_schema_version") != expected_schema:
            raise ValueError("El modelo usa otro esquema de características; reentrenar o usar la línea base.")
        track = data.get("model_track", TRACK_SUITABILITY)  # legacy v0.2 artifacts were suitability-only
        if expected_track and track != expected_track:
            raise ValueError(f"MODELO_DE_OTRA_PISTA: se esperaba '{expected_track}', el artefacto es '{track}'.")
        comps = tuple(data.get("components") or [f for f in data["features"] if not f.endswith("_conocido")])
        if feature_names(comps) != list(data["features"]):
            raise ValueError("Artefacto inconsistente: características no coinciden con los componentes.")
        if policy is not None:
            problems = compatibility_problems(data, policy)
            if problems:
                raise ValueError("MODELO_INCOMPATIBLE: " + "; ".join(problems))
        return cls(data["model_id"], data["weights"], data["bias"], data["features"], comps, track, base,
                   data.get("policy_fingerprint"), {k: data.get(k) for k in ("status", "trained_at_utc", "dataset_fingerprint")})

    @classmethod
    def load(cls, path: str | Path, policy: Policy | None = None, expected_track: str | None = TRACK_SUITABILITY) -> "LogisticModel":
        return cls.from_artifact(json.loads(Path(path).read_text(encoding="utf-8")), expected_track, policy)


def compatibility_problems(artifact: dict, policy: Policy) -> list[str]:
    """Reasons an artifact must not score under `policy` (empty list = compatible)."""
    out = []
    base = artifact.get("algorithm_base") or "hybrid-pyr-v0.2"
    if base != policy["algorithm_version"]:
        out.append(f"ALGORITMO_DISTINTO ({base} vs {policy['algorithm_version']})")
    if artifact.get("feature_schema_version") != policy.feature_schema_version:
        out.append("ESQUEMA_CARACTERISTICAS_DISTINTO")
    if artifact.get("policy_fingerprint") != policy.fingerprint:
        out.append("POLITICA_DISTINTA (huella de política diferente a la de entrenamiento; reentrenar o aprobar explícitamente)")
    accepted = set(policy.get("training", {}).get("accepted_label_sources", []))
    srcs = set((artifact.get("label_sources") or {}).keys())
    if artifact.get("model_track", TRACK_SUITABILITY) == TRACK_SUITABILITY and srcs - accepted:
        out.append("FUENTES_DE_ETIQUETA_NO_ACEPTADAS: " + ",".join(sorted(srcs - accepted)))
    return out


def fit_logistic(X: list[list[float]], y: list[int], l2: float, lr: float, epochs: int, seed: int,
                 sample_weight: list[float] | None = None) -> tuple[list[float], float]:
    rng = random.Random(seed)
    n, d = len(X), len(X[0])
    sw = sample_weight or [1.0] * n
    total_w = sum(sw)
    w = [rng.uniform(-0.01, 0.01) for _ in range(d)]
    b = 0.0
    for _ in range(epochs):
        gw = [0.0] * d
        gb = 0.0
        for xi, yi, wi in zip(X, y, sw):
            err = (_sigmoid(b + sum(wj * xj for wj, xj in zip(w, xi))) - yi) * wi
            for j in range(d):
                gw[j] += err * xi[j]
            gb += err
        w = [wj - lr * (g / total_w + l2 * wj / total_w) for wj, g in zip(w, gw)]
        b -= lr * gb / total_w
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


def period_key(p: str):
    return (p[:4], p[4:]) if len(p) >= 5 else (p, "")


_period_key = period_key  # backwards-compatible alias


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
            be.prepare(backend_texts(policy, [x for (_, p), x in smap.items() if p == lb.period], [x for (_, p), x in vmap.items() if p == lb.period]))
            backends[lb.period] = be
        if check_pair(s, v, policy, lb.period, "SIGA" if v.vacancy_type in policy["siga_vacancy_types"] else (v.vacancy_type or "")):
            blocked += 1  # hard-blocked pairs are never scored by any model
            continue
        raw = raw_components(s, v, policy, backends[lb.period])
        rows.append({"period": lb.period, "student": s.student_id, "vacancy": v.vacancy_id, "raw": raw,
                     "y": 1 if lb.value >= tc["positive_threshold"] else 0, "program": s.academic_program or "DESCONOCIDO",
                     "municipality": v.municipality or "DESCONOCIDO"})
    report.update({"etiquetas_sin_union": unjoined, "etiquetas_en_parejas_bloqueadas": blocked, "parejas_utilizables": len(rows)})
    periods = sorted({r["period"] for r in rows}, key=period_key)
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


def _subgroup_auc(rows, scorer, attr) -> dict:
    grp = defaultdict(list)
    for r in rows:
        grp[r[attr]].append(r)
    out = {}
    for g, rs in sorted(grp.items()):
        ys = [r["y"] for r in rs]
        a = auc([scorer(r) for r in rs], ys)
        out[g] = None if a is None else round(a, 4)
    return out


def train(bundle: InputBundle, policy: Policy, registry_dir: str | Path, command: str = "", encoder=None,
          label_provenance: dict | None = None) -> dict:
    tc = policy["training"]
    comps = model_components(policy)
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
        "preprocesamiento": "TF-IDF/embeddings ajustados por periodo con texto previo a la decisión; sin dependencia de etiquetas.",
    }
    for split, name in ((tr, "entrenamiento"), (te, "prueba")):
        if len({r["y"] for r in split}) < 2:
            raise NotTrainable([f"UNA_SOLA_CLASE_EN_{name.upper()}"], report)
    Xtr, ytr = [featurize(r["raw"], comps) for r in tr], [r["y"] for r in tr]
    w, b = fit_logistic(Xtr, ytr, tc["l2"], tc["learning_rate"], tc["epochs"], tc["seed"])
    fingerprint = hashlib.sha256(json.dumps([(r["period"], r["student"], r["vacancy"], r["y"]) for r in rows]).encode()).hexdigest()[:16]
    model_id = f"lr-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}-{fingerprint[:8]}"
    model = LogisticModel(model_id, w, b, feature_names(comps), comps)
    k = tc["eval_k"]

    def evaluate(split, scorer):
        scores = [scorer(r) for r in split]
        ys = [r["y"] for r in split]
        ll = -sum(y * math.log(max(1e-9, s / 100)) + (1 - y) * math.log(max(1e-9, 1 - s / 100)) for s, y in zip(scores, ys)) / len(ys)
        a = auc(scores, ys)
        return {"auc": None if a is None else round(a, 4), "log_loss_aprox": round(ll, 4), "n": len(split),
                **ranking_metrics([(r["student"], s, r["y"]) for r, s in zip(split, scores)], k)}

    baseline = lambda r: combine(r["raw"], policy.weights, policy.components)[0]  # noqa: E731
    learned = lambda r: model.predict_score(r["raw"])  # noqa: E731
    metrics = {"modelo_test": evaluate(te, learned), "linea_base_test": evaluate(te, baseline), "modelo_train": evaluate(tr, learned)}

    reg = Registry(registry_dir)
    active = None
    try:
        active = reg.active_model(policy)
    except (RegistryError, ValueError):
        active = None  # incompatible active model cannot be a fair comparator; reported below
    if active is not None:
        metrics["modelo_activo_test"] = {"model_id": active.model_id, **evaluate(te, lambda r: active.predict_score(r["raw"]))}

    fairness = {}
    for attr in ("program", "municipality"):
        grp = defaultdict(list)
        for r in te:
            grp[r[attr]].append(r)
        fairness[attr] = {g: {"n": len(rs), "positivos": sum(r["y"] for r in rs),
                              "puntaje_medio_modelo": round(sum(learned(r) for r in rs) / len(rs), 2),
                              "puntaje_medio_base": round(sum(baseline(r) for r in rs) / len(rs), 2)} for g, rs in sorted(grp.items())}
    subgroup = {attr: {"modelo": _subgroup_auc(te, learned, attr), "linea_base": _subgroup_auc(te, baseline, attr)} for attr in ("program", "municipality")}
    m_auc, b_auc = metrics["modelo_test"]["auc"], metrics["linea_base_test"]["auc"]
    gates = []
    if m_auc is None or b_auc is None or not (m_auc - b_auc > tc["promotion_min_auc_delta"]):
        gates.append("RECHAZADO_NO_SUPERA_LINEA_BASE")
    if active is not None and m_auc is not None and metrics["modelo_activo_test"]["auc"] is not None and m_auc <= metrics["modelo_activo_test"]["auc"]:
        gates.append("RECHAZADO_NO_SUPERA_MODELO_ACTIVO")
    if len(te) < tc.get("min_test_labels", 0):
        gates.append("RECHAZADO_PRUEBA_INSUFICIENTE")
    max_drop = tc.get("max_subgroup_auc_drop")
    if max_drop is not None:
        for attr, d in subgroup.items():
            for g, ma in d["modelo"].items():
                ba = d["linea_base"].get(g)
                if ma is not None and ba is not None and ba - ma > max_drop:
                    gates.append(f"RECHAZADO_DEGRADA_SUBGRUPO {attr}={g}")
    promoted = not gates
    overfit_gap = None if metrics["modelo_train"]["auc"] is None or m_auc is None else round(metrics["modelo_train"]["auc"] - m_auc, 4)
    artifact = {
        "model_id": model_id, "model_type": "logistic_regression_l2_reranker", "model_track": TRACK_SUITABILITY,
        "engine_version": __version__, "algorithm_base": policy["algorithm_version"], "feature_schema_version": policy.feature_schema_version,
        "components": list(comps), "features": feature_names(comps),
        "weights": w, "bias": b, "policy_id": policy["policy_id"], "policy_fingerprint": policy.fingerprint,
        "trained_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "dataset_fingerprint": fingerprint, "dataset_report": report, "leakage_audit": leakage,
        "hyperparameters": {k2: tc[k2] for k2 in ("l2", "learning_rate", "epochs", "positive_threshold")}, "seed": tc["seed"],
        "metrics": metrics, "overfitting_gap_auc_train_minus_test": overfit_gap, "fairness_audit": fairness,
        "subgroup_auc": subgroup, "promotion_gates_failed": gates,
        "constraint_violation_rate": 0.0,
        "status": PROMOTABLE if promoted else gates[0].split(" ")[0],
        "requires_human_approval_to_activate": True,
        "command": command,
        "label_sources": report["etiquetas_por_fuente"],
        "label_provenance": label_provenance or {},
    }
    auto = bool(tc.get("auto_activate", False)) and promoted
    reg.save(artifact, activate=auto)
    artifact["activated"] = auto
    return artifact


class Registry:
    """File registry per track: <dir>/<model_id>/model.json and <dir>/registry.json {track, active, history}.

    Suitability (Track B) and behaviour (Track A) models must use DIFFERENT registry folders; a registry
    refuses artifacts of the other track.
    """

    def __init__(self, root: str | Path, track: str = TRACK_SUITABILITY):
        self.root = Path(root)
        self.track = track
        self.index_path = self.root / "registry.json"

    def index(self) -> dict:
        if self.index_path.exists():
            idx = json.loads(self.index_path.read_text(encoding="utf-8"))
            idx.setdefault("track", TRACK_SUITABILITY)
            if idx["track"] != self.track:
                raise RegistryError(f"REGISTRO_DE_OTRA_PISTA: el registro es '{idx['track']}', se pidió '{self.track}'.")
            return idx
        return {"track": self.track, "active": None, "history": []}

    def _write(self, idx):
        self.root.mkdir(parents=True, exist_ok=True)
        self.index_path.write_text(json.dumps(idx, indent=2, ensure_ascii=False), encoding="utf-8")

    def _now(self):
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    def artifact(self, model_id: str) -> dict:
        p = self.root / model_id / "model.json"
        if not p.exists():
            raise FileNotFoundError(model_id)
        return json.loads(p.read_text(encoding="utf-8"))

    def save(self, artifact: dict, activate: bool = False):
        if artifact.get("model_track", TRACK_SUITABILITY) != self.track:
            raise RegistryError("El artefacto pertenece a otra pista; use su propio registro.")
        idx = self.index()
        d = self.root / artifact["model_id"]
        d.mkdir(parents=True, exist_ok=True)
        (d / "model.json").write_text(json.dumps(artifact, indent=2, ensure_ascii=False), encoding="utf-8")
        idx["history"].append({"model_id": artifact["model_id"], "event": "REGISTRADO", "status": artifact["status"], "at_utc": self._now()})
        if activate:
            idx["history"].append({"model_id": artifact["model_id"], "event": "ACTIVADO_AUTOMATICAMENTE_POR_POLITICA", "at_utc": self._now()})
            idx["active"] = artifact["model_id"]
        self._write(idx)

    def activation_problems(self, model_id: str, policy: Policy) -> list[str]:
        art = self.artifact(model_id)
        problems = []
        if art.get("model_track", TRACK_SUITABILITY) != self.track:
            problems.append("PISTA_INCORRECTA")
        if self.track == TRACK_BEHAVIOR:
            problems.append("MODELO_DE_COMPORTAMIENTO_NO_ACTIVABLE (experimental; solo análisis/señal con peso explícito)")
        if art.get("status") != PROMOTABLE:
            problems.append(f"ESTADO_NO_PROMOVIBLE ({art.get('status')})")
        problems += compatibility_problems(art, policy)
        if self.track == TRACK_SUITABILITY:
            try:
                LogisticModel.from_artifact(art, self.track)
            except (ValueError, KeyError) as exc:
                problems.append(f"ARTEFACTO_INVALIDO: {exc}")
        return problems

    def activate(self, model_id: str | None, policy: Policy | None = None, approved_by: str | None = None, reason: str | None = None):
        """Activate a model (requires compatible policy + named approver) or roll back to baseline (None)."""
        idx = self.index()
        if model_id is not None:
            if policy is None:
                raise RegistryError("Se requiere la política vigente para verificar compatibilidad antes de activar.")
            if not (approved_by and approved_by.strip()):
                raise RegistryError("APROBACION_REQUERIDA: indique --approved-by (rol/persona responsable).")
            problems = self.activation_problems(model_id, policy)
            if problems:
                raise RegistryError("ACTIVACION_RECHAZADA: " + "; ".join(problems))
        idx["history"].append({"model_id": model_id or "LINEA_BASE", "event": "ACTIVADO_MANUALMENTE" if model_id else "REVERTIDO_A_LINEA_BASE",
                               "previous_active": idx.get("active"), "approved_by": approved_by, "reason": reason,
                               "policy_fingerprint": policy.fingerprint if policy else None, "at_utc": self._now()})
        idx["active"] = model_id
        self._write(idx)

    def rollback(self, policy: Policy | None = None, approved_by: str | None = None) -> str | None:
        """Re-activate the model that was active before the current one (or baseline)."""
        idx = self.index()
        prev = None
        for ev in reversed(idx["history"]):
            if ev.get("event", "").startswith("ACTIVADO") or ev.get("event") == "REVERTIDO_A_LINEA_BASE":
                prev = ev.get("previous_active")
                break
        if prev is None or policy is None:
            self.activate(None, policy, approved_by, "rollback")
            return None
        try:
            self.activate(prev, policy, approved_by or "rollback", "rollback")
        except RegistryError:
            self.activate(None, policy, approved_by, "rollback: modelo previo incompatible")
            return None
        return prev

    def active_model(self, policy: Policy | None = None) -> LogisticModel | None:
        mid = self.index().get("active")
        if not mid:
            return None
        return LogisticModel.load(self.root / mid / "model.json", policy=policy, expected_track=self.track)
