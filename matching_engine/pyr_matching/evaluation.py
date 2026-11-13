"""Phase 4 – rigorous HISTORICAL evaluation with a chronological split.

What is measured, and what it means
* "Prediction of past behaviour": how high each ranker places the placement a student ACTUALLY ended up
  in (SIGA choices only by default), among the hard-rule-eligible placements of that period
  (Recall@3/5, MRR, NDCG@5). This measures agreement with historical decisions shaped by self-selection,
  availability and arrival order. It is NOT evidence that a placement was suitable.
* "Allocation feasibility": candidate coverage (observed outcomes the engine would allow), eligible-
  placement coverage, direct-placement feasibility, and constraint/capacity violations of a retrospective,
  non-binding simulation (independently audited).
* "Actual quality": only with institutionally validated suitability labels (Track B). Historical quality
  feedback is post-placement and NOT validated as suitability (D14), so it is never used here.

Leakage controls
* Test period untouched: the behaviour model is trained only on strictly earlier periods.
* TF-IDF / embeddings are unsupervised and fitted per period on that period's pre-decision text only.
* No label-dependent feature construction; no quality feedback; repeated students are reported.
* Candidate sets use observed uptake ONLY as a proxy of availability (documented limitation).
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from .audit import audit_result  # noqa: F401  (used through run_match)
from .behavior import NotEnoughHistory, choice_metrics, train_behavior
from .constraints import check_pair, program_relation
from .historical.builder import HistoricalDataset
from .historical.choice import build_period_context
from .historical.store import assert_safe_output_dir, to_input_bundle
from .optimizer import Edge, min_cost_assignment
from .pipeline import run_match
from .policy import POLICY_V03_PATH, Policy
from .scoring import _round2, backend_texts, combine, component_scores, component_scores_v03
from .semantic import TfidfBackend, build_backend
from .training import period_key

DISCLAIMER = ("Estas métricas miden coincidencia con decisiones HISTÓRICAS (autoselección SIGA bajo disponibilidad y orden de llegada), "
              "no idoneidad estudiante-plaza. No deben presentarse como prueba de calidad de las recomendaciones.")


def _rank_metrics_for(ctx_rows, scorer):
    data = []
    for sit, cand_raw in ctx_rows:
        if not sit.observed_in_candidates or len(sit.candidates) < 1:
            continue
        ids = [v.vacancy_id for v in sit.candidates]
        y = ids.index(sit.observed)
        data.append(([cand_raw[i] for i in range(len(ids))], y, ids, sit.student.student_id))
    return choice_metrics(data, scorer), data


def _subgroups(data, scorer, key_of) -> dict:
    groups = defaultdict(list)
    for row in data:
        groups[key_of(row) or "DESCONOCIDO"].append(row)
    out = {}
    for g, rows in sorted(groups.items()):
        m = choice_metrics(rows, scorer)
        out[g] = {"n": m["situaciones"], "mrr": m.get("mrr"), "recall@5": m.get("recall@5"), "recall@5_aleatorio_esperado": m.get("recall@5_aleatorio_esperado")}
    return out


def evaluate_historical(ds: HistoricalDataset, policy_v03: Policy | None = None, policy_v02: Policy | None = None, test_period: str | None = None,
                        candidate_mode: str = "eligible_with_uptake", embeddings: bool = False, encoder=None, mechanisms=("SIGA",)) -> dict:
    p03 = policy_v03 or Policy.load(POLICY_V03_PATH)
    p02 = policy_v02 or Policy.load()
    periods = sorted({a["period"] for a in ds.allocations}, key=period_key)
    if not periods:
        return {"estado": "NO_EVALUABLE", "motivos": ["SIN_ASIGNACIONES_OBSERVADAS"], "descargo": DISCLAIMER}
    test_period = test_period or periods[-1]
    train_periods = [p for p in periods if period_key(p) < period_key(test_period)]
    report: dict = {
        "estado": "EVALUADO", "descargo": DISCLAIMER, "periodo_prueba": test_period, "periodos_desarrollo": train_periods,
        "modo_conjunto_candidatos": candidate_mode, "mecanismos_evaluados": list(mechanisms),
        "fecha_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "dataset": {k: ds.meta.get(k) for k in ("dataset_schema", "pseudonym_key_fingerprint", "capacity_mode", "capacity_status", "periods")},
        "politicas": {"v0.2": p02["policy_id"] + "@" + p02.fingerprint, "v0.3": p03["policy_id"] + "@" + p03.fingerprint},
    }

    # ---- choice situations of the test period (TF-IDF context) ---------------------------------
    ctx = build_period_context(ds, test_period, p03, mechanisms, candidate_mode, "tfidf")
    be02 = TfidfBackend()
    be02.prepare(backend_texts(p02, list(ctx.students.values()), list(ctx.vacancies.values())))
    rows_tfidf = []
    for sit in ctx.situations:
        rows_tfidf.append((sit, [component_scores_v03(sit.student, v, p03, ctx.backend) | {"_v02": component_scores(sit.student, v, p02, be02)} for v in sit.candidates]))
    report["situaciones"] = {"total": len(ctx.situations), "observada_en_conjunto": sum(1 for s in ctx.situations if s.observed_in_candidates),
                             "excluidas": ctx.excluded, "tamano_medio_conjunto": round(sum(len(s.candidates) for s in ctx.situations) / max(1, len(ctx.situations)), 2)}
    rankers = {
        "solo_programa": lambda raw, vid: (raw["program"] or 0.0),
        "hybrid-pyr-v0.2": lambda raw, vid: combine(raw["_v02"], p02.weights, p02.components)[0],
        "tfidf_semantico": lambda raw, vid: (raw["semantic"] if raw["semantic"] is not None else -1.0),
        "hybrid-pyr-v0.3_tfidf": lambda raw, vid: combine(raw, p03.weights, p03.components)[0],
    }
    results, data_main = {}, None
    for name, fn in rankers.items():
        m, data = _rank_metrics_for(rows_tfidf, fn)
        results[name] = {**m, "tipo": "linea_base" if name == "solo_programa" else "heuristico_no_entrenado"}
        if name == "hybrid-pyr-v0.3_tfidf":
            data_main = (data, fn)

    # ---- embeddings ------------------------------------------------------------------------------
    if embeddings:
        be, warns = build_backend(p03, "sentence-transformers", encoder=encoder)
        if warns:
            results["embeddings_semantico"] = {"estado": "NO_DISPONIBLE", "detalle": warns}
        else:
            ctx_e = build_period_context(ds, test_period, p03, mechanisms, candidate_mode, "sentence-transformers", encoder)
            rows_e = [(sit, [component_scores_v03(sit.student, v, p03, ctx_e.backend) for v in sit.candidates]) for sit in ctx_e.situations]
            m, _ = _rank_metrics_for(rows_e, lambda raw, vid: (raw["semantic"] if raw["semantic"] is not None else -1.0))
            results["embeddings_semantico"] = {**m, "tipo": "heuristico_no_entrenado", "backend": ctx_e.backend.version}
            m, _ = _rank_metrics_for(rows_e, lambda raw, vid: combine(raw, p03.weights, p03.components)[0])
            results["hybrid-pyr-v0.3_embeddings"] = {**m, "tipo": "heuristico_no_entrenado", "backend": ctx_e.backend.version}
    else:
        results["embeddings_semantico"] = {"estado": "NO_EJECUTADO", "detalle": "use --embeddings con el modelo local disponible"}

    # ---- behaviour model (trained strictly before the test period) --------------------------------
    try:
        art = train_behavior(ds, p03, None, test_period, candidate_mode, "tfidf")
        bm = art["_model"]
        m, _ = _rank_metrics_for(rows_tfidf, lambda raw, vid: bm.utility(raw))
        results["comportamiento_historico"] = {**m, "tipo": "ENTRENADO_EXPERIMENTAL (pista A)", "model_id": art["model_id"],
                                               "periodos_entrenamiento": art["report"]["periodos_entrenamiento"],
                                               "estudiantes_repetidos_train_test": art["report"]["estudiantes_repetidos_train_test"]}
    except NotEnoughHistory as exc:
        results["comportamiento_historico"] = {"estado": "NO_EVALUABLE", "motivos": exc.reasons}
    results["idoneidad_supervisada"] = {"estado": "NO_EVALUABLE", "motivos": ["SIN_ETIQUETAS_DE_IDONEIDAD_VALIDADAS (B4)"]}
    report["comparacion"] = results

    # ---- subgroups (main heuristic) -----------------------------------------------------------------
    if data_main:
        data, fn = data_main
        sids = {s.student_id: s for s in ctx.students.values()}
        report["subgrupos_programa"] = _subgroups(data, fn, lambda r: sids[r[3]].academic_program)
        report["subgrupos_municipio_origen"] = _subgroups(data, fn, lambda r: sids[r[3]].origin_municipality)

    report["cobertura"] = coverage_metrics(ds, test_period, p03)
    report["directas"] = direct_feasibility(ds, test_period, p03)
    report["simulacion_retrospectiva"] = retrospective_simulation(ds, test_period, p03)
    report["controles_fuga"] = {
        "periodo_prueba_intocado": True,
        "preprocesamiento": "no supervisado, ajustado por periodo con texto previo a la decisión",
        "caracteristicas_dependientes_de_etiqueta": "ninguna",
        "retroalimentacion_calidad_usada": False,
        "disponibilidad": "uso de 'plazas con al menos una asignación observada' como aproximación de oferta (información posterior; limitación)" if candidate_mode == "eligible_with_uptake" else "todas las plazas elegibles (sobrestima la oferta)",
    }
    report["limitaciones"] = [
        DISCLAIMER,
        "Conjuntos de opciones aproximados: se desconoce el orden de llegada a SIGA y cuándo se llenó cada plaza.",
        "Con pocos estudiantes por subgrupo las métricas por programa/municipio son inestables (ver n).",
        "Cupos históricos: " + str(ds.meta.get("capacity_status")) + ".",
        "Sin etiquetas validadas no se puede medir idoneidad (pista B).",
    ]
    return report


def coverage_metrics(ds, period, policy) -> dict:
    b = to_input_bundle(ds, [period])
    smap = {s.student_id: s for s in b.students}
    vmap = {v.vacancy_id: v for v in b.vacancies}
    allocs = [a for a in ds.allocations if a["period"] == period]
    allowed, by_reason = 0, defaultdict(int)
    for a in allocs:
        s, v = smap.get(a["student_id"]), vmap.get(a["placement_id"])
        if s is None or v is None:
            by_reason["SIN_REFERENCIA"] += 1
            continue
        flow = "SIGA" if a["mechanism"] == "SIGA" else a["mechanism"].replace("DIRECTA_", "", 1)
        bl = check_pair(s, v, policy, period, flow) if flow in ("SIGA",) or flow in policy["direct_type_vacancy_types"] else ["MECANISMO_DESCONOCIDO"]
        if bl:
            for x in bl:
                by_reason[x] += 1
        else:
            allowed += 1
    published = [v for v in vmap.values() if v.vacancy_type in policy["siga_vacancy_types"]]
    with_option = sum(1 for s in smap.values() if any(not check_pair(s, v, policy, period, "SIGA") for v in published))
    return {
        "asignaciones_observadas": len(allocs),
        "cobertura_candidatos": round(allowed / len(allocs), 4) if allocs else None,
        "asignaciones_que_el_motor_no_permitiria": dict(sorted(by_reason.items())),
        "nota": "Una asignación histórica no permitida es un conflicto institucional (p. ej. fuera de perfil), no un error del motor.",
        "estudiantes": len(smap),
        "cobertura_plazas_elegibles": round(with_option / len(smap), 4) if smap else None,
    }


def _capacities(ds, period):
    caps = {}
    for p in ds.placements:
        if p["period"] == period:
            caps[p["placement_id"]] = p.get("capacity")
    return caps


def direct_feasibility(ds, period, policy) -> dict:
    b = to_input_bundle(ds, [period])
    smap = {s.student_id: s for s in b.students}
    vmap = {v.vacancy_id: v for v in b.vacancies}
    caps = _capacities(ds, period)
    directs = [a for a in ds.allocations if a["period"] == period and a["mechanism"].startswith("DIRECTA_") and a["student_id"] in smap]
    if not directs:
        return {"estado": "SIN_DIRECTAS_OBSERVADAS"}
    if any(c is None for c in caps.values()):
        return {"estado": "NO_EVALUABLE", "motivos": ["CUPOS_NO_RECONSTRUIDOS: elija un capacity_mode autorizado"]}
    be, _ = build_backend(policy, "tfidf")
    be.prepare(backend_texts(policy, list(smap.values()), list(vmap.values())))
    edges, n_options = [], defaultdict(int)
    for a in directs:
        flow = a["mechanism"].replace("DIRECTA_", "", 1)
        s = smap[a["student_id"]]
        for v in vmap.values():
            if flow in policy["direct_type_vacancy_types"] and not check_pair(s, v, policy, period, flow):
                raw = component_scores_v03(s, v, policy, be)
                edges.append(Edge(s.student_id, v.vacancy_id, combine(raw, policy.weights, policy.components)[0]))
                n_options[s.student_id] += 1
    chosen = min_cost_assignment([a["student_id"] for a in directs], {k: int(v) for k, v in caps.items()}, edges)
    by = {e.student_id: e.vacancy_id for e in chosen}
    same = sum(1 for a in directs if by.get(a["student_id"]) == a["placement_id"])
    return {
        "directas_observadas": len(directs),
        "con_al_menos_una_opcion_factible": sum(1 for a in directs if n_options[a["student_id"]]),
        "ubicadas_por_optimizador": len(chosen),
        "factibilidad": round(len(chosen) / len(directs), 4),
        "coincidencia_con_ubicacion_historica": round(same / len(directs), 4),
        "nota": "Sin municipios/modalidades aprobados históricos (B3) la factibilidad se calcula solo con tipo de plaza, perfil y cupos; "
                "la coincidencia no mide calidad.",
    }


def retrospective_simulation(ds, period, policy) -> dict:
    caps = _capacities(ds, period)
    if any(c is None for c in caps.values()):
        return {"estado": "NO_EVALUABLE", "motivos": ["CUPOS_NO_RECONSTRUIDOS"]}
    b = to_input_bundle(ds, [period], require_capacity=True)
    res = run_match(b, period, policy, simulate_general_assignment=True, run_timestamp="evaluacion", pairs_detail="none")
    sim = {r["id_estudiante"]: r["id_plaza"] for r in res.tables.get("Simulacion_No_Vinculante", [])}
    siga_obs = {a["student_id"]: a["placement_id"] for a in ds.allocations if a["period"] == period and a["mechanism"] == "SIGA"}
    both = [s for s in siga_obs if s in sim]
    return {
        "tipo_resultado": "SIMULACION_NO_VINCULANTE",
        "estudiantes_simulados": len(sim),
        "estudiantes_siga_observados": len(siga_obs),
        "coincidencia_plaza_simulada_vs_observada": round(sum(1 for s in both if sim[s] == siga_obs[s]) / len(both), 4) if both else None,
        "violaciones_generadas_por_motor": res.summary["violaciones_generadas_por_motor"],
        "conflictos_historicos_institucionales": res.summary["conflictos_historicos_institucionales"],
        "nota": "La simulación ignora la autoselección y el orden de llegada; distinguir PREDICCIÓN (coincidencia), FACTIBILIDAD (violaciones=0) y CALIDAD (no medible sin etiquetas).",
    }


# ------------------------------------------------------------------------------------------------- reports

def _flat(prefix, d):
    out = []
    for k, v in d.items():
        if isinstance(v, dict):
            out += _flat(f"{prefix}{k}.", v)
        else:
            out.append({"clave": prefix + k, "valor": json.dumps(v, ensure_ascii=False) if isinstance(v, list) else v})
    return out


def evaluation_markdown(r: dict) -> str:
    L = ["# Evaluación histórica del motor PyR", "", f"> {r['descargo']}", ""]
    if r.get("estado") != "EVALUADO":
        return "\n".join(L + [f"**Estado:** {r.get('estado')} — {', '.join(r.get('motivos', []))}"]) + "\n"
    L += [f"- Periodo de prueba (intocado): **{r['periodo_prueba']}** · desarrollo: {', '.join(r['periodos_desarrollo']) or '—'}",
          f"- Conjunto de candidatos: `{r['modo_conjunto_candidatos']}` · mecanismos: {', '.join(r['mecanismos_evaluados'])}",
          f"- Situaciones de elección: {r['situaciones']['total']} (observada dentro del conjunto: {r['situaciones']['observada_en_conjunto']}; tamaño medio {r['situaciones']['tamano_medio_conjunto']})",
          f"- Cupos: {r['dataset'].get('capacity_status')}", "",
          "## 1. Predicción de comportamiento histórico (no idoneidad)", "",
          "| Ranqueador | Tipo | n | Recall@3 | Recall@5 | MRR | NDCG@5 | Recall@5 aleatorio |", "|---|---|---|---|---|---|---|---|"]
    for name, m in r["comparacion"].items():
        if "situaciones" in m:
            L.append(f"| {name} | {m.get('tipo', '')} | {m['situaciones']} | {m.get('recall@3')} | {m.get('recall@5')} | {m.get('mrr')} | {m.get('ndcg@5')} | {m.get('recall@5_aleatorio_esperado')} |")
        else:
            L.append(f"| {name} | {m.get('estado')} | — | — | — | — | — | {'; '.join(map(str, m.get('motivos', m.get('detalle', []) if isinstance(m.get('detalle'), list) else [m.get('detalle', '')])))} |")
    L += ["", "## 2. Factibilidad de asignación", "", "```json", json.dumps({k: r[k] for k in ("cobertura", "directas", "simulacion_retrospectiva")}, ensure_ascii=False, indent=1), "```",
          "", "## 3. Calidad real", "", "No medible: no existen etiquetas de idoneidad validadas (pista B, bloqueo B4).", "",
          "## 4. Subgrupos (hybrid-pyr-v0.3 TF-IDF)", "", "| Grupo | Valor | n | MRR | Recall@5 | Recall@5 aleatorio |", "|---|---|---|---|---|---|"]
    for title, key in (("programa", "subgrupos_programa"), ("municipio origen", "subgrupos_municipio_origen")):
        for g, m in (r.get(key) or {}).items():
            L.append(f"| {title} | {g} | {m['n']} | {m['mrr']} | {m['recall@5']} | {m['recall@5_aleatorio_esperado']} |")
    L += ["", "## 5. Controles de fuga", "", "```json", json.dumps(r["controles_fuga"], ensure_ascii=False, indent=1), "```", "", "## 6. Limitaciones", ""]
    L += [f"- {x}" for x in r["limitaciones"]]
    return "\n".join(L) + "\n"


def write_evaluation(report: dict, out_dir: str | Path, allow_inside_repo: bool = False) -> dict[str, Path]:
    from openpyxl import Workbook

    from .io_excel import _write_table

    out = assert_safe_output_dir(out_dir, allow_inside_repo)
    out.mkdir(parents=True, exist_ok=True)
    js = out / "evaluacion_historica.json"
    js.write_text(json.dumps(report, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    md = out / "evaluacion_historica.md"
    md.write_text(evaluation_markdown(report), encoding="utf-8")
    wb = Workbook()
    wb.remove(wb.active)
    resumen = [{"clave": k, "valor": v if not isinstance(v, (dict, list)) else json.dumps(v, ensure_ascii=False)} for k, v in report.items()
               if k not in ("comparacion", "subgrupos_programa", "subgrupos_municipio_origen")]
    _write_table(wb.create_sheet("Resumen"), resumen, ["clave", "valor"])
    comp = [{"ranqueador": k, **{kk: (vv if not isinstance(vv, (list, dict)) else json.dumps(vv, ensure_ascii=False)) for kk, vv in v.items()}}
            for k, v in report.get("comparacion", {}).items()]
    cols = ["ranqueador", "tipo", "estado", "situaciones", "recall@1", "recall@3", "recall@5", "mrr", "ndcg@3", "ndcg@5", "recall@5_aleatorio_esperado",
            "tamano_medio_conjunto", "model_id", "backend", "motivos", "detalle"]
    _write_table(wb.create_sheet("Comparacion_Modelos"), comp, cols)
    for key, sheet in (("subgrupos_programa", "Subgrupos_Programa"), ("subgrupos_municipio_origen", "Subgrupos_Municipio")):
        _write_table(wb.create_sheet(sheet), [{"grupo": g, **m} for g, m in (report.get(key) or {}).items()])
    for key, sheet in (("cobertura", "Cobertura"), ("directas", "Directas"), ("simulacion_retrospectiva", "Simulacion_Retrospectiva"), ("controles_fuga", "Controles_Fuga")):
        _write_table(wb.create_sheet(sheet), _flat("", report.get(key) or {}), ["clave", "valor"])
    _write_table(wb.create_sheet("Limitaciones"), [{"limitacion": x} for x in report.get("limitaciones", [])], ["limitacion"])
    xl = out / "evaluacion_historica.xlsx"
    wb.save(xl)
    return {"json": js, "md": md, "xlsx": xl}
