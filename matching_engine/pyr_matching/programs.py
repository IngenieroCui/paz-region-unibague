"""Universidad de Ibagué academic programs: name normalisation for the HARD program rule, and the
occupational fields (ramas) of each program for the soft `occupational` score component.

Why this exists (v0.3.2)
------------------------
The program-profile rule is the most consequential hard rule: a pair whose student program is not the
plaza's `Perfil` / `Perfil (alternativo)` is blocked. Institutional sources do not write program names
the same way: the Tablero uses "Ingeniería Sistemas" and "Contaduría" while the official catalogue says
"Ingeniería de Sistemas" and "Contaduría Pública", and a 2026B plaza profile reads "Administración de
Emrpresas" (typo). Exact string comparison would silently EXCLUDE eligible students. Every name is
therefore mapped to a canonical program, and every non-exact mapping is reported (never silent):

1. exact canonical name (accents, case, spacing and connector words "de/en/y/del/la" ignored);
2. explicit alias (abbreviations and short names observed in institutional files);
3. a single typing slip against the catalogue only: all words equal except one, which differs by one
   insertion, deletion, substitution or transposition (and the result must be unique); reported as
   ``PROGRAMA_CORREGIDO_APROX``. Two-edit differences are NOT corrected ("Eléctrica" is not "Electrónica");
4. otherwise the folded name itself (two identical unknown names still match each other), reported as
   ``PROGRAMA_NO_RECONOCIDO``.

A profile cell may list several programs separated by "/", ";", "|" or ","; each one counts.

Occupational fields: summarised in our own words from each program's official page "perfil ocupacional"
/ "perfil profesional" (https://www.unibague.edu.co/programas-profesionales, consulted 2026-11-16).
Every branch counts equally: the component takes the BEST branch for a project, so a broad program
(e.g. Systems: software, networks, cloud, IT projects, entrepreneurship) is never penalised for its
breadth, and a project in any of its branches is a legitimate fit. The component is soft: it never
blocks a pair. Version `CATALOG_VERSION` is recorded in every run.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher
from functools import lru_cache

from .text import strip_accents

CATALOG_VERSION = "unibague-programas/2026-11-16"
CATALOG_SOURCE = "https://www.unibague.edu.co/programas-profesionales (consultado 2026-11-16)"

# canonical name -> faculty (current offer) ; legacy/other programs observed in PyR files are marked.
PROGRAMS: dict[str, str] = {
    "Derecho": "Derecho, Administración y Economía",
    "Administración de Empresas": "Derecho, Administración y Economía",
    "Administración de Negocios Internacionales": "Derecho, Administración y Economía",
    "Contaduría Pública": "Derecho, Administración y Economía",
    "Economía": "Derecho, Administración y Economía",
    "Mercadeo": "Derecho, Administración y Economía",
    "Ingeniería Civil": "Ciencias, Ingeniería e Innovación",
    "Ingeniería Electrónica": "Ciencias, Ingeniería e Innovación",
    "Ingeniería Industrial": "Ciencias, Ingeniería e Innovación",
    "Ingeniería Mecánica": "Ciencias, Ingeniería e Innovación",
    "Ingeniería de Sistemas": "Ciencias, Ingeniería e Innovación",
    "Ingeniería en Analítica de Datos": "Ciencias, Ingeniería e Innovación",
    "Biología Ambiental": "Ciencias, Ingeniería e Innovación",
    "Arquitectura": "Humanidades, Artes, Filosofía y Educación",
    "Comunicación Social y Periodismo": "Humanidades, Artes, Filosofía y Educación",
    "Diseño": "Humanidades, Artes, Filosofía y Educación",
    "Psicología": "Humanidades, Artes, Filosofía y Educación",
    # Observed in Tablero 2026B but not in the current catalogue page (legacy cohorts or agreements).
    "Administración Financiera": "Programa anterior / cohortes vigentes",
    "Ciencia Política": "Programa anterior / cohortes vigentes",
    "Fisioterapia (UAM)": "Convenio con otra universidad",
}

# folded alias -> canonical. Folded = upper, no accents, connector words removed, single spaces.
_ALIASES_RAW = {
    "Contaduría": "Contaduría Pública",
    "Contaduria Publica": "Contaduría Pública",
    "Ing Sistemas": "Ingeniería de Sistemas",
    "Ing. de Sistemas": "Ingeniería de Sistemas",
    "Sistemas": "Ingeniería de Sistemas",
    "Ing Civil": "Ingeniería Civil",
    "Ing Industrial": "Ingeniería Industrial",
    "Ing Mecánica": "Ingeniería Mecánica",
    "Ing Electrónica": "Ingeniería Electrónica",
    "Analítica de Datos": "Ingeniería en Analítica de Datos",
    "Ingeniería Analítica de Datos": "Ingeniería en Analítica de Datos",
    "Ingeniería de Datos": "Ingeniería en Analítica de Datos",
    "Biología": "Biología Ambiental",
    "Comunicación Social": "Comunicación Social y Periodismo",
    "Comunicación Social Periodismo": "Comunicación Social y Periodismo",
    "Periodismo": "Comunicación Social y Periodismo",
    "Negocios Internacionales": "Administración de Negocios Internacionales",
    "Admon Empresas": "Administración de Empresas",
    "Adm Empresas": "Administración de Empresas",
    "Admon Negocios Internacionales": "Administración de Negocios Internacionales",
    "Adm Negocios Internacionales": "Administración de Negocios Internacionales",
    "Diseño Gráfico": "Diseño",
    "Diseño Industrial": "Diseño",
    "Fisioterapia UAM": "Fisioterapia (UAM)",
    "Fisioterapia": "Fisioterapia (UAM)",
    "Ciencia Política Gobierno Relaciones Internacionales": "Ciencia Política",
}

_CONNECTORS = {"DE", "EN", "Y", "DEL", "LA", "LAS", "LOS", "EL", "E"}
_SPLIT = re.compile(r"\s*[/;|,]\s*")
# Values that mean "not yet known". Treated as missing (unknown), never as a real program or place.
PLACEHOLDERS = frozenset({
    "PENDIENTE", "PENDIENTE NOMBRE PROYECTO", "PENDIENTE NOMBRE", "POR DEFINIR", "SIN DEFINIR", "POR ASIGNAR", "SIN ASIGNAR",
    "NO APLICA", "N A", "NA", "N/A", "NINGUNO", "NINGUNA", "-", "--", "---", "#N/A", "#REF!", "#VALUE!", "#NAME?", "#DIV/0!", "XX", "XXX",
    "TBD", "?",
})


def fold(name: str | None) -> str:
    """Comparison key: upper case, no accents/punctuation, connector words removed."""
    if not name:
        return ""
    t = re.sub(r"[^A-Z0-9 ]+", " ", strip_accents(str(name)).upper())
    return " ".join(w for w in t.split() if w not in _CONNECTORS)


_PLACEHOLDER_KEYS = frozenset(fold(p) for p in PLACEHOLDERS if fold(p))


def is_placeholder(value) -> bool:
    if value is None:
        return False
    raw = strip_accents(str(value).strip().upper())
    return raw in PLACEHOLDERS or (bool(fold(raw)) and fold(raw) in _PLACEHOLDER_KEYS)


_CANON_BY_KEY = {fold(p): p for p in PROGRAMS}
_ALIASES = {fold(k): v for k, v in _ALIASES_RAW.items()}


def _osa(a: str, b: str) -> int:
    """Optimal-string-alignment distance (insert, delete, substitute, adjacent transposition)."""
    d = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        d[i][0] = i
    for j in range(len(b) + 1):
        d[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[len(a)][len(b)]


def _single_typo(key: str, target: str) -> bool:
    """Same words except exactly one, which differs by ONE edit and has >= 5 letters.

    Deliberately strict: it fixes typing slips ("Emrpresas", "Sistemsa", "Arquitectira") but never maps a
    different discipline onto a catalogue program ("Eléctrica" is two edits away from "Electrónica")."""
    a, b = key.split(), target.split()
    if len(a) != len(b):
        return False
    diff = [(x, y) for x, y in zip(a, b) if x != y]
    return len(diff) == 1 and min(len(diff[0][0]), len(diff[0][1])) >= 5 and _osa(*diff[0]) == 1


@lru_cache(maxsize=4096)
def resolve(name: str | None) -> tuple[str | None, str, float]:
    """(canonical program or folded unknown key, method, similarity). method: exacto | alias | aproximado | no_reconocido | vacio."""
    if name is None or not str(name).strip() or is_placeholder(name):
        return None, "vacio", 0.0
    key = fold(name)
    if not key:
        return None, "vacio", 0.0
    if key in _CANON_BY_KEY:
        return _CANON_BY_KEY[key], "exacto", 1.0
    if key in _ALIASES:
        return _ALIASES[key], "alias", 1.0
    typo = [c for k, c in {**_CANON_BY_KEY, **{a: v for a, v in _ALIASES.items()}}.items() if _single_typo(key, k)]
    best = max(SequenceMatcher(None, key, k).ratio() for k in _CANON_BY_KEY)
    if len(set(typo)) == 1:
        return typo[0], "aproximado", round(best, 3)
    return key, "no_reconocido", round(best, 3)


def split_programs(cell: str | None) -> list[str]:
    if not cell:
        return []
    return [p for p in _SPLIT.split(str(cell).strip()) if p and p.strip()]


def canonical_set(cell: str | None) -> frozenset[str]:
    out = set()
    for part in split_programs(cell):
        c, _, _ = resolve(part)
        if c:
            out.add(c)
    return frozenset(out)


def normalization_report(raw_values) -> list[dict]:
    """One row per distinct raw program text that was NOT an exact canonical name (for auditing)."""
    rows = []
    for raw in sorted({str(v).strip() for v in raw_values if v and str(v).strip()}):
        for part in split_programs(raw) or [raw]:
            c, method, sim = resolve(part)
            if method != "exacto":
                rows.append({"valor_original": part, "programa_canonico": c, "metodo": method, "similitud": sim,
                             "celda_con_varios_programas": "SI" if len(split_programs(raw)) > 1 else "NO"})
    return rows


# ------------------------------------------------------------------------------- occupational fields
# Each branch is a short keyword description in our own words (Spanish, professional vocabulary), so the
# semantic backends (TF-IDF + concept lexicon, or local embeddings) can compare it with project text.
OCCUPATIONAL_BRANCHES: dict[str, dict[str, str]] = {
    "Ingeniería de Sistemas": {
        "desarrollo_software": "desarrollo de software aplicaciones web y móviles programación sistemas de información a la medida pruebas y despliegue",
        "arquitectura_software": "arquitectura de software integración de sistemas tecnologías de la información soluciones TIC",
        "gestion_proyectos_ti": "gestión de proyectos de desarrollo de software metodologías ágiles transformación digital",
        "redes_nube": "diseño y administración de redes LAN WiFi conectividad servidores servicios en la nube infraestructura tecnológica",
        "consultoria_ti": "asesoría y consultoría en tecnología soporte tecnológico apropiación TIC seguridad de la información",
        "emprendimiento_tecnologico": "emprendimiento tecnológico empresas de software innovación digital",
    },
    "Ingeniería en Analítica de Datos": {
        "inteligencia_negocios": "inteligencia de negocios tableros de indicadores toma de decisiones basada en datos",
        "ingenieria_datos": "ingeniería de datos bases de datos gestión y calidad de datos",
        "ciencia_datos": "ciencia de datos modelos predictivos inteligencia artificial aprendizaje automático estadística",
        "visualizacion": "visualización de datos reportes análisis de información",
        "seguridad_datos": "administración de datos seguridad de la información",
        "consultoria_analitica": "asesoría y consultoría en analítica de datos caracterización y diagnóstico con datos",
    },
    "Ingeniería Civil": {
        "estructuras": "estructuras diseño estructural edificaciones vulnerabilidad sísmica",
        "geotecnia": "geotecnia suelos estabilidad de taludes",
        "hidraulica": "hidráulica hidrología acueducto redes de agua modelación hidráulica pérdidas de agua",
        "sanitaria": "ingeniería sanitaria alcantarillado tratamiento de agua potable saneamiento",
        "vias_transporte": "vías terciarias transporte movilidad placa huella caminos rurales",
        "construccion_obras": "construcción supervisión e interventoría de obras presupuesto de obra infraestructura pública",
    },
    "Ingeniería Electrónica": {
        "sistemas_electronicos": "diseño y construcción de sistemas electrónicos circuitos prototipos",
        "automatizacion_control": "automatización y control electrónico sensores robótica",
        "telecomunicaciones": "telecomunicaciones sistemas de comunicaciones conectividad",
        "mantenimiento_equipos": "mantenimiento y adaptación de equipos electrónicos soporte tecnológico",
        "proyectos_tecnologicos": "gestión de proyectos tecnológicos innovación robótica educativa energía solar",
    },
    "Ingeniería Industrial": {
        "planeacion": "planeación estratégica gestión organizacional procesos y procedimientos",
        "produccion_calidad": "producción calidad sistema integrado de gestión estandarización mejora continua productividad",
        "logistica": "logística cadena de suministro inventarios almacén",
        "gestion_humana_sst": "gestión humana seguridad y salud en el trabajo bienestar laboral",
        "finanzas_sistemas": "finanzas costos sistemas de información",
        "emprendimiento_consultoria": "emprendimiento creación de negocios consultoría empresarial",
    },
    "Ingeniería Mecánica": {
        "diseno_equipos": "diseño de equipos montaje prototipos diseño 3D",
        "materiales_fabricacion": "materiales procesos de fabricación manufactura",
        "termicas_fluidos": "máquinas térmicas y fluidos bombas",
        "energia": "energía energías renovables eficiencia energética paneles solares",
        "mantenimiento": "planes de mantenimiento mecánico mantenimiento preventivo maquinaria",
    },
    "Derecho": {
        "asesoria_representacion": "asesoría y representación jurídica consultorio jurídico procesos judiciales y extrajudiciales",
        "sector_publico": "gestión pública funciones legales administrativas contratación pública control institucional",
        "politicas_publicas": "políticas públicas participación ciudadana desarrollo regional",
        "derechos_humanos_victimas": "derechos humanos víctimas del conflicto armado acceso a la justicia",
        "conflictos_conciliacion": "resolución de conflictos conciliación mediación convivencia",
        "investigacion_sociojuridica": "investigación sociojurídica pedagogía en derechos",
    },
    "Administración de Empresas": {
        "gerencia": "gerencia y gestión de organizaciones públicas y privadas planeación estratégica",
        "areas_funcionales": "gestión administrativa financiera comercial mercadeo talento humano y operaciones",
        "emprendimiento": "emprendimiento creación de empresas modelo de negocio",
        "consultoria": "consultoría y asesoría empresarial fortalecimiento organizacional",
        "proyectos": "formulación ejecución y evaluación de proyectos",
    },
    "Administración de Negocios Internacionales": {
        "comercio_exterior": "comercio exterior internacionalización negociación internacional exportaciones",
        "comercial_mercadeo": "gerencia comercial mercadeo servicio al cliente",
        "finanzas_riesgo": "gestión financiera análisis de riesgo crédito",
        "operaciones": "cadena de suministro producción talento humano",
        "proyectos_emprendimiento": "formulación y evaluación de proyectos emprendimiento asesoría empresarial",
    },
    "Contaduría Pública": {
        "contabilidad": "contabilidad información contable y financiera estados financieros",
        "control_auditoria": "control interno auditoría revisoría fiscal gestión del riesgo",
        "tributaria": "tributaria impuestos obligaciones fiscales",
        "costos_presupuesto": "costos presupuesto tesorería finanzas",
        "sistemas_informacion": "sistemas de información contable asesoría de negocios",
    },
    "Economía": {
        "investigacion_economica": "investigación y planeación económica estudios económicos observatorio",
        "desarrollo_regional": "planeación del desarrollo regional competitividad territorio",
        "proyectos_inversion": "elaboración de proyectos de inversión formulación de proyectos",
        "asesoria": "asesoría y consultoría económica política pública",
        "docencia": "docencia educación financiera y económica",
    },
    "Mercadeo": {
        "gerencia_mercadeo": "gerencia de mercadeo estrategia comercial posicionamiento de marca",
        "investigacion_mercados": "investigación de mercados comportamiento del consumidor",
        "marketing_digital": "marketing digital comercio electrónico redes sociales contenidos",
        "analitica_mercadeo": "analítica de datos e inteligencia artificial aplicada al mercadeo",
        "emprendimiento": "emprendimiento consultoría empresarial sostenibilidad",
    },
    "Biología Ambiental": {
        "ciencias_ambientales": "ciencias ambientales análisis de datos ambientales monitoreo",
        "conservacion": "conservación de biodiversidad fauna flora ecosistemas uso sostenible de recursos naturales",
        "bioeconomia": "bioeconomía bioproductos aprovechamiento sostenible",
        "gestion_ambiental": "gestión y políticas ambientales planificación territorial corporaciones autónomas",
        "investigacion": "investigación ecológica inventario de especies",
    },
    "Arquitectura": {
        "proyecto_arquitectonico": "diseño de proyectos arquitectónicos espacios habitables levantamiento arquitectónico planos",
        "urbanismo": "urbanismo espacio público movilidad ordenamiento territorial",
        "construccion_gestion": "construcción y gestión de obras infraestructura comunitaria presupuesto",
        "territorio_social": "arquitectura participativa vivienda patrimonio desarrollo social del territorio",
    },
    "Comunicación Social y Periodismo": {
        "periodismo_contenidos": "periodismo producción de contenidos escritos radiales audiovisuales digitales y multimedia",
        "comunicacion_organizacional": "comunicación organizacional comunicación institucional relaciones públicas",
        "cambio_social": "comunicación para el cambio social participación ciudadana memoria",
        "investigacion": "investigación periodística y en comunicación narrativas del territorio",
    },
    "Diseño": {
        "comunicacion_visual": "diseño para la comunicación visual identidad visual imagen institucional piezas gráficas",
        "producto": "diseño de producto prototipos nuevos productos y servicios",
        "innovacion": "identificación de oportunidades de diseño conceptualización innovación",
        "gestion_diseno": "gestión de proyectos de diseño estrategia de implementación",
    },
    "Psicología": {
        "psicosocial": "atención psicosocial a población vulnerable víctimas política pública",
        "educativa_comunitaria": "programas educativos y comunitarios convivencia escolar intervención grupal",
        "organizacional": "psicología organizacional talento humano bienestar laboral clima organizacional",
        "clinica_salud": "promoción prevención salud mental psicología clínica y de la salud",
    },
    "Administración Financiera": {
        "finanzas": "gestión financiera presupuesto inversión crédito riesgo",
        "contable": "información contable costos tesorería",
    },
    "Ciencia Política": {
        "politica_publica": "políticas públicas gobierno gestión pública planeación",
        "participacion": "participación ciudadana construcción de paz análisis político",
    },
    "Fisioterapia (UAM)": {
        "rehabilitacion": "rehabilitación física actividad física salud",
        "adulto_mayor": "bienestar del adulto mayor promoción de la salud",
    },
}


def branches(canonical: str | None) -> dict[str, str]:
    return OCCUPATIONAL_BRANCHES.get(canonical or "", {})


def all_branch_texts() -> list[str]:
    return [t for b in OCCUPATIONAL_BRANCHES.values() for t in b.values()]
