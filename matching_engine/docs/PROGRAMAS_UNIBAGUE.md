# Programas de la Universidad de Ibagué en el motor PyR

Catálogo `unibague-programas/2026-11-16` (`pyr_matching/programs.py`). Fuente: oferta de [programas profesionales](https://www.unibague.edu.co/programas-profesionales) y la sección *perfil ocupacional / perfil profesional* de la página de cada programa, consultadas el 16-nov-2026. Las ramas están resumidas con palabras propias del equipo, no copiadas.

Todos los programas cursan el Semestre Paz y Región. El catálogo cumple dos funciones:

1. **Restricción de perfil (obligatoria).** Reconciliar los nombres de programa escritos de formas distintas en las fuentes (Tablero, SIGA, formularios) antes de comparar el programa del estudiante con el `Perfil` / `Perfil (alternativo)` de la plaza. Ver *Reglas de reconciliación*.
2. **Campo profesional (componente blando `occupational`).** Cada rama es un campo de trabajo legítimo del programa. El componente toma la **mejor rama** frente al proyecto, así que ningún programa se penaliza por ser amplio y ninguna rama excluye. Nunca bloquea una pareja. Con la política v0.3.2 solo se usa cuando el estudiante no escribió texto profesional (`occupational_mode = fallback`).

## Reglas de reconciliación de nombres

| Paso | Ejemplo | Resultado | Se informa como |
|---|---|---|---|
| Nombre exacto (sin tildes, mayúsculas, espacios ni conectores *de, en, y, del, la*) | `Ingeniería Sistemas` | Ingeniería de Sistemas | (no se lista) |
| Alias | `Contaduría`, `Ing. Industrial`, `Fisioterapia UAM` | Contaduría Pública, Ingeniería Industrial, Fisioterapia (UAM) | `alias` |
| Un solo error de digitación en una sola palabra de 5 o más letras | `Administración de Emrpresas`, `Arquitectira` | Administración de Empresas, Arquitectura | `aproximado` + advertencia `PROGRAMA_CORREGIDO_APROX` |
| Cualquier otra diferencia | `Ingeniería Eléctrica`, `Psicología Social` | no se corrige: solo coincide con el mismo nombre escrito igual | `no_reconocido` + advertencia `PROGRAMA_NO_RECONOCIDO` |
| Marcador de dato pendiente | `PENDIENTE`, `N/A`, `#REF!` | vacío (desconocido) | `VALOR_PENDIENTE_COMO_DESCONOCIDO` |
| Celda con varios programas separados por `/ ; , \|` | `Psicología / Derecho` | cada programa cuenta | — |

Todas las reconciliaciones no exactas aparecen en la hoja `Normalizacion_Programas` del libro de resultados. La regla es deliberadamente estricta: corrige errores de tecleo, pero nunca convierte una disciplina distinta en un programa del catálogo ("Eléctrica" está a dos ediciones de "Electrónica").

## Catálogo y ramas ocupacionales

| Programa | Facultad | Página | Ramas (campos de trabajo) |
|---|---|---|---|
| Derecho | Derecho, Administración y Economía | [enlace](https://www.unibague.edu.co/derecho) | **asesoria representacion**: asesoría y representación jurídica consultorio jurídico procesos judiciales y extrajudiciales; **sector publico**: gestión pública funciones legales administrativas contratación pública control institucional; **politicas publicas**: políticas públicas participación ciudadana desarrollo regional; **derechos humanos victimas**: derechos humanos víctimas del conflicto armado acceso a la justicia; **conflictos conciliacion**: resolución de conflictos conciliación mediación convivencia; **investigacion sociojuridica**: investigación sociojurídica pedagogía en derechos |
| Administración de Empresas | Derecho, Administración y Economía | [enlace](https://www.unibague.edu.co/empresas) | **gerencia**: gerencia y gestión de organizaciones públicas y privadas planeación estratégica; **areas funcionales**: gestión administrativa financiera comercial mercadeo talento humano y operaciones; **emprendimiento**: emprendimiento creación de empresas modelo de negocio; **consultoria**: consultoría y asesoría empresarial fortalecimiento organizacional; **proyectos**: formulación ejecución y evaluación de proyectos |
| Administración de Negocios Internacionales | Derecho, Administración y Economía | [enlace](https://www.unibague.edu.co/negocios-internacionales) | **comercio exterior**: comercio exterior internacionalización negociación internacional exportaciones; **comercial mercadeo**: gerencia comercial mercadeo servicio al cliente; **finanzas riesgo**: gestión financiera análisis de riesgo crédito; **operaciones**: cadena de suministro producción talento humano; **proyectos emprendimiento**: formulación y evaluación de proyectos emprendimiento asesoría empresarial |
| Contaduría Pública | Derecho, Administración y Economía | [enlace](https://www.unibague.edu.co/contaduria) | **contabilidad**: contabilidad información contable y financiera estados financieros; **control auditoria**: control interno auditoría revisoría fiscal gestión del riesgo; **tributaria**: tributaria impuestos obligaciones fiscales; **costos presupuesto**: costos presupuesto tesorería finanzas; **sistemas informacion**: sistemas de información contable asesoría de negocios |
| Economía | Derecho, Administración y Economía | [enlace](https://www.unibague.edu.co/economia) | **investigacion economica**: investigación y planeación económica estudios económicos observatorio; **desarrollo regional**: planeación del desarrollo regional competitividad territorio; **proyectos inversion**: elaboración de proyectos de inversión formulación de proyectos; **asesoria**: asesoría y consultoría económica política pública; **docencia**: docencia educación financiera y económica |
| Mercadeo | Derecho, Administración y Economía | [enlace](https://www.unibague.edu.co/mercadeo) | **gerencia mercadeo**: gerencia de mercadeo estrategia comercial posicionamiento de marca; **investigacion mercados**: investigación de mercados comportamiento del consumidor; **marketing digital**: marketing digital comercio electrónico redes sociales contenidos; **analitica mercadeo**: analítica de datos e inteligencia artificial aplicada al mercadeo; **emprendimiento**: emprendimiento consultoría empresarial sostenibilidad |
| Ingeniería Civil | Ciencias, Ingeniería e Innovación | [enlace](https://www.unibague.edu.co/civil) | **estructuras**: estructuras diseño estructural edificaciones vulnerabilidad sísmica; **geotecnia**: geotecnia suelos estabilidad de taludes; **hidraulica**: hidráulica hidrología acueducto redes de agua modelación hidráulica pérdidas de agua; **sanitaria**: ingeniería sanitaria alcantarillado tratamiento de agua potable saneamiento; **vias transporte**: vías terciarias transporte movilidad placa huella caminos rurales; **construccion obras**: construcción supervisión e interventoría de obras presupuesto de obra infraestructura pública |
| Ingeniería Electrónica | Ciencias, Ingeniería e Innovación | [enlace](https://www.unibague.edu.co/electronica) | **sistemas electronicos**: diseño y construcción de sistemas electrónicos circuitos prototipos; **automatizacion control**: automatización y control electrónico sensores robótica; **telecomunicaciones**: telecomunicaciones sistemas de comunicaciones conectividad; **mantenimiento equipos**: mantenimiento y adaptación de equipos electrónicos soporte tecnológico; **proyectos tecnologicos**: gestión de proyectos tecnológicos innovación robótica educativa energía solar |
| Ingeniería Industrial | Ciencias, Ingeniería e Innovación | [enlace](https://www.unibague.edu.co/industrial) | **planeacion**: planeación estratégica gestión organizacional procesos y procedimientos; **produccion calidad**: producción calidad sistema integrado de gestión estandarización mejora continua productividad; **logistica**: logística cadena de suministro inventarios almacén; **gestion humana sst**: gestión humana seguridad y salud en el trabajo bienestar laboral; **finanzas sistemas**: finanzas costos sistemas de información; **emprendimiento consultoria**: emprendimiento creación de negocios consultoría empresarial |
| Ingeniería Mecánica | Ciencias, Ingeniería e Innovación | [enlace](https://www.unibague.edu.co/mecanica) | **diseno equipos**: diseño de equipos montaje prototipos diseño 3D; **materiales fabricacion**: materiales procesos de fabricación manufactura; **termicas fluidos**: máquinas térmicas y fluidos bombas; **energia**: energía energías renovables eficiencia energética paneles solares; **mantenimiento**: planes de mantenimiento mecánico mantenimiento preventivo maquinaria |
| Ingeniería de Sistemas | Ciencias, Ingeniería e Innovación | [enlace](https://www.unibague.edu.co/sistemas) | **desarrollo software**: desarrollo de software aplicaciones web y móviles programación sistemas de información a la medida pruebas y despliegue; **arquitectura software**: arquitectura de software integración de sistemas tecnologías de la información soluciones TIC; **gestion proyectos ti**: gestión de proyectos de desarrollo de software metodologías ágiles transformación digital; **redes nube**: diseño y administración de redes LAN WiFi conectividad servidores servicios en la nube infraestructura tecnológica; **consultoria ti**: asesoría y consultoría en tecnología soporte tecnológico apropiación TIC seguridad de la información; **emprendimiento tecnologico**: emprendimiento tecnológico empresas de software innovación digital |
| Ingeniería en Analítica de Datos | Ciencias, Ingeniería e Innovación | [enlace](https://www.unibague.edu.co/analiticadedatos) | **inteligencia negocios**: inteligencia de negocios tableros de indicadores toma de decisiones basada en datos; **ingenieria datos**: ingeniería de datos bases de datos gestión y calidad de datos; **ciencia datos**: ciencia de datos modelos predictivos inteligencia artificial aprendizaje automático estadística; **visualizacion**: visualización de datos reportes análisis de información; **seguridad datos**: administración de datos seguridad de la información; **consultoria analitica**: asesoría y consultoría en analítica de datos caracterización y diagnóstico con datos |
| Biología Ambiental | Ciencias, Ingeniería e Innovación | [enlace](https://www.unibague.edu.co/biologia) | **ciencias ambientales**: ciencias ambientales análisis de datos ambientales monitoreo; **conservacion**: conservación de biodiversidad fauna flora ecosistemas uso sostenible de recursos naturales; **bioeconomia**: bioeconomía bioproductos aprovechamiento sostenible; **gestion ambiental**: gestión y políticas ambientales planificación territorial corporaciones autónomas; **investigacion**: investigación ecológica inventario de especies |
| Arquitectura | Humanidades, Artes, Filosofía y Educación | [enlace](https://www.unibague.edu.co/arquitectura) | **proyecto arquitectonico**: diseño de proyectos arquitectónicos espacios habitables levantamiento arquitectónico planos; **urbanismo**: urbanismo espacio público movilidad ordenamiento territorial; **construccion gestion**: construcción y gestión de obras infraestructura comunitaria presupuesto; **territorio social**: arquitectura participativa vivienda patrimonio desarrollo social del territorio |
| Comunicación Social y Periodismo | Humanidades, Artes, Filosofía y Educación | [enlace](https://www.unibague.edu.co/comunicacionsocial/) | **periodismo contenidos**: periodismo producción de contenidos escritos radiales audiovisuales digitales y multimedia; **comunicacion organizacional**: comunicación organizacional comunicación institucional relaciones públicas; **cambio social**: comunicación para el cambio social participación ciudadana memoria; **investigacion**: investigación periodística y en comunicación narrativas del territorio |
| Diseño | Humanidades, Artes, Filosofía y Educación | [enlace](https://www.unibague.edu.co/diseno) | **comunicacion visual**: diseño para la comunicación visual identidad visual imagen institucional piezas gráficas; **producto**: diseño de producto prototipos nuevos productos y servicios; **innovacion**: identificación de oportunidades de diseño conceptualización innovación; **gestion diseno**: gestión de proyectos de diseño estrategia de implementación |
| Psicología | Humanidades, Artes, Filosofía y Educación | [enlace](https://www.unibague.edu.co/psicologia) | **psicosocial**: atención psicosocial a población vulnerable víctimas política pública; **educativa comunitaria**: programas educativos y comunitarios convivencia escolar intervención grupal; **organizacional**: psicología organizacional talento humano bienestar laboral clima organizacional; **clinica salud**: promoción prevención salud mental psicología clínica y de la salud |
| Administración Financiera | Programa anterior / cohortes vigentes | — | **finanzas**: gestión financiera presupuesto inversión crédito riesgo; **contable**: información contable costos tesorería |
| Ciencia Política | Programa anterior / cohortes vigentes | — | **politica publica**: políticas públicas gobierno gestión pública planeación; **participacion**: participación ciudadana construcción de paz análisis político |
| Fisioterapia (UAM) | Convenio con otra universidad | — | **rehabilitacion**: rehabilitación física actividad física salud; **adulto mayor**: bienestar del adulto mayor promoción de la salud |

## Alias registrados

| Escrito en la fuente | Programa |
|---|---|
| Adm Empresas | Administración de Empresas |
| Adm Negocios Internacionales | Administración de Negocios Internacionales |
| Admon Empresas | Administración de Empresas |
| Admon Negocios Internacionales | Administración de Negocios Internacionales |
| Analítica de Datos | Ingeniería en Analítica de Datos |
| Biología | Biología Ambiental |
| Ciencia Política Gobierno Relaciones Internacionales | Ciencia Política |
| Comunicación Social | Comunicación Social y Periodismo |
| Comunicación Social Periodismo | Comunicación Social y Periodismo |
| Contaduria Publica | Contaduría Pública |
| Contaduría | Contaduría Pública |
| Diseño Gráfico | Diseño |
| Diseño Industrial | Diseño |
| Fisioterapia | Fisioterapia (UAM) |
| Fisioterapia UAM | Fisioterapia (UAM) |
| Ing Civil | Ingeniería Civil |
| Ing Electrónica | Ingeniería Electrónica |
| Ing Industrial | Ingeniería Industrial |
| Ing Mecánica | Ingeniería Mecánica |
| Ing Sistemas | Ingeniería de Sistemas |
| Ing. de Sistemas | Ingeniería de Sistemas |
| Ingeniería Analítica de Datos | Ingeniería en Analítica de Datos |
| Ingeniería de Datos | Ingeniería en Analítica de Datos |
| Negocios Internacionales | Administración de Negocios Internacionales |
| Periodismo | Comunicación Social y Periodismo |
| Sistemas | Ingeniería de Sistemas |

## Cómo agregar un programa, alias o rama

1. Editar `PROGRAMS`, `_ALIASES_RAW` u `OCCUPATIONAL_BRANCHES` en `pyr_matching/programs.py` y subir `CATALOG_VERSION`.
2. Las ramas se escriben como frases cortas de vocabulario profesional (sin datos personales), una por campo de trabajo del perfil oficial.
3. Correr `python -m pytest -q tests/test_v032_programs_restrictions.py` y revisar la hoja `Normalizacion_Programas` de una corrida real.
4. Un alias nuevo cambia qué parejas pasan la restricción de perfil: debe aprobarlo la Coordinación (decisión D25 en `POLICY_DECISIONS.md`).
