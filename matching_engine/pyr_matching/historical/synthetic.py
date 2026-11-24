"""100% SYNTHETIC historical workbooks that mimic the institutional FORMATS (headers observed on
12-nov-2026) – never their content. Used by privacy/integration tests and evaluation-tooling demos.

Sensitive columns are present with obviously fake sentinel values (FALSO-*) so tests can prove they are
never read or exported. The generative process encodes a known behaviour (SIGA students tend to pick
placements whose topic matches their stated expectations, under capacity and arrival order), so the
evaluation tooling can be checked end to end. Metrics on this data say NOTHING about real PyR quality.
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from pathlib import Path

from openpyxl import Workbook

from ..fixtures import MUNIS, TOPICS
from ..io_excel import safe_append

PERIODS = ("2025A", "2025B", "2026A", "2026B")
Q_EXP = "¿Que expectativas tiene frente a su semestre Paz y Región?"
Q_LEARN = " ¿Qué aprendizajes espera lograr con su experiencia en el Semestre Paz y Región?"
PRE_HEADERS = ["Marca temporal", "Dirección de correo electrónico", "Código estudiantil", "Número de Cédula", "Primer apellido", "Segundo apellido",
               "Nombre", "Fecha de Nacimiento", "Dirección", "Sexo", "Nombre de la EPS a la que se encuentra afiliado", Q_EXP, Q_LEARN]
EST_HEADERS = ["", "Categoría", "Programa", "Nombre", "Código", "CC", "Correo", "Tipo asignación", "Municipio origen", "Municipio origen",
               "RESPUESTA CE", "TIPO DE CASO", "JUSTIFICACIÓN CE", "OBSERVACIÓN"]
PROY_HEADERS = ["Gestionó", "Estado", "Tipo de plaza", "Perfil", "Perfil (aternativo)", "Nombre de la Organización", "Tipo de organización",
                "Departamento ", "Municipio", "Contacto de la Organización", "Celular", "Correo eletrónico", "Nombre del Proyecto",
                "Descripción del proyecto", "Línea de proyecto", "Modalidad del Proyecto", "Observación", "Nombre", "Código", "Cédula",
                "Tipo asignación", "Nombre", "Código", "Cédula", "Caso Especial", "Tipo de caso", "Aprobados"]
EV_HEADERS = ["Periodo", "Nombre de la Organización    ", "Departamento ", "Municipio", "Programa Académico  ", "Nombre", "Código", "Cédula",
              "Asesor  ", "Potencial formativo de los proyectos", "Nivel de involucramiento que le permiten al estudiante", "Observaciones",
              "Puntaje Total", "Pertinencia del proyecto frente al propósito formativo de Paz y Región", "Observaciones", "Puntaje Total"]
CONV_HEADERS = ["Marca temporal", "1. Perfil Programa Académico", "1.1 Perfil Programa Académico Alternativo", "2. Nombre de la Organización",
                "3. Ubicación y Dirección de la organización", "4. Número de Estudiantes Requeridos",
                "5.  Descripción general de las actividades a realizar por el estudiante, en el marco del Semestre de Paz y Región.",
                "6. Modalidad", "7. Requisitos (académicos, habilidades, conocimientos Etc.)", "8. Compromisos de la organización",
                "10. Asesor(a) Regional"]
SENTINELS = ("FALSO-NOMBRE", "FALSO-CC", "FALSO-EPS", "FALSO-JUSTIFICACION", "falso@correo", "FALSO-ASESOR", "FALSO-CELULAR", "FALSO-DIRECCION")


def _wb(sheets: dict[str, tuple[list, list[list]]], path: Path) -> Path:
    wb = Workbook()
    wb.remove(wb.active)
    for name, (headers, rows) in sheets.items():
        ws = wb.create_sheet(name)
        safe_append(ws, headers)
        for r in rows:
            safe_append(ws, r)
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
    return path


def make_historical_sample(out_dir: str | Path, seed: int = 11, n_students: int = 120, n_placements: int = 45,
                           periods=PERIODS) -> Path:
    """Write synthetic institutional-format workbooks + a manifest. Returns the manifest path."""
    out = Path(out_dir)
    rng = random.Random(seed)
    progs = list(TOPICS)
    sources = []
    code_seq = 2200000000
    repeat_pool: list[tuple] = []
    for pi, period in enumerate(periods):
        # ---------------- placements -----------------------------------------------------------
        placements = []
        for j in range(n_placements):
            prog = rng.choice(progs)
            topic = rng.choice(TOPICS[prog])
            tipo = rng.choices(["Normal", "Municipio de origen", "Caso especial", "Convocatoria"], [0.72, 0.12, 0.08, 0.08])[0]
            alt = rng.choice(progs) if rng.random() < 0.2 else None
            if j == 0:
                alt = None
            placements.append({"org": f"Organización sintética {pi}-{j}", "prog": prog, "alt": alt, "topic": topic, "tipo": tipo,
                               "muni": rng.choice(MUNIS), "cap": rng.randint(1, 3), "modal": rng.choice(["Presencial – Asiste a la organización toda la semana", "Semipresencial – Asiste en algunas jornadas"]),
                               "line": rng.choice(["Desarrollo comunitario", "Gestión pública", "Paz y convivencia"]), "seats": []})
        placements[1]["prog"] = None  # a placement without mandatory profile (fail-safe path)
        # ---------------- students -------------------------------------------------------------
        students = []
        for i in range(n_students):
            if repeat_pool and i < 2 and pi >= 1:  # a couple of students appear in two periods (leakage reporting)
                code, prog, topic, muni = repeat_pool.pop()
            else:
                code_seq += 1
                code, prog = str(code_seq), rng.choice(progs)
                topic, muni = rng.choice(TOPICS[prog]), rng.choice(MUNIS)
            students.append({"code": code, "prog": prog, "topic": topic, "muni": muni,
                             "mech": "DIRECTA" if rng.random() < 0.18 else "SIGA", "pre": rng.random() > 0.08})
        repeat_pool = [(s["code"], s["prog"], s["topic"], s["muni"]) for s in students[-2:]]
        # ---------------- allocation process (known behaviour) ---------------------------------
        order = students[:]
        rng.shuffle(order)
        for s in order:
            want_direct = s["mech"] == "DIRECTA"
            opts = [p for p in placements if len(p["seats"]) < p["cap"]
                    and (p["tipo"] != "Normal") == want_direct
                    and s["prog"] in (p["prog"], p["alt"])]
            if not opts:
                continue
            weights = [2.718 ** (2.2 * (p["topic"] == s["topic"]) + 0.6 * (p["muni"] == s["muni"]) + rng.gauss(0, 0.6)) for p in opts]
            choice = rng.choices(opts, weights)[0]
            choice["seats"].append(s)
        # one historical out-of-profile placement (institutional conflict, must be reported, not "fixed")
        for p in placements:
            if p["tipo"] == "Normal" and len(p["seats"]) < p["cap"] and p["prog"]:
                stray = next((s for s in students if s["prog"] != p["prog"] and s["prog"] != p["alt"] and not any(s in q["seats"] for q in placements)), None)
                if stray:
                    p["seats"].append(stray)
                    break
        # ---------------- workbooks --------------------------------------------------------------
        t0 = datetime(int(period[:4]), 1 if period.endswith("A") else 6, 10)
        pre_rows = []
        for i, s in enumerate(students):
            if not s["pre"]:
                continue
            exp = f"Espero aportar en {s['topic']} con las comunidades del territorio."
            learn = f"Aprender sobre {s['topic']} y {rng.choice(TOPICS[s['prog']])} en contextos reales."
            row = [t0 + timedelta(hours=i), "falso@correo.test", int(s["code"]), f"FALSO-CC-{i}", "FALSO-NOMBRE", "FALSO-NOMBRE", "FALSO-NOMBRE",
                   "2000-01-01", "FALSO-DIRECCION", "F", "FALSO-EPS", exp, learn]
            pre_rows.append(row)
            if i % 37 == 0:  # duplicated form submission: the later one must win
                later = list(row)
                later[0] = row[0] + timedelta(days=1)
                later[11] = exp + " (respuesta actualizada)"
                pre_rows.append(later)
        est_rows = [[None, "Pregrado", s["prog"], "FALSO-NOMBRE", s["code"], "FALSO-CC", "falso@correo.test", s["mech"], s["muni"], s["muni"],
                     "FALSO-RESPUESTA", "FALSO-TIPO", "FALSO-JUSTIFICACION", "FALSO-OBSERVACION"] for s in students]
        proy_rows = []
        for j, p in enumerate(placements):
            desc = f"Proyecto de {p['topic']} con organizaciones y comunidades del municipio."
            for k in range(p["cap"]):
                s = p["seats"][k] if k < len(p["seats"]) else None
                proy_rows.append(["FALSO-ASESOR", "Aprobada", p["tipo"], p["prog"], p["alt"], p["org"], "ONG", "Tolima", p["muni"], "FALSO-NOMBRE",
                                  "FALSO-CELULAR", "falso@correo.test", f"Proyecto {p['topic']} {pi}-{j}", desc, p["line"], p["modal"], "FALSO-OBSERVACION",
                                  "FALSO-NOMBRE" if s else None, int(s["code"]) if s else None, "FALSO-CC" if s else None,
                                  s["mech"] if s else None, None, None, None, None, None, p["cap"]])
        tab_sheet = "Proyectos" if period >= "2026A" else "Proy Def"
        tab = _wb({"Estudiantes": (EST_HEADERS, est_rows), tab_sheet: (PROY_HEADERS, proy_rows)}, out / f"Tablero_Maestro_{period}.xlsx")
        pre = _wb({"Respuestas de formulario 1": (PRE_HEADERS, pre_rows)}, out / f"Preinscripcion_{period}.xlsx")
        sources += [{"kind": "tablero_estudiantes", "period": period, "path": tab.name},
                    {"kind": "tablero_plazas", "period": period, "path": tab.name},
                    {"kind": "preinscripcion", "period": period, "path": pre.name}]
        if period >= "2026A":
            ev_rows = []
            for p in placements:
                for s in p["seats"][:1]:
                    adv = rng.randint(6, 10)
                    ev_rows.append([period, p["org"] + "  ", "Tolima", p["muni"], s["prog"], "FALSO-NOMBRE", int(s["code"]), "FALSO-CC", "FALSO-ASESOR",
                                    adv, rng.randint(6, 10), "FALSO-OBSERVACION", adv * 10, rng.randint(6, 10), "FALSO-OBSERVACION", rng.randint(60, 100)])
            ev = _wb({"Ev. Plazas": (EV_HEADERS, ev_rows)}, out / f"Base_datos_proyectos_{period}.xlsx")
            sources.append({"kind": "evaluacion_plazas", "period": period, "path": ev.name})
        if period == "2026B":
            conv_rows = [[t0, p["prog"], p["alt"], p["org"], "FALSO-DIRECCION", p["cap"], f"Actividades de {p['topic']} con la comunidad.", p["modal"],
                          f"Conocimientos en {p['topic']} y trabajo en equipo.", "Acompañamiento y logística.", "FALSO-ASESOR"]
                         for p in placements if p["tipo"] == "Convocatoria"]
            conv = _wb({"Respuestas de formulario 1": (CONV_HEADERS, conv_rows)}, out / "Convocatoria_organizaciones_2026B.xlsx")
            sources.append({"kind": "convocatoria_organizaciones", "period": period, "path": conv.name})
    manifest = {"description": "Manifiesto SINTÉTICO (formatos institucionales, contenido falso).", "capacity_mode": "approved_column", "sources": sources}
    mpath = out / "manifest.json"
    mpath.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return mpath
