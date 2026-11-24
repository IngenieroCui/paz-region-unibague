"""HELD-OUT synthetic paraphrase pairs (written BEFORE the v0.3.1 concept lexicon was built).

Never tune `pyr_matching/semantic_lexicon.py` against these pairs: they exist to measure generalisation.
The development set is `PAIRS` in `semantic_benchmark.py`. Hand-written by the engineering team;
not institutional data and not a validation of PyR quality.
"""

HOLDOUT_PAIRS = [
    ("Quiero que los campesinos produzcan abono orgánico con lo que les sobra de la cosecha.", "Transformación de residuos agrícolas en compost para fincas familiares."),
    ("Me interesa ayudar a madres cabeza de hogar a conseguir empleo.", "Ruta de empleabilidad e inserción laboral para mujeres jefas de hogar."),
    ("Deseo enseñar matemáticas de forma divertida a los niños.", "Estrategias lúdicas para el aprendizaje del pensamiento numérico en básica primaria."),
    ("Quiero hacer videos y fotos que cuenten la historia del pueblo.", "Producción audiovisual comunitaria y memoria local."),
    ("Me gustaría revisar que las casas sean seguras ante terremotos.", "Evaluación de vulnerabilidad sísmica de viviendas rurales."),
    ("Quiero acompañar a personas con discapacidad para que participen en la comunidad.", "Inclusión social y rehabilitación basada en comunidad."),
    ("Me interesa crear una página web para vender artesanías.", "Comercio electrónico y tienda virtual para artesanos del municipio."),
    ("Quiero ayudar a prevenir incendios en los bosques.", "Gestión del riesgo de incendios forestales y brigadas comunitarias."),
    ("Deseo trabajar con migrantes venezolanos.", "Atención e integración de población migrante y refugiada."),
    ("Me gustaría enseñar a los jóvenes a crear sus propias empresas.", "Formación en emprendimiento juvenil y planes de negocio."),
    ("Quiero cuidar la salud de los dientes de los niños.", "Promoción de la salud oral en instituciones educativas."),
    ("Me interesa medir cuánta lluvia cae y cómo cambia el clima.", "Red de estaciones meteorológicas y monitoreo de variabilidad climática."),
    ("Quiero apoyar a la policía y la comunidad para que haya menos robos.", "Estrategias de seguridad ciudadana y convivencia en barrios."),
    ("Deseo organizar ferias para que los productores vendan directamente.", "Mercados campesinos y circuitos cortos de comercialización."),
    ("Me gustaría ayudar a que la alcaldía rinda cuentas a los ciudadanos.", "Transparencia, control social y participación ciudadana en la gestión pública."),
    ("Quiero enseñar a las familias a cultivar alimentos en casa.", "Huertas caseras para la soberanía alimentaria de hogares vulnerables."),
    ("Me interesa calcular cuánto cuesta producir leche en las fincas.", "Análisis de costos de producción en ganadería lechera."),
    ("Quiero apoyar a niños que trabajan en vez de estudiar.", "Prevención y erradicación del trabajo infantil."),
    ("Deseo diseñar juegos educativos en el computador.", "Desarrollo de videojuegos y recursos educativos digitales."),
    ("Me gustaría acompañar a familias que buscan a sus desaparecidos.", "Apoyo psicosocial a familiares de personas dadas por desaparecidas en el conflicto."),
    ("Quiero ayudar a que los colegios reciclen.", "Programa de educación ambiental y separación en la fuente en escuelas."),
    ("Me interesa enseñar primeros auxilios.", "Capacitación comunitaria en atención prehospitalaria y respuesta a emergencias."),
    ("Quiero mejorar los caminos para sacar el café.", "Mantenimiento de vías terciarias para la movilidad de la producción cafetera."),
    ("Deseo apoyar a las juntas de acción comunal a organizarse mejor.", "Fortalecimiento organizativo de organizaciones comunitarias de base."),
    ("Me gustaría enseñar a tocar instrumentos a los niños.", "Iniciación musical y práctica instrumental infantil."),
    ("Quiero ayudar a las personas a tramitar su pensión.", "Asesoría jurídica en seguridad social para adultos mayores."),
    ("Me interesa estudiar las plantas medicinales de la región.", "Etnobotánica y saberes tradicionales sobre plantas de uso medicinal."),
    ("Quiero reducir el consumo de luz en los edificios públicos.", "Eficiencia energética en instalaciones de la administración municipal."),
    ("Deseo ayudar a que los indígenas conserven su lengua.", "Revitalización lingüística y cultural de comunidades étnicas."),
    ("Me gustaría hacer encuestas para saber qué necesita la gente.", "Diagnóstico participativo y caracterización socioeconómica de la población."),
]
