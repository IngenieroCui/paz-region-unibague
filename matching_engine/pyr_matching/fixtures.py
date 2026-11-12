"""100% synthetic Excel fixtures. No institutional records, names or identifiers.

`hand_scenario()` is small enough to verify by hand (expected results in docs/DEMO.md and
tests/test_scenario.py). `random_scenario()` scales for benchmarks and reproducibility tests.
"""
from __future__ import annotations

import random
from pathlib import Path

from openpyxl import Workbook

PERIOD = "2027A"

ST_COLS = ["ID_Estudiante", "Periodo", "Programa", "Municipio_Origen", "Habilitado", "Expectativas", "Aprendizajes_Esperados",
           "Habilidades", "Intereses", "Trabajo_Deseado", "Modalidad_Preferida"]
VC_COLS = ["ID_Plaza", "Periodo", "ID_Proyecto", "Nombre_Proyecto", "Descripcion_Proyecto", "Linea_Proyecto", "ID_Organizacion",
           "Nombre_Organizacion", "Departamento", "Municipio", "Modalidad", "Cupos", "Estado", "Tipo_Plaza", "Perfil_Programa",
           "Perfil_Programa_Alterno", "Actividades", "Requisitos", "Necesidades_Organizacion", "Codigo_Convocatoria"]
DC_COLS = ["ID_Estudiante", "Periodo", "Tipo_Directa", "Estado_Aprobacion", "ID_Plaza_Confirmada", "Ubicacion_Confirmada",
           "Municipio_Aprobado", "Modalidades_Aprobadas", "Codigo_Convocatoria"]
EN_COLS = ["ID_Estudiante", "ID_Plaza", "Periodo", "Estado"]
LB_COLS = ["ID_Estudiante", "ID_Plaza", "Periodo", "Etiqueta", "Fuente_Etiqueta"]

SIS, PSI, CON, MUS = "Ingeniería de Sistemas", "Psicología", "Contaduría Pública", "Música"


def _st(i, prog, muni=None, exp=None, learn=None, skills=None, eligible="SI", period=PERIOD):
    return [i, period, prog, muni, eligible, exp, learn, skills, None, None, None]


def _vc(i, muni, cap, tipo, perfil, desc, alt=None, estado="Aprobada", modal="Presencial", req=None, period=PERIOD, line="Desarrollo comunitario"):
    return [i, period, f"PRY-{i}", f"Proyecto {i}", desc, line, f"ORG-{i}", f"Organización sintética {i}", "Tolima", muni, modal, cap,
            estado, tipo, perfil, alt, None, req, None, None]


def hand_rows() -> dict[str, list[list]]:
    students = [
        _st("E01", SIS, "Ibagué", "Quiero aplicar desarrollo de software y sistemas de información para la gestión comunitaria.", "Aprender a construir sistemas de información útiles para organizaciones."),
        _st("E02", PSI, "Chaparral", "Acompañar procesos psicosociales con jóvenes y familias del territorio.", "Fortalecer habilidades de intervención psicosocial comunitaria."),
        _st("E03", CON, "Ibagué", "Apoyar la contabilidad y finanzas de asociaciones campesinas.", "Aprender gestión financiera de organizaciones rurales."),
        _st("E04", SIS, "Líbano", "Desarrollar herramientas digitales y software para el municipio de Líbano.", "Gestión de datos municipales."),
        _st("E05", PSI, "Ibagué", "Acompañamiento psicosocial y salud mental comunitaria.", None),
        _st("E06", CON, "Ortega", "Finanzas solidarias.", None),
        _st("E07", SIS, "Mariquita", "Software para turismo comunitario.", None),
        _st("E08", PSI, "Ibagué", "Trabajo con víctimas y reconstrucción de memoria.", None),
        _st("E09", SIS, "Ibagué", "Sistemas de información geográfica y datos abiertos para gestión comunitaria.", None),
        _st("E10", SIS, "Planadas", "Software educativo.", None),
        _st("E11", MUS, "Ibagué", "Formación musical para niños.", None),
        _st("E12", SIS, None, None, None),
        _st("E13", CON, "Ibagué", "Contabilidad pública.", None),
        _st("E14", SIS, "Líbano", "Apoyo administrativo general.", None),
        _st("E15", PSI, "Ibagué", "Promoción de salud mental.", None),
    ]
    vacancies = [
        _vc("V01", "Ibagué", 1, "Normal", SIS, "Desarrollo de software y sistemas de información para la gestión comunitaria de juntas de acción comunal."),
        _vc("V02", "Chaparral", 2, "Normal", PSI, "Acompañamiento psicosocial a jóvenes y familias en el territorio."),
        _vc("V03", "Ibagué", 1, "Normal", CON, "Contabilidad y finanzas de una asociación campesina.", alt=SIS),
        _vc("V04", "Líbano", 1, "Municipio de origen", SIS, "Herramientas digitales y software para la gestión de datos del municipio.", alt=PSI),
        _vc("V05", "Ibagué", 1, "Caso especial", PSI, "Acompañamiento psicosocial y promoción de salud mental comunitaria.", modal="Semipresencial - Asiste en algunas jornadas a la organización"),
        _vc("V06", "Ortega", 1, "Convocatoria", CON, "Finanzas solidarias para cooperativas."),
        _vc("V07", "Ibagué", 1, "Normal", PSI, "Plaza cerrada por la organización.", estado="Cerrada"),
        _vc("V08", "Planadas", 1, "Normal", SIS, "Software educativo para escuelas rurales."),
    ]
    decisions = [
        ["E04", PERIOD, "Municipio de origen", "Aprobado", None, "NO", "Líbano", None, None],
        ["E05", PERIOD, "Caso especial", "Aprobado", None, "NO", "Ibagué", "Semipresencial", None],
        ["E06", PERIOD, "Convocatoria", "Aprobado", "V06", "SI", None, None, "CONV-01"],
        ["E07", PERIOD, "Caso especial", "Aprobado", None, "NO", "Mariquita", None, None],
        ["E08", PERIOD, "Caso especial", "Pendiente", None, "NO", None, None, None],
        ["E09", PERIOD, "Municipio de origen", "Rechazado", None, "NO", "Ibagué", None, None],
        ["E13", PERIOD, "Convocatoria", "Aprobado", None, "NO", None, None, "CONV-02"],
        ["E14", PERIOD, "Municipio de origen", "Aprobado", None, "NO", "Líbano", None, None],
        ["E15", PERIOD, "Caso especial", None, None, "NO", None, None, None],
    ]
    enrollments = [["E10", "V08", PERIOD, "Matriculado"]]
    return {"Estudiantes": students, "Plazas": vacancies, "Decisiones_Directas": decisions, "Matriculas_SIGA": enrollments}


def write_workbook(path: str | Path, rows: dict[str, list[list]], labels: list[list] | None = None) -> Path:
    path = Path(path)
    wb = Workbook()
    wb.remove(wb.active)
    for name, cols in (("Estudiantes", ST_COLS), ("Plazas", VC_COLS), ("Decisiones_Directas", DC_COLS), ("Matriculas_SIGA", EN_COLS)):
        ws = wb.create_sheet(name)
        ws.append(cols)
        for r in rows.get(name, []):
            ws.append(r)
    if labels is not None:
        ws = wb.create_sheet("Etiquetas")
        ws.append(LB_COLS)
        for r in labels:
            ws.append(r)
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
    return path


def hand_scenario(path: str | Path) -> Path:
    return write_workbook(path, hand_rows())


TOPICS = {
    SIS: ["software", "sistemas de información", "datos abiertos", "aplicaciones móviles", "redes comunitarias"],
    PSI: ["acompañamiento psicosocial", "salud mental", "familias", "memoria histórica", "jóvenes"],
    CON: ["contabilidad", "finanzas solidarias", "costos agrícolas", "tributaria", "cooperativas"],
    "Administración de Empresas": ["emprendimiento", "plan de negocios", "mercadeo rural", "asociatividad", "gestión"],
    "Ingeniería Ambiental": ["agua", "residuos sólidos", "suelo", "reforestación", "cambio climático"],
}
MUNIS = ["Ibagué", "Chaparral", "Líbano", "Ortega", "Planadas", "Rioblanco", "Natagaima", "Melgar"]


def random_rows(n_students=200, n_vacancies=80, seed=7, period=PERIOD, with_text=True) -> dict[str, list[list]]:
    rng = random.Random(seed)
    progs = list(TOPICS)
    students, vacancies = [], []
    for i in range(n_students):
        p = rng.choice(progs)
        t = rng.sample(TOPICS[p], 2) + [rng.choice(TOPICS[rng.choice(progs)])]
        exp = f"Me interesa trabajar en {t[0]} y {t[2]} con comunidades." if with_text and rng.random() > 0.15 else None
        learn = f"Aprender sobre {t[1]} en contextos rurales." if with_text and rng.random() > 0.3 else None
        students.append(_st(f"S{i:04d}", p, rng.choice(MUNIS) if rng.random() > 0.2 else None, exp, learn, period=period))
    for j in range(n_vacancies):
        p = rng.choice(progs)
        t = rng.sample(TOPICS[p], 2)
        alt = rng.choice(progs) if rng.random() < 0.25 else None
        tipo = rng.choices(["Normal", "Municipio de origen", "Caso especial", "Convocatoria"], [0.75, 0.1, 0.1, 0.05])[0]
        vacancies.append(_vc(f"P{j:04d}", rng.choice(MUNIS), rng.randint(1, 4), tipo, p, f"Proyecto de {t[0]} y {t[1]} para organizaciones del territorio.",
                             alt=alt, period=period, modal=rng.choice(["Presencial", "Semipresencial"])))
    return {"Estudiantes": students, "Plazas": vacancies, "Decisiones_Directas": [], "Matriculas_SIGA": []}


def random_scenario(path: str | Path, **kw) -> Path:
    return write_workbook(path, random_rows(**kw))
