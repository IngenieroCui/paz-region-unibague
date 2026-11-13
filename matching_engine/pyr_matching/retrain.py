"""Phase 5 – reproducible retraining workflow (Track B, suitability). Never promotes on its own.

    1. import validated feedback   -> feedback.import_feedback (versioned store)
    2. data sufficiency            -> training.build_dataset gates (NotTrainable with reasons)
    3. train candidate             -> training.train (temporal split, seed, provenance)
    4. compare with active model   -> training.train evaluates baseline AND active compatible model
    5. temporal + subgroup checks  -> promotion gates (subgroup AUC drop, minimum test size)
    6. register                    -> Registry.save (status PROMOVIBLE or RECHAZADO_*), feedback versions recorded
    7. promote (human)             -> `pyr-match registry activate --approved-by ...` (policy-checked)
    8. rollback                    -> `pyr-match registry rollback` / `rollback-to-baseline`
"""
from __future__ import annotations

import json
from pathlib import Path

from .feedback import load_feedback_labels
from .policy import Policy
from .schema import InputBundle
from .training import NotTrainable, train


def retrain(bundle: InputBundle, policy: Policy, feedback_store: str | Path, registry_dir: str | Path, command: str = "", encoder=None) -> dict:
    labels, prov = load_feedback_labels(feedback_store)
    bundle.labels = labels
    report = {"paso_1_retroalimentacion": prov}
    try:
        art = train(bundle, policy, registry_dir, command=command, encoder=encoder, label_provenance=prov)
    except NotTrainable as exc:
        report.update({"estado": "NO_ENTRENABLE", "paso_2_suficiencia": {"motivos": exc.reasons, "reporte": exc.report},
                       "siguiente_paso": "Recolectar más revisiones expertas aprobadas (ver motivos)."})
        return report
    report.update({
        "estado": art["status"], "model_id": art["model_id"], "activado": art["activated"],
        "paso_2_suficiencia": art["dataset_report"], "paso_4_metricas": art["metrics"],
        "paso_5_compuertas_fallidas": art["promotion_gates_failed"], "paso_5_subgrupos": art["subgroup_auc"],
        "paso_6_registro": str(Path(registry_dir) / art["model_id"] / "model.json"),
        "siguiente_paso": ("Revisión humana y, si procede: pyr-match registry activate --model-id " + art["model_id"] +
                           " --policy <política> --approved-by \"<rol>\"") if art["status"] == "PROMOVIBLE" else "No promover; conservar el modelo activo o la línea base.",
    })
    return report


def write_report(report: dict, path: str | Path) -> Path:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return p
