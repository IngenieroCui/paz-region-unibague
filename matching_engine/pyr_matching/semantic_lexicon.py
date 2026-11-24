"""Thematic concept lexicon for PyR professional text (Spanish, accent-folded).

Purpose: let the offline, dependency-free backend (`tfidf-conceptos`) connect paraphrases that share
no literal words ("niños de veredas" ↔ "primera infancia rural", "celulares" ↔ "app móvil").

Each concept lists triggers:
* a single token trigger is a PREFIX matched against accent-folded tokens (``"campesin"`` matches
  "campesino", "campesinas");
* a trigger with a space is a PHRASE matched against the accent-folded, space-joined token sequence.

Design rules (keep them when editing):
* Concepts are generic thematic areas of territorial social practice, not tuned to any dataset.
* Triggers have ≥ 3 characters; avoid generic verbs ("apoyar", "ayudar", "trabajar", "gestionar").
* A token may trigger several concepts (e.g. "huerta" → agro and nutrición). IDF weighting computed per
  run automatically down-weights concepts that appear everywhere.
* Never add identity, health-condition-of-a-person, ethnicity-of-a-student or other sensitive
  attributes as matching signals: these triggers describe PROJECT THEMES, and they only compare
  professional text (expectations, interests, project descriptions). See docs/FAIRNESS_PRIVACY.md.

Version this file with `LEXICON_VERSION` whenever triggers change: the version is recorded in every
run (`backend_semantico`), so results remain reproducible.
"""
from __future__ import annotations

LEXICON_VERSION = "pyr-conceptos-es/1.1"

CONCEPTS: dict[str, tuple[str, ...]] = {
    "infancia": ("nino", "nina", "ninez", "infan", "infancia", "bebe", "primera infancia", "menores de edad", "basica primaria", "preescol"),
    "juventud": ("joven", "juven", "adolesc", "muchach", "secundaria", "bachiller"),
    "adulto_mayor": ("anciano", "ancianos", "tercera edad", "adulto mayor", "adultos mayores", "personas mayores", "envejec", "vejez", "abuel", "pension"),
    "educacion": ("ensen", "educa", "escuel", "colegi", "pedagog", "docen", "profesor", "maestr", "aula", "estudiant", "capacit", "formacion", "alfabet",
                  "institucion educativa", "instituciones educativas", "psicopedagog", "didact", "ludic"),
    "lectura_escritura": ("leer", "lectur", "lectoescrit", "escritur", "biblioteca", "alfabetizacion"),
    "matematicas": ("matemat", "numeric", "calculo", "aritmet"),
    "idiomas": ("ingles", "idioma", "lengua extranjera", "bilingu", "frances"),
    "tecnologia": ("plataforma", "plataformas", "sistematiz", "transformacion digital", "desarrollo web", "multiplataforma", "activos digitales", "progra", "software", "aplicacion", "aplicaciones", "app", "apps", "celular", "movil", "moviles", "digital", "computad", "informat",
                   "internet", "web", "pagina web", "videojueg", "tecnolog", "virtual", "sistemas de informacion", "base de datos", "datos abiertos", "tic"),
    "agro": ("agricul", "agro", "campesin", "cosech", "cultiv", "finca", "fincas", "siembra", "semilla", "ganad", "lecher", "leche", "cafe", "cafeter",
             "abono", "compost", "huerta", "huertas", "productores rurales", "productor", "pecuari", "agropecu", "veredas", "vereda", "rural", "rurales"),
    "comercializacion": ("vender", "venta", "ventas", "comerci", "mercad", "feria", "tienda", "marca", "branding", "publicidad", "cliente", "circuitos cortos"),
    "finanzas_contabilidad": ("control interno", "revisoria fiscal", "estados financieros", "cartera", "activos fijos", "inversion", "contab", "contad", "cuentas", "finan", "tribut", "impuest", "costo", "costos", "rentab", "dinero", "ahorr", "presupuest", "credito",
                              "ingresos", "tesorer", "auditor"),
    "emprendimiento": ("empren", "empresa", "empresas", "mipyme", "pyme", "negocio", "negocios", "plan de negocio", "planes de negocio", "iniciativas productivas",
                       "unidad productiva", "unidades productivas"),
    "empleo": ("emple", "laboral", "insercion laboral", "trabajo infantil", "ocupacion", "oficio"),
    "salud": ("fisioterap", "rehabilitacion fisica", "sindrome", "hipertens", "salud", "hospital", "medic", "enferm", "clinic", "ese municipal", "odonto", "dient", "salud oral", "bucal", "primeros auxilios",
              "prehospital", "vacun", "epidemi", "plantas medicinales"),
    "salud_mental": ("salud mental", "emocion", "psicolog", "psicosoc", "bienestar emocional", "depres", "ansiedad", "suicid", "duelo"),
    "nutricion": ("nutric", "aliment", "comida", "desnutr", "seguridad alimentaria", "soberania alimentaria", "huerta", "huertas", "cultivar alimentos"),
    "conflicto_victimas": ("conflicto armado", "victima", "victimas", "memoria historica", "memoria", "desapare", "reparacion", "posconflicto",
                           "reincorpor", "excombatient", "restitucion"),
    "paz_convivencia": ("paz", "convivencia", "reconcil", "mediacion", "violencia", "pacific", "resolucion de conflictos", "seguridad ciudadana", "robo", "robos",
                        "delito", "delincu", "matoneo", "acoso escolar"),
    "derechos_justicia": ("tutela", "tutelas", "peticiones", "conciliacion", "litigio", "contratacion publica", "secop", "cobro coactivo", "inspeccion de policia", "comisaria", "personeria", "fiscalia", "control fiscal", "veeduria", "acciones populares", "accion popular", "derecho", "derechos", "juridic", "abogad", "legal", "tramit", "consultorio juridico", "justicia", "seguridad social",
                          "derechos humanos", "ley", "leyes", "normativ"),
    "agua": ("hidraulic", "hidrolog", "catastro de redes", "perdidas de agua", "epanet", "planta de tratamiento", "plantas de tratamiento", "agua", "aguas", "rio", "rios", "quebrad", "hidric", "acueduct", "cuenca", "microcuenc", "potab", "saneamiento", "alcantarill", "lluvia"),
    "ambiente": ("bioeconom", "ecosistema", "especies", "aves", "recursos naturales", "corporacion autonoma", "gestion ambiental", "biofertiliz", "ambient", "residuo", "basura", "recicl", "contamin", "bosque", "forest", "fauna", "flora", "biodivers", "conservacion", "animales",
                 "silvestre", "ecolog", "reforest", "areas protegidas", "separacion en la fuente", "compost", "abono organico"),
    "clima": ("clima", "climat", "meteorolog", "temperatura", "cambio climatico", "lluvia", "estaciones meteorologicas"),
    "energia": ("energ", "solar", "fotovolt", "panel", "paneles", "electric", "luz"),
    "infraestructura": ("geotecn", "estructuras", "placa huella", "placas huella", "presupuesto de obra", "interventoria", "supervision de obras", "topograf", "levantamiento topografico", "puente", "puentes", "vias", "via terciaria", "vias terciarias", "camino", "caminos", "carretera", "infraestruct", "obra", "obras",
                        "drenaje", "construc", "vivienda", "viviendas", "casas", "estructural", "sismic", "terremot", "edificio", "edificios", "instalaciones"),
    "cultura_arte": ("music", "banda", "bandas", "artist", "arte", "artes", "cultura", "cultural", "patrimon", "instrument", "danza", "teatro", "artesan",
                     "folclor", "sinfon"),
    "deporte": ("deport", "entrenar", "entrenamiento", "recreacion", "actividad fisica", "tiempo libre", "futbol"),
    "turismo": ("turis", "rutas", "visitant", "ecoturis"),
    "comunicacion": ("periodis", "noticiero", "noticia", "reportaje", "contenidos", "multimedia", "comunicacion organizacional", "comunicacion institucional", "relaciones publicas", "community manager", "podcast", "comunicacion", "audiovisual", "video", "videos", "fotograf", "fotos", "radio", "periodis", "imagen", "visual", "redes sociales",
                     "diseno grafico", "contar historias"),
    "gestion_publica": ("alcaldia", "alcald", "gobierno", "administracion municipal", "gestion publica", "rendicion de cuentas", "rindan cuentas",
                        "transparencia", "control social", "archivo", "archivos", "documental", "documentos", "ciudadan", "concejo", "politica publica"),
    "organizacion_comunitaria": ("comunal", "junta de accion", "juntas de accion", "organizaciones comunitarias", "organizacion comunitaria", "asociacion",
                                 "asociatividad", "cooperativ", "lider", "liderazgo", "vecino", "vecinos", "participacion", "participativo", "fortalecimiento organizativo"),
    "genero_mujer": ("mujer", "mujeres", "madre", "madres", "genero", "jefas de hogar", "cabeza de hogar"),
    "discapacidad_inclusion": ("discapac", "inclusion", "inclusiva", "rehabilit", "dificultades de aprendizaje", "necesidades educativas", "accesibil"),
    "sustancias": ("drogas", "droga", "sustancias psicoactivas", "psicoactiv", "adiccion", "consumo de sustancias", "consumen drogas"),
    "territorio_cartografia": ("mapa", "mapas", "cartograf", "topograf", "dron", "drones", "georref", "sensores remotos", "sistemas de informacion geografica"),
    "migracion": ("migran", "migracion", "refugi", "venezol", "desplaz"),
    "etnico_saberes": ("indigen", "etnic", "afro", "lengua", "ancestral", "saberes tradicionales", "tradicional", "etnobotan", "cabildo"),
    "riesgo_emergencias": ("riesgo", "emergenc", "desastr", "incendi", "inundac", "brigad", "vulnerabilidad sismica", "primeros auxilios"),
    "investigacion_diagnostico": ("encuesta", "encuestas", "diagnostic", "caracteriz", "investigac", "levantamiento", "estadistic", "medir", "medicion"),
    "familia": ("familia", "familias", "hogar", "hogares", "crianza", "padres de familia"),
    "gestion_organizacional": ("administracion", "administrativ", "gerencia", "gerencial", "gestion organizacional", "planeacion estrategica",
                               "plan estrategico", "reestructuracion", "fortalecimiento organizacional", "estructura organizacional", "plan de accion",
                               "procesos administrativos", "direccion ejecutiva"),
    "talento_humano": ("talento humano", "gestion humana", "recursos humanos", "bienestar laboral", "clima organizacional", "seleccion de personal",
                       "factores humanos", "seguridad y salud en el trabajo", "sg sst", "competencias del personal"),
    "procesos_calidad_logistica": ("logistic", "cadena de suministro", "gestion de calidad", "sistema de calidad", "aseguramiento de calidad", "control de calidad", "calidad industrial", "estandares internacionales", "procesos y procedimientos", "procedimientos", "estandariz",
                                   "sistema integrado de gestion", "inventario", "inventarios", "almacen", "produccion", "productividad",
                                   "mejora continua", "optimizacion de procesos", "caracterizacion de procesos", "levantamiento de procesos"),
    "mecanica_manufactura": ("mecanic", "mantenimiento", "maquina", "maquinaria", "fabricacion", "manufactura", "materiales", "montaje",
                             "diseno 3d", "impresion 3d", "fabricacion digital", "prototipo", "prototipos", "termic", "fluid"),
    "electronica_automatizacion": ("electronic", "automatiz", "robotic", "sensores", "circuito", "circuitos", "telecomunicacion",
                                   "internet de las cosas", "iot", "sistemas embebidos", "iluminacion", "domotic"),
    "redes_infraestructura_ti": ("redes", "red lan", "wifi", "conectividad", "servidor", "servidores", "nube", "cloud", "ciberseguridad",
                                 "seguridad de la informacion", "soporte tecnico", "infraestructura tecnologica", "telecomunicaciones"),
    "analitica_datos": ("analitica", "analisis de datos", "base de datos", "bases de datos", "inteligencia de negocios", "visualizacion de datos",
                        "tablero", "tableros", "indicadores", "modelo predictivo", "predictivo", "aprendizaje automatico", "machine learning",
                        "inteligencia artificial", "ciencia de datos", "big data", "arbol de decisiones"),
    "arquitectura_urbanismo": ("arquitect", "urbanis", "urbano", "urbana", "espacio publico", "espacios habitables", "planos",
                               "levantamiento arquitectonico", "diseno arquitectonico", "ordenamiento territorial", "renovacion urbana",
                               "equipamiento", "movilidad"),
    "diseno_grafico_producto": ("diseno grafico", "identidad visual", "imagen corporativa", "imagen institucional", "branding", "piezas graficas",
                                "diseno de producto", "ilustracion", "senaletica", "empaque", "comunicacion visual", "identidad"),
    "comercio_exterior": ("comercio exterior", "internacionaliz", "exportac", "importac", "negocios internacionales", "mercados internacionales",
                          "aduan", "cooperacion internacional", "comercio internacional"),
    "planeacion_proyectos_publicos": ("formulacion de proyectos", "banco de proyectos", "plan de desarrollo", "politica publica", "politicas publicas",
                                      "planeacion", "secretaria de planeacion", "proyectos de inversion", "seguimiento de proyectos", "regalias",
                                      "estructuracion de proyectos", "fuentes de financiacion"),
    "economia_desarrollo": ("economia", "economic", "desarrollo regional", "desarrollo economico", "competitividad", "observatorio",
                            "mercado laboral", "economia solidaria", "cadenas productivas"),
}


_COMPILED: dict[str, tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...]]] | None = None


def _compiled():
    """(prefix triggers, exact triggers, phrase triggers) per concept. Phrases are tokenised with the same
    rules as the texts (stopwords and tokens < 3 chars removed), so "junta de acción" matches "junta accion".
    Single triggers of 3 characters match EXACTLY (avoids "rio" matching "Rioblanco"); longer ones are prefixes."""
    global _COMPILED
    if _COMPILED is None:
        from .semantic import normalize_tokens_ordered

        out = {}
        for cid, triggers in CONCEPTS.items():
            pref, exact, phrases = [], [], []
            for trig in triggers:
                toks = normalize_tokens_ordered(trig)
                if len(toks) > 1:
                    phrases.append(" ".join(toks))
                elif toks:
                    (exact if len(toks[0]) <= 3 else pref).append(toks[0])
                elif " " not in trig and len(trig) == 3:  # e.g. "paz", "app" are stopword-free 3-char exact triggers
                    exact.append(trig)
            out[cid] = (tuple(pref), tuple(exact), tuple(phrases))
        _COMPILED = out
    return _COMPILED


def concept_hits(tokens: list[str]) -> list[str]:
    """Concept ids triggered by an ordered, accent-folded token list (capped at 3 hits per concept)."""
    if not tokens:
        return []
    joined = " " + " ".join(tokens) + " "
    hits: list[str] = []
    for cid, (pref, exact, phrases) in _compiled().items():
        n = sum(joined.count(" " + ph + " ") for ph in phrases)
        for t in tokens:
            if t in exact or any(t.startswith(p) for p in pref):
                n += 1
        if n:
            hits.extend([cid] * min(n, 3))  # cap: a long text repeating one theme must not dominate
    return hits
