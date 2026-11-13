"""Command line: `pyr-match <command>` (or `python -m pyr_matching <command>`).

Exit codes: 0 ok · 2 validation/mapping error · 3 not trainable (missing/invalid labels) ·
4 model/registry refused (incompatible, not approved, wrong track) · 1 unexpected.
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
    m.add_argument("--registry", default=None, help="Usa el modelo activo del registro (si existe y es compatible con la política).")
    m.add_argument("--behavior-model", default=None, help="model.json de comportamiento histórico (EXPERIMENTAL; solo v0.3 y solo si la política le da peso).")
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

    g = sub.add_parser("registry", help="Lista, verifica, activa (con aprobación) o revierte modelos.")
    g.add_argument("--registry", required=True)
    g.add_argument("action", choices=["list", "check", "activate", "rollback", "rollback-to-baseline"])
    g.add_argument("--model-id", default=None)
    g.add_argument("--policy", default=None, help="Política vigente contra la que se verifica la compatibilidad.")
    g.add_argument("--approved-by", default=None, help="Rol/persona que aprueba la activación (obligatorio para activar).")
    g.add_argument("--reason", default=None)
    g.add_argument("--track", choices=["suitability", "behavior"], default="suitability")

    dm = sub.add_parser("download-model", help="Descarga explícita (una vez) del modelo público de embeddings. No envía datos.")
    dm.add_argument("--model", default=None, help="Por defecto, el de la política.")
    dm.add_argument("--policy", default=None)
    dm.add_argument("--cache-folder", default=None)

    s = sub.add_parser("make-sample", help="Genera libros sintéticos de ejemplo (sin datos reales).")
    s.add_argument("--out", required=True)
    s.add_argument("--kind", choices=["hand", "random"], default="hand")
    s.add_argument("--students", type=int, default=200)
    s.add_argument("--vacancies", type=int, default=80)
    s.add_argument("--seed", type=int, default=7)

    hb = sub.add_parser("historical-build", help="Reconstruye el histórico canónico (seudonimizado) desde exportaciones Excel locales.")
    hb.add_argument("--manifest", required=True, help="JSON con las fuentes {kind, period, path, sheet?} y capacity_mode.")
    hb.add_argument("--out-dir", required=True, help="Carpeta institucional FUERA de git.")
    hb.add_argument("--pseudonym-key-file", default=None, help="Archivo con la clave secreta (por defecto variable PYR_PSEUDONYM_KEY).")
    hb.add_argument("--capacity-mode", choices=["none", "approved_column", "row_count", "observed_count"], default=None,
                    help="Reconstrucción de cupos (requiere autorización institucional; por defecto la del manifiesto o none).")
    hb.add_argument("--policy", default=None)
    hb.add_argument("--export-engine-period", default=None, help="Además exporta ese periodo en el contrato Excel del motor.")
    hb.add_argument("--allow-inside-repo", action="store_true", help="Solo para pruebas: permite escribir dentro del repositorio.")

    hs = sub.add_parser("make-historical-sample", help="Genera libros históricos SINTÉTICOS en formato institucional + manifiesto.")
    hs.add_argument("--out-dir", required=True)
    hs.add_argument("--seed", type=int, default=11)

    tb = sub.add_parser("train-behavior", help="Pista A (EXPERIMENTAL): modelo de comportamiento histórico. No es idoneidad.")
    tb.add_argument("--dataset", required=True, help="historico_canonico.json/.xlsx producido por historical-build.")
    tb.add_argument("--registry", required=True, help="Registro de la pista 'behavior' (carpeta distinta a la de idoneidad, fuera de git).")
    tb.add_argument("--policy", default=None, help="Política v0.3 (por defecto config/policy_pyr_v03_provisional.json).")
    tb.add_argument("--test-period", default=None, help="Periodo de prueba intocado (por defecto el último).")
    tb.add_argument("--candidate-mode", choices=["eligible_with_uptake", "eligible_all"], default="eligible_with_uptake")
    tb.add_argument("--semantic", choices=["tfidf", "sentence-transformers", "none"], default=None)

    ev = sub.add_parser("evaluate-historical", help="Evaluación temporal: comportamiento histórico vs factibilidad (no idoneidad).")
    ev.add_argument("--dataset", required=True)
    ev.add_argument("--out-dir", required=True, help="Carpeta institucional fuera de git (Excel, JSON, Markdown).")
    ev.add_argument("--test-period", default=None)
    ev.add_argument("--candidate-mode", choices=["eligible_with_uptake", "eligible_all"], default="eligible_with_uptake")
    ev.add_argument("--embeddings", action="store_true", help="Incluye embeddings locales (modelo ya descargado).")
    ev.add_argument("--policy-v03", default=None)
    ev.add_argument("--allow-inside-repo", action="store_true")

    ft = sub.add_parser("feedback-template", help="Ejecuta match y genera el libro de revisión experta de parejas.")
    _common(ft)
    ft.add_argument("--out", required=True)
    ft.add_argument("--per-student", type=int, default=3)
    ft.add_argument("--blind", action="store_true", help="Oculta puntaje y explicación (reduce sesgo de anclaje; recomendado para etiquetas).")
    ft.add_argument("--semantic", choices=["tfidf", "sentence-transformers", "none"], default=None)
    ft.add_argument("--timestamp", default=None)
    ft.add_argument("--allow-inside-repo", action="store_true")

    fi = sub.add_parser("feedback-import", help="Valida y versiona revisiones APROBADAS en un almacén fuera de git.")
    fi.add_argument("--files", nargs="+", required=True)
    fi.add_argument("--store", required=True)
    fi.add_argument("--allow-inside-repo", action="store_true")

    rt = sub.add_parser("retrain", help="Reentrena un candidato con la retroalimentación aprobada (nunca lo activa).")
    _common(rt)
    rt.add_argument("--feedback-store", required=True)
    rt.add_argument("--registry", required=True)
    rt.add_argument("--report-out", default=None)

    mj = sub.add_parser("match-json", help="Contrato JSON pyr-match-request/1.0 -> pyr-match-result/1.0 (integración).")
    mj.add_argument("--request", required=True)
    mj.add_argument("--out", required=True)
    mj.add_argument("--policy", default=None, help="Ruta de política (si no, la indicada en la solicitud).")

    a = ap.parse_args(argv)
    try:
        if a.cmd == "evaluate-historical":
            from .evaluation import evaluate_historical, write_evaluation
            from .historical import load_dataset
            from .policy import POLICY_V03_PATH

            rep = evaluate_historical(load_dataset(a.dataset), Policy.load(a.policy_v03 or POLICY_V03_PATH), None, a.test_period, a.candidate_mode, a.embeddings)
            paths = write_evaluation(rep, a.out_dir, a.allow_inside_repo)
            print(json.dumps({"estado": rep.get("estado"), "periodo_prueba": rep.get("periodo_prueba"), "salidas": {k: str(v) for k, v in paths.items()},
                              "descargo": rep.get("descargo")}, indent=2, ensure_ascii=False))
            return 0
        if a.cmd == "feedback-import":
            from .feedback import FeedbackError, import_feedback

            try:
                print(json.dumps(import_feedback(a.files, a.store, a.allow_inside_repo), indent=2, ensure_ascii=False))
            except FeedbackError as exc:
                print(f"RETROALIMENTACION: {exc}", file=sys.stderr)
                return 2
            return 0
        if a.cmd == "match-json":
            from .api import match_request

            req = json.loads(Path(a.request).read_text(encoding="utf-8"))
            res = match_request(req, Policy.load(a.policy) if a.policy else None)
            Path(a.out).write_text(json.dumps(res, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
            print(json.dumps({"status": res.get("status"), "out": a.out}, ensure_ascii=False))
            return 0 if res.get("status") == "OK" else 2
        if a.cmd == "train-behavior":
            from .behavior import NotEnoughHistory, train_behavior
            from .historical import load_dataset
            from .policy import POLICY_V03_PATH

            pol = Policy.load(a.policy or POLICY_V03_PATH)
            try:
                art = train_behavior(load_dataset(a.dataset), pol, a.registry, a.test_period, a.candidate_mode, a.semantic,
                                     command="pyr-match " + " ".join(shlex.quote(x) for x in (argv or sys.argv[1:])))
            except NotEnoughHistory as exc:
                print(json.dumps({"estado": "HISTORIA_INSUFICIENTE", "motivos": exc.reasons, "reporte": exc.report}, indent=2, ensure_ascii=False))
                return 3
            print(json.dumps({k: art[k] for k in ("model_id", "status", "report", "metrics", "limitations")}, indent=2, ensure_ascii=False))
            return 0
        if a.cmd == "make-historical-sample":
            from .historical.synthetic import make_historical_sample

            print(f"Manifiesto sintético: {make_historical_sample(a.out_dir, seed=a.seed)}")
            return 0
        if a.cmd == "historical-build":
            from .historical import HistoricalConfigError, Pseudonymizer, UnsafeOutputLocation, build_historical_dataset, write_dataset
            from .historical.store import export_engine_workbook

            try:
                manifest = json.loads(Path(a.manifest).read_text(encoding="utf-8"))
                if a.capacity_mode:
                    manifest["capacity_mode"] = a.capacity_mode
                pz = Pseudonymizer.from_env_or_file(a.pseudonym_key_file)
                ds = build_historical_dataset(manifest, pz, Policy.load(a.policy), base_dir=Path(a.manifest).parent)
                paths = write_dataset(ds, a.out_dir, a.allow_inside_repo)
                if a.export_engine_period:
                    paths["engine_xlsx"] = export_engine_workbook(ds, a.export_engine_period, Path(a.out_dir) / f"insumo_motor_{a.export_engine_period}.xlsx", a.allow_inside_repo)
            except (HistoricalConfigError, UnsafeOutputLocation, ValueError) as exc:
                print(f"HISTORICO: {exc}", file=sys.stderr)
                return 2
            print(json.dumps({"meta": ds.meta, "salidas": {k: str(v) for k, v in paths.items()}}, indent=2, ensure_ascii=False))
            return 0
        if a.cmd == "make-sample":
            from .fixtures import hand_scenario, random_scenario

            path = hand_scenario(a.out) if a.kind == "hand" else random_scenario(a.out, n_students=a.students, n_vacancies=a.vacancies, seed=a.seed)
            print(f"Libro sintético escrito en {path}")
            return 0
        if a.cmd == "download-model":
            from .semantic import download_model

            pol = Policy.load(a.policy)
            name = a.model or pol["semantic"]["embedding_model"]
            download_model(name, a.cache_folder)
            print(f"Modelo disponible localmente: {name}")
            return 0
        if a.cmd == "registry":
            from .training import Registry, RegistryError

            reg = Registry(a.registry, track=a.track)
            pol = Policy.load(a.policy) if a.policy else None
            try:
                if a.action == "check":
                    if not (a.model_id and pol):
                        print("check requiere --model-id y --policy", file=sys.stderr)
                        return 2
                    probs = reg.activation_problems(a.model_id, pol)
                    print(json.dumps({"model_id": a.model_id, "activable": not probs, "problemas": probs}, indent=2, ensure_ascii=False))
                    return 0 if not probs else 4
                if a.action == "activate":
                    reg.activate(a.model_id, pol, a.approved_by, a.reason)
                elif a.action == "rollback":
                    reg.rollback(pol, a.approved_by)
                elif a.action == "rollback-to-baseline":
                    reg.activate(None, pol, a.approved_by, a.reason)
            except RegistryError as exc:
                print(f"REGISTRO: {exc}", file=sys.stderr)
                return 4
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
            model = behavior = None
            try:
                if a.model:
                    from .training import LogisticModel

                    model = LogisticModel.load(a.model, policy=policy)
                elif a.registry:
                    from .training import Registry

                    model = Registry(a.registry).active_model(policy)
                if a.behavior_model:
                    from .behavior import BehaviorModel

                    behavior = BehaviorModel.load(a.behavior_model, policy)
            except ValueError as exc:
                print(f"MODELO RECHAZADO: {exc}", file=sys.stderr)
                return 4
            res = run_match(bundle, a.period, policy, semantic_override=a.semantic, model=model, behavior_model=behavior,
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

        if a.cmd == "feedback-template":
            from .feedback import make_review_workbook

            res = run_match(bundle, a.period, policy, semantic_override=a.semantic, pairs_detail="all", run_timestamp=a.timestamp)
            out = make_review_workbook(res, bundle, a.period, a.out, policy, a.per_student, a.blind, a.allow_inside_repo)
            print(f"Libro de revisión: {out}")
            return 0

        if a.cmd == "retrain":
            from .retrain import retrain, write_report

            rep = retrain(bundle, policy, a.feedback_store, a.registry, command="pyr-match " + " ".join(shlex.quote(x) for x in (argv or sys.argv[1:])))
            if a.report_out:
                write_report(rep, a.report_out)
            print(json.dumps(rep, indent=2, ensure_ascii=False, default=str))
            return 3 if rep["estado"] == "NO_ENTRENABLE" else 0

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
