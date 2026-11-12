"""Command line: `pyr-match <command>` (or `python -m pyr_matching <command>`).

Exit codes: 0 ok · 2 validation/mapping error · 3 not trainable (missing/invalid labels) · 1 unexpected.
Logs contain counts, codes and IDs only – never names, documents or free-text answers.
"""
from __future__ import annotations

import argparse
import json
import shlex
import sys
from pathlib import Path

from . import __version__
from .io_excel import MappingError, load_mapping, read_bundle, read_output_table, write_result
from .pipeline import ValidationFailed, run_match, validate
from .policy import Policy, PolicyError


def _common(p):
    p.add_argument("--inputs", nargs="+", required=True, help="Uno o más .xlsx (libro único o un archivo por hoja).")
    p.add_argument("--period", required=True, help="Periodo académico, p. ej. 2027A.")
    p.add_argument("--policy", default=None, help="JSON de política versionada (por defecto config/policy_pyr_provisional.json).")
    p.add_argument("--mapping", default=None, help="JSON de mapeo de encabezados (por defecto config/mapping_canonical.json).")


def main(argv=None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):  # pragma: no cover - non-standard streams
            pass
    ap = argparse.ArgumentParser(prog="pyr-match", description="Motor de emparejamiento Paz y Región (Excel → Excel).")
    ap.add_argument("--version", action="version", version=__version__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    v = sub.add_parser("validate", help="Valida insumos sin producir recomendaciones.")
    _common(v)

    m = sub.add_parser("match", help="Ejecuta el emparejamiento y exporta el libro de resultados.")
    _common(m)
    m.add_argument("--out", required=True, help="Ruta del .xlsx de salida.")
    m.add_argument("--json-out", default=None, help="Además, exporta el resultado estructurado (contrato JSON).")
    m.add_argument("--semantic", choices=["tfidf", "sentence-transformers", "none"], default=None, help="Sobrescribe el backend semántico de la política.")
    m.add_argument("--model", default=None, help="Ruta a model.json de un modelo supervisado promovido (opcional).")
    m.add_argument("--registry", default=None, help="Usa el modelo activo del registro (si existe).")
    m.add_argument("--simulate", action="store_true", help="Agrega hoja de simulación NO vinculante de asignación general.")
    m.add_argument("--pairs", choices=["none", "top", "all"], default="top", help="Detalle de Pares_Evaluados.")
    m.add_argument("--timestamp", default=None, help="Marca de tiempo fija (reproducibilidad).")

    r = sub.add_parser("reconcile", help="Concilia matrículas SIGA reales con directas y cupos.")
    _common(r)
    r.add_argument("--enrollments", required=True, nargs="+", help=".xlsx con hoja Matriculas_SIGA.")
    r.add_argument("--previous-output", default=None, help="Salida previa de match (para medir rango de la plaza elegida).")
    r.add_argument("--out", required=True)

    t = sub.add_parser("train", help="Entrena un re-ranqueador SOLO con etiquetas institucionales validadas.")
    _common(t)
    t.add_argument("--labels", nargs="+", required=True, help=".xlsx con hoja Etiquetas.")
    t.add_argument("--registry", required=True, help="Directorio del registro de modelos (fuera de git).")

    g = sub.add_parser("registry", help="Lista, activa o revierte modelos.")
    g.add_argument("--registry", required=True)
    g.add_argument("action", choices=["list", "activate", "rollback-to-baseline"])
    g.add_argument("--model-id", default=None)

    s = sub.add_parser("make-sample", help="Genera libros sintéticos de ejemplo (sin datos reales).")
    s.add_argument("--out", required=True)
    s.add_argument("--kind", choices=["hand", "random"], default="hand")
    s.add_argument("--students", type=int, default=200)
    s.add_argument("--vacancies", type=int, default=80)
    s.add_argument("--seed", type=int, default=7)

    a = ap.parse_args(argv)
    try:
        if a.cmd == "make-sample":
            from .fixtures import hand_scenario, random_scenario

            path = hand_scenario(a.out) if a.kind == "hand" else random_scenario(a.out, n_students=a.students, n_vacancies=a.vacancies, seed=a.seed)
            print(f"Libro sintético escrito en {path}")
            return 0
        if a.cmd == "registry":
            from .training import Registry

            reg = Registry(a.registry)
            if a.action == "activate":
                reg.activate(a.model_id)
            elif a.action == "rollback-to-baseline":
                reg.activate(None)
            print(json.dumps(reg.index(), indent=2, ensure_ascii=False))
            return 0

        policy = Policy.load(a.policy)
        mapping = load_mapping(a.mapping)
        bundle = read_bundle(a.inputs, policy, mapping)

        if a.cmd == "validate":
            issues, warns = validate(bundle, a.period, policy)
            print(json.dumps({"periodo": a.period, "bloqueantes": issues, "advertencias": bundle.load_warnings + warns,
                              "estudiantes": len(bundle.students), "plazas": len(bundle.vacancies), "decisiones": len(bundle.decisions),
                              "matriculas": len(bundle.enrollments)}, indent=2, ensure_ascii=False))
            return 2 if issues else 0

        if a.cmd == "match":
            model = None
            if a.model:
                from .training import LogisticModel

                model = LogisticModel.load(a.model)
            elif a.registry:
                from .training import Registry

                model = Registry(a.registry).active_model()
            res = run_match(bundle, a.period, policy, semantic_override=a.semantic, model=model,
                            simulate_general_assignment=a.simulate, pairs_detail=a.pairs, run_timestamp=a.timestamp)
            write_result(res, a.out)
            if a.json_out:
                Path(a.json_out).write_text(json.dumps(res.to_json_dict(), indent=1, ensure_ascii=False, default=str), encoding="utf-8")
            s = res.summary
            print(f"OK {a.period}: confirmadas={s['directas_confirmadas']} propuestas={s['directas_propuestas']} "
                  f"gestion_humana={s['requieren_gestion_humana']} pendientes={s['pendientes_aprobacion']} "
                  f"electivos_con_recomendacion={s['estudiantes_con_recomendacion']}/{s['estudiantes_electivos']} "
                  f"backend={s['backend_semantico']} modelo={s['modelo_supervisado']} -> {a.out}")
            for w in res.warnings:
                print("ADVERTENCIA:", w)
            return 0

        if a.cmd == "reconcile":
            from .reconcile import reconcile

            enr_bundle = read_bundle(a.enrollments, policy, {**mapping, "entities": {
                **{k: {**v, "optional_sheet": True} for k, v in mapping["entities"].items()}}})
            prev = read_output_table(a.previous_output, "Recomendaciones_SIGA") if a.previous_output else None
            res = reconcile(bundle, enr_bundle.enrollments, a.period, policy, prev)
            write_result(res, a.out)
            print(json.dumps(res.summary, indent=2, ensure_ascii=False))
            return 0

        if a.cmd == "train":
            from .training import NotTrainable, train

            lab = read_bundle(a.labels, policy, {**mapping, "entities": {
                **{k: {**v, "optional_sheet": True} for k, v in mapping["entities"].items()}}})
            bundle.labels = lab.labels
            try:
                art = train(bundle, policy, a.registry, command="pyr-match " + " ".join(shlex.quote(x) for x in (argv or sys.argv[1:])))
            except NotTrainable as exc:
                print(json.dumps({"estado": "NO_ENTRENABLE", "motivos": exc.reasons, "reporte": exc.report}, indent=2, ensure_ascii=False))
                return 3
            print(json.dumps({k: art[k] for k in ("model_id", "status", "metrics", "leakage_audit", "overfitting_gap_auc_train_minus_test")}, indent=2, ensure_ascii=False))
            return 0
    except (ValidationFailed,) as exc:
        print(json.dumps({"error": "VALIDACION", "problemas": exc.issues}, indent=2, ensure_ascii=False), file=sys.stderr)
        return 2
    except (MappingError, PolicyError) as exc:
        print(f"ERROR DE CONFIGURACION/MAPEO: {exc}", file=sys.stderr)
        return 2
    return 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
