"""Synthetic GROUND-TRUTH simulation of the PyR engine and its expert-review retraining loop.

What it does (100 % synthetic; no institutional data):
1. Generates several periods of students and plazas whose *true* suitability is known: each person
   and project has latent themes; students describe them in colloquial words, projects in technical
   words (paraphrase), some student texts are missing.
2. Ranking quality of the explainable baseline vs the truth (NDCG@5 over each student's eligible
   plazas) for every semantic backend.
3. Runs the REAL loop: `make_review_workbook` (blind, optional exploration pairs) -> simulated
   reviewers (1-5 with noise, different approver) -> `import_feedback` -> `retrain` -> evaluates the
   candidate model against the truth on a fresh period. Repeated for several label budgets.

    python benchmarks/simulacion_reentrenamiento.py                      # full study (~1-3 min)
    python benchmarks/simulacion_reentrenamiento.py --quick              # smaller
    python benchmarks/simulacion_reentrenamiento.py --json-out sim.json

Read the results as a test of the MACHINERY (does retraining work, how many labels it needs, does
exploration help), not as evidence of quality on real PyR data: the simulator, its vocabulary and the
concept lexicon were written by the same team.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import sys
import tempfile
import time
from pathlib import Path

from openpyxl import load_workbook

from pyr_matching.feedback import import_feedback, make_review_workbook
from pyr_matching.fixtures import write_workbook
from pyr_matching.io_excel import load_mapping, read_bundle
from pyr_matching.pipeline import run_match
from pyr_matching.policy import POLICY_V03_PATH, Policy
from pyr_matching.retrain import retrain
from pyr_matching.scoring import score_pair
from pyr_matching.semantic import build_backend
from pyr_matching.scoring import backend_texts
from pyr_matching.constraints import check_pair
from pyr_matching.training import LogisticModel

# theme -> (colloquial student phrasings, technical project phrasings)
THEMES = {
    "software": (["me gusta programar y crear aplicaciones", "quiero hacer páginas web útiles", "me interesa la tecnología y los computadores"],
                 ["desarrollo de software y sistemas de información", "plataforma digital para la gestión de trámites", "app móvil para organizaciones comunitarias"]),
    "datos": (["quiero ordenar información y hacer gráficas", "me interesa analizar números para tomar decisiones"],
              ["análisis de datos y tableros de indicadores municipales", "estadística aplicada a la caracterización socioeconómica"]),
    "salud_mental": (["quiero escuchar y acompañar a las personas que están tristes", "me interesa el bienestar emocional"],
                     ["acompañamiento psicosocial y promoción de la salud mental", "atención psicológica comunitaria"]),
    "victimas": (["quiero trabajar con personas que sufrieron la guerra", "me importa que no se olvide lo que pasó en el conflicto"],
                 ["atención a víctimas del conflicto armado y memoria histórica", "reparación simbólica y reconstrucción de memoria"]),
    "convivencia": (["quiero que los vecinos se lleven bien", "me interesa que haya menos peleas en los colegios"],
                    ["mediación comunitaria y construcción de paz", "estrategias de convivencia escolar y resolución pacífica de conflictos"]),
    "finanzas": (["me gusta llevar las cuentas", "quiero ayudar a que las familias ahorren"],
                 ["asesoría contable y tributaria", "educación financiera para hogares"]),
    "emprendimiento": (["quiero ayudar a crear negocios", "me interesa que los jóvenes tengan su propia empresa"],
                       ["fortalecimiento de emprendimientos y planes de negocio", "incubación de iniciativas productivas"]),
    "agro_mercado": (["quiero que los campesinos vendan mejor lo que cosechan", "me interesa el campo y los cultivos"],
                     ["comercialización y asociatividad de productores rurales", "mercados campesinos y circuitos cortos"]),
    "agua": (["quiero cuidar los ríos", "me preocupa que la gente no tenga agua limpia"],
             ["monitoreo de calidad hídrica en microcuencas", "acueducto rural y potabilización"]),
    "residuos": (["quiero que haya menos basura", "me interesa el reciclaje"],
                 ["gestión integral de residuos sólidos", "separación en la fuente y aprovechamiento de residuos"]),
    "infancia_educacion": (["quiero enseñarle a los niños", "me gusta ayudar a que los pequeños aprendan a leer"],
                           ["fortalecimiento pedagógico en básica primaria", "lectoescritura para la primera infancia"]),
    "derechos": (["quiero que la gente conozca sus derechos", "me interesa ayudar con trámites legales"],
                 ["consultorio jurídico y pedagogía en derechos humanos", "asesoría jurídica a población vulnerable"]),
    "comunicacion": (["me gusta hacer videos y fotos", "quiero contar historias de la región"],
                     ["producción audiovisual comunitaria", "estrategia de comunicación y radio local"]),
    "gestion_publica": (["quiero que la alcaldía funcione mejor", "me interesa la transparencia del gobierno"],
                        ["fortalecimiento de la gestión pública municipal", "control social y rendición de cuentas"]),
}
PROGRAMS = {
    "Ingeniería de Sistemas": ["software", "datos", "comunicacion"],
    "Psicología": ["salud_mental", "victimas", "convivencia", "infancia_educacion"],
    "Contaduría Pública": ["finanzas", "emprendimiento", "agro_mercado", "gestion_publica"],
    "Ingeniería Ambiental": ["agua", "residuos", "agro_mercado"],
    "Derecho": ["derechos", "victimas", "gestion_publica", "convivencia"],
    "Comunicación Social": ["comunicacion", "victimas", "convivencia", "infancia_educacion"],
}
MUNIS = ["Ibagué", "Chaparral", "Líbano", "Ortega", "Planadas", "Natagaima", "Melgar"]
PERIODS = ["2025B", "2026A", "2026B", "2027A", "2027B"]


def gen_period(period: str, n_students: int, n_vacancies: int, rng: random.Random):
    progs = list(PROGRAMS)
    truth_s, truth_v, students, vacancies = {}, {}, [], []
    for i in range(n_students):
        p = rng.choice(progs)
        own = PROGRAMS[p]
        themes = rng.sample(own, 1) + ([rng.choice(list(THEMES))] if rng.random() < 0.5 else [])
        sid = f"S{period}-{i:04d}"
        truth_s[sid] = {"program": p, "themes": set(themes), "muni": rng.choice(MUNIS)}
        say = lambda t: rng.choice(THEMES[t][0])  # noqa: E731
        exp = (say(themes[0]) + ".").capitalize() if rng.random() > 0.15 else None
        learn = ("Aprender: " + say(themes[-1]) + ".") if rng.random() > 0.35 else None
        intr = (say(themes[-1]) + ".").capitalize() if rng.random() > 0.4 else None
        students.append([sid, period, p, truth_s[sid]["muni"] if rng.random() > 0.2 else None, "SI", exp, learn, None, intr, None, None])
    for j in range(n_vacancies):
        p = rng.choice(progs)
        themes = rng.sample(PROGRAMS[p], min(2, len(PROGRAMS[p])))[: rng.choice([1, 2])]
        vid = f"P{period}-{j:04d}"
        alt = rng.choice([x for x in progs if x != p]) if rng.random() < 0.3 else None
        truth_v[vid] = {"program": p, "alt": alt, "themes": set(themes), "muni": rng.choice(MUNIS)}
        tech = lambda t: rng.choice(THEMES[t][1])  # noqa: E731
        desc = (" y ".join(tech(t) for t in themes) + " en organizaciones del territorio.").capitalize()
        vacancies.append([vid, period, f"PRY-{vid}", f"Proyecto {vid}", desc, "Desarrollo territorial", f"ORG-{vid}", f"Organización {vid}", "Tolima",
                          truth_v[vid]["muni"], rng.choice(["Presencial", "Semipresencial"]), rng.randint(1, 3), "Aprobada", "Normal", p, alt,
                          (tech(themes[0]) + ".").capitalize() if rng.random() < 0.5 else None, None, None, None])
    return students, vacancies, truth_s, truth_v


# How the (simulated) institution judges suitability. "tematico": close to the provisional weights.
# "territorial": reviewers value working in the student's own municipality far more than the
# provisional policy does (location weight 10) -> the case where retraining SHOULD change the ranking.
TRUTHS = {"tematico": (0.65, 0.25, 0.10), "territorial": (0.35, 0.15, 0.50)}
TRUTH = TRUTHS["tematico"]


def true_suitability(ts: dict, tv: dict) -> float:
    """Latent suitability in [0, 1] from thematic fit, program profile and territory (weights: TRUTH)."""
    theme = len(ts["themes"] & tv["themes"]) / len(ts["themes"])
    prog = 1.0 if ts["program"] == tv["program"] else 0.6 if ts["program"] == tv["alt"] else 0.0
    a, b, c = TRUTH
    return a * theme + b * prog + c * (1.0 if ts["muni"] == tv["muni"] else 0.0)


def fill_reviews(path: Path, truth_s, truth_v, rng: random.Random, noise: float = 0.6):
    wb = load_workbook(path)
    ws = wb["Revision_Pares"]
    h = {c.value: i for i, c in enumerate(ws[1])}
    for row in ws.iter_rows(min_row=2):
        sid, vid = row[h["id_estudiante"]].value, row[h["id_plaza"]].value
        s = true_suitability(truth_s[sid], truth_v[vid])
        val = max(1, min(5, round(1 + 4 * s + rng.gauss(0, noise))))
        row[h["evaluacion_idoneidad"]].value = "NO_EVALUABLE" if rng.random() < 0.05 else ["1 - Muy baja", "2 - Baja", "3 - Media", "4 - Alta", "5 - Muy alta"][val - 1]
        row[h["id_revisor"]].value = rng.choice(["REV-01", "REV-02", "REV-03"])
        row[h["fecha_revision"]].value = "2027-01-15"
        row[h["estado_aprobacion"]].value = "APROBADA"
        row[h["aprobado_por"]].value = "COORD-PYR"
    wb.save(path)


def ndcg_at(ranked_truth: list[float], k: int = 5) -> float:
    dcg = sum(t / math.log2(i + 2) for i, t in enumerate(ranked_truth[:k]))
    ideal = sorted(ranked_truth, reverse=True)
    idcg = sum(t / math.log2(i + 2) for i, t in enumerate(ideal[:k]))
    return dcg / idcg if idcg else 0.0


def ranking_quality(bundle, period, policy, truth_s, truth_v, model=None) -> dict:
    """Mean NDCG@5 / precision@1 against the latent truth over each student's eligible SIGA plazas."""
    be, _ = build_backend(policy)
    st = [s for s in bundle.students if s.period == period]
    vs = [v for v in bundle.vacancies if v.period == period]
    be.prepare(backend_texts(policy, st, vs))
    nd, p1, n = 0.0, 0, 0
    for s in st:
        scored = []
        for v in vs:
            if check_pair(s, v, policy, period, "SIGA", None, v.capacity):
                continue
            ps = score_pair(s, v, policy, be, [], model)
            scored.append((-(ps.total or 0), v.vacancy_id, true_suitability(truth_s[s.student_id], truth_v[v.vacancy_id])))
        if len(scored) < 2:
            continue
        scored.sort()
        tr = [t for _, _, t in scored]
        nd += ndcg_at(tr)
        p1 += tr[0] >= max(tr) - 1e-9
        n += 1
    return {"estudiantes": n, "ndcg@5": round(nd / n, 4) if n else None, "acierto_top1": round(p1 / n, 4) if n else None}


def policy_with(base: Policy, backend: str) -> Policy:
    raw = json.loads(json.dumps(base.raw))
    raw["semantic"]["backend"] = backend
    if backend == "tfidf":
        raw["semantic"]["fallback_backend"] = "tfidf"
    return Policy(raw, source=f"{base.source}+{backend}")


def build_world(n_students: int, n_vacancies: int, seed: int, tmp: Path):
    rng = random.Random(seed)
    rows = {"Estudiantes": [], "Plazas": [], "Decisiones_Directas": [], "Matriculas_SIGA": []}
    truth_s, truth_v = {}, {}
    for per in PERIODS:
        st, vc, ts, tv = gen_period(per, n_students, n_vacancies, rng)
        rows["Estudiantes"] += st
        rows["Plazas"] += vc
        truth_s.update(ts)
        truth_v.update(tv)
    path = write_workbook(tmp / f"mundo_{n_students}_{seed}.xlsx", rows)
    return path, truth_s, truth_v


def retrain_study(policy: Policy, n_students: int, n_vacancies: int, explore: int, seed: int, tmp: Path, per_student: int = 3) -> dict:
    path, truth_s, truth_v = build_world(n_students, n_vacancies, seed, tmp)
    bundle = read_bundle([path], policy, load_mapping())
    # openpyxl stamps the save time into the file, so its SHA-256 (part of the review run_id, which seeds
    # the exploration sample) would change on every run. Pin it so the simulation is reproducible.
    bundle.source_files = {"mundo_sintetico.xlsx": f"sim-{n_students}-{n_vacancies}-{seed}"}
    tag = f"{'-'.join(str(x) for x in TRUTH)}_{n_students}_{explore}_{seed}"  # one store/registry per world and setting
    store, registry = tmp / f"retro_{tag}", tmp / f"registro_{tag}"
    rng = random.Random(seed + 1)
    label_periods, eval_period = PERIODS[:-1], PERIODS[-1]
    for per in label_periods:
        res = run_match(bundle, per, policy, pairs_detail="all", run_timestamp=f"sim-{per}")
        f = make_review_workbook(res, bundle, per, tmp / f"rev_{per}_{n_students}_{explore}_{seed}.xlsx", policy, per_student=per_student, blind=True,
                                 allow_inside_repo=True, explore=explore)
        fill_reviews(f, truth_s, truth_v, rng)
        import_feedback([f], store, allow_inside_repo=True)
    rep = retrain(bundle, policy, store, registry)
    out = {"estudiantes_por_periodo": n_students, "exploracion_por_estudiante": explore, "semilla": seed,
           "estado": rep["estado"], "parejas_etiquetadas": rep.get("paso_2_suficiencia", {}).get("parejas_utilizables",
                                                                                                  rep.get("paso_2_suficiencia", {}).get("reporte", {}).get("parejas_utilizables"))}
    base_q = ranking_quality(bundle, eval_period, policy, truth_s, truth_v)
    out["linea_base_periodo_nuevo"] = base_q
    if rep["estado"] == "NO_ENTRENABLE":
        out["motivos"] = rep["paso_2_suficiencia"]["motivos"]
        return out
    m = rep["paso_4_metricas"]
    out["auc_prueba_modelo"] = m["modelo_test"]["auc"]
    out["auc_prueba_linea_base"] = m["linea_base_test"]["auc"]
    out["compuertas_fallidas"] = rep["paso_5_compuertas_fallidas"]
    model = LogisticModel.load(Path(registry) / rep["model_id"] / "model.json", policy)
    out["modelo_periodo_nuevo"] = ranking_quality(bundle, eval_period, policy, truth_s, truth_v, model)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--seeds", type=int, default=2)
    ap.add_argument("--json-out")
    ap.add_argument("--verdad", choices=["tematico", "territorial", "ambas"], default="ambas",
                    help="Criterio institucional simulado: parecido a la política provisional, o muy distinto (territorio).")
    a = ap.parse_args(argv)
    global TRUTH
    base = Policy.load(POLICY_V03_PATH)
    t0 = time.perf_counter()
    report = {"descargo": "Simulación sintética con verdad conocida: prueba la maquinaria, no la calidad sobre datos reales de PyR.", "backends": {}, "reentrenamiento": []}
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        TRUTH = TRUTHS["tematico"]
        n_st, n_vc = (60, 30) if a.quick else (150, 60)
        path, ts, tv = build_world(n_st, n_vc, 11, tmp)
        for be in ("tfidf", "tfidf-conceptos"):
            pol = policy_with(base, be)
            bundle = read_bundle([path], pol, load_mapping())
            report["backends"][be] = ranking_quality(bundle, PERIODS[-1], pol, ts, tv)
            print(be, report["backends"][be], file=sys.stderr)
        budgets = [20, 60] if a.quick else [20, 50, 100, 150]
        for verdad in (["tematico", "territorial"] if a.verdad == "ambas" else [a.verdad]):
            TRUTH = TRUTHS[verdad]
            for n in budgets:
                for explore in (0, 2):
                    for seed in range(a.seeds):
                        r = {"verdad": verdad, **retrain_study(base, n, max(20, n // 2), explore, 100 + seed, tmp)}
                        report["reentrenamiento"].append(r)
                        print(json.dumps(r, ensure_ascii=False), file=sys.stderr)
            TRUTH = TRUTHS["tematico"]
    report["segundos"] = round(time.perf_counter() - t0, 1)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if a.json_out:
        Path(a.json_out).write_text(text, encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
