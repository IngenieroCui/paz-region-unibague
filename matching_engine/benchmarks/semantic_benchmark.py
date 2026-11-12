"""Small SYNTHETIC Spanish paraphrase-retrieval benchmark: lexical TF-IDF vs local sentence embeddings.

Each student-style statement has exactly one intended project description written with DIFFERENT
vocabulary (paraphrase), plus distractors. Metric: top-1 accuracy and mean reciprocal rank.
Hand-written by the engineering team; NOT institutional data and NOT a validation of PyR quality.

    python benchmarks/semantic_benchmark.py                 # tfidf only
    python benchmarks/semantic_benchmark.py --embeddings    # + paraphrase-multilingual-MiniLM-L12-v2 (local)
"""
from __future__ import annotations

import argparse
import json

from pyr_matching.semantic import SentenceTransformerBackend, TfidfBackend

PAIRS = [
    ("Quiero ayudar a que los niños de veredas aprendan a leer mejor.", "Fortalecimiento de la lectoescritura en escuelas rurales para la primera infancia."),
    ("Me interesa programar aplicaciones para celulares.", "Desarrollo de una app móvil para la comercialización de productos campesinos."),
    ("Deseo trabajar con personas que sufrieron el conflicto armado.", "Acompañamiento a víctimas y reconstrucción de memoria histórica."),
    ("Quiero aportar en el cuidado de ríos y quebradas.", "Monitoreo de calidad hídrica en microcuencas del municipio."),
    ("Me gustaría llevar las cuentas de pequeños negocios.", "Asesoría contable y tributaria a emprendimientos locales."),
    ("Busco apoyar a adultos mayores en su bienestar emocional.", "Programa de salud mental y envejecimiento activo para la tercera edad."),
    ("Quiero diseñar puentes y vías para las comunidades.", "Diagnóstico de infraestructura vial terciaria y obras de drenaje."),
    ("Me interesa enseñar inglés.", "Clubes de lengua extranjera para estudiantes de secundaria."),
    ("Deseo apoyar a los agricultores a vender mejor sus cosechas.", "Estrategia de mercadeo y asociatividad para productores rurales."),
    ("Quiero mejorar la atención en el hospital del pueblo.", "Gestión de calidad de los servicios de la ESE municipal."),
    ("Me apasiona la música y quiero formar bandas con jóvenes.", "Escuela de formación artística y bandas sinfónicas juveniles."),
    ("Quiero ayudar a reducir la basura del municipio.", "Plan de gestión integral de residuos sólidos y reciclaje."),
]


def evaluate(backend) -> dict:
    queries = [q for q, _ in PAIRS]
    docs = [d for _, d in PAIRS]
    backend.prepare(queries + docs)
    hits, rr = 0, 0.0
    for i, q in enumerate(queries):
        ranked = sorted(range(len(docs)), key=lambda j: (-(backend.similarity(q, docs[j]) or 0.0), j))
        pos = ranked.index(i) + 1
        hits += pos == 1
        rr += 1 / pos
    return {"backend": backend.version, "n": len(PAIRS), "top1_accuracy": round(hits / len(PAIRS), 3), "mrr": round(rr / len(PAIRS), 3)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--embeddings", action="store_true")
    ap.add_argument("--model", default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    a = ap.parse_args()
    out = [evaluate(TfidfBackend())]
    if a.embeddings:
        out.append(evaluate(SentenceTransformerBackend(a.model)))
    print(json.dumps(out, indent=2, ensure_ascii=False))
