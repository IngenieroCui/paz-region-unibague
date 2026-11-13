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
    ("Quiero acompañar a mujeres emprendedoras del campo.", "Fortalecimiento de iniciativas productivas lideradas por mujeres rurales."),
    ("Me interesa la prevención de la violencia en los colegios.", "Estrategias de convivencia escolar y resolución pacífica de conflictos."),
    ("Deseo organizar los archivos y documentos de la alcaldía.", "Gestión documental y organización del archivo histórico municipal."),
    ("Quiero enseñar a usar computadores a personas mayores.", "Alfabetización digital para adultos y adultos mayores."),
    ("Me gustaría trabajar en la protección de animales silvestres.", "Conservación de fauna y monitoreo de biodiversidad en áreas protegidas."),
    ("Quiero apoyar a familias a ahorrar y manejar su dinero.", "Educación financiera para hogares de bajos ingresos."),
    ("Me interesa el turismo y mostrar la cultura de la región.", "Diseño de rutas de turismo comunitario y patrimonio cultural."),
    ("Deseo ayudar a que la gente conozca sus derechos.", "Consultorio jurídico y pedagogía en derechos humanos."),
    ("Quiero mejorar la nutrición de los niños.", "Seguridad alimentaria y huertas escolares para la primera infancia."),
    ("Me apasiona el deporte y entrenar a jóvenes.", "Escuelas deportivas y aprovechamiento del tiempo libre juvenil."),
    ("Quiero apoyar a jóvenes que consumen drogas.", "Prevención del consumo de sustancias psicoactivas en adolescentes."),
    ("Me gustaría hacer mapas del territorio con drones.", "Cartografía social y levantamiento topográfico con sensores remotos."),
    ("Quiero apoyar procesos de reconciliación entre vecinos.", "Mediación comunitaria y construcción de paz territorial."),
    ("Deseo diseñar la imagen y publicidad de pequeñas empresas.", "Branding y comunicación visual para mipymes locales."),
    ("Quiero apoyar el abastecimiento de agua potable en veredas.", "Sistemas de acueducto rural y tratamiento de agua para consumo."),
    ("Me interesa la energía solar.", "Instalación y mantenimiento de paneles fotovoltaicos en zonas no interconectadas."),
    ("Quiero ayudar a niños con dificultades de aprendizaje.", "Apoyo psicopedagógico e inclusión educativa en escuelas públicas."),
    ("Me gustaría asesorar a la cooperativa en costos de producción.", "Análisis de costos y rentabilidad de la asociación cafetera."),
]


def evaluate(backend) -> dict:
    queries = [q for q, _ in PAIRS]
    docs = [d for _, d in PAIRS]
    backend.prepare(queries + docs)
    hits, rr, r3 = 0, 0.0, 0
    for i, q in enumerate(queries):
        ranked = sorted(range(len(docs)), key=lambda j: (-(backend.similarity(q, docs[j]) or 0.0), j))
        pos = ranked.index(i) + 1
        hits += pos == 1
        r3 += pos <= 3
        rr += 1 / pos
    return {"backend": backend.version, "n": len(PAIRS), "top1_accuracy": round(hits / len(PAIRS), 3), "mrr": round(rr / len(PAIRS), 3),
            "recall@3": round(r3 / len(PAIRS), 3)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--embeddings", action="store_true")
    ap.add_argument("--model", default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    a = ap.parse_args()
    out = [evaluate(TfidfBackend())]
    if a.embeddings:
        import time

        t = time.perf_counter()
        r = evaluate(SentenceTransformerBackend(a.model))
        r["segundos_incl_carga_modelo"] = round(time.perf_counter() - t, 2)
        out.append(r)
    print(json.dumps(out, indent=2, ensure_ascii=False))
