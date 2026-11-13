# Auditoría de fuentes de datos — motor PyR (12-nov-2026)

**Alcance de lectura.** Acceso de solo lectura mediante el conector institucional de Google Drive/Sheets (cuenta `@estudiantesunibague.edu.co`). Se leyeron **metadatos, nombres de pestañas, la fila de encabezados** y, en tres columnas categóricas no personales, los **dominios de valores**. No se leyeron ni copiaron registros personales, salvo una fila de la pestaña `Morigen` que se devolvió por error al pedir el rango `1:2`; no se registró en ningún archivo, log ni salida. **Ningún libro fue modificado** (todas las operaciones fueron `get`/`read`). Este documento no contiene nombres, cédulas, códigos estudiantiles ni respuestas abiertas.

Leyenda de confianza: **ALTA** = observado directamente; **MEDIA** = observado parcialmente o inferido de encabezados; **BAJA** = solo reportado por terceros / captura de pantalla.

## 1. Inventario y procedencia

| # | Fuente (enlace) | Periodo | Propietario / compartido | Acceso | Pestañas relevantes observadas | Filas leídas | Confianza |
|---|---|---|---|---|---|---|---|
| 1 | [Preinscripción SPR 2025A (respuestas)](https://docs.google.com/spreadsheets/d/14aCNnWGNl_7pY6UZzV9Usjy5YudrbtzWsoUp8TzWP4A/edit) | 2025A | pazyregion@ · compartido 11-nov-2026 | Lectura | `Respuestas de formulario 1` | solo encabezado | ALTA (esquema) |
| 2 | [Preinscripción SPR 2025B (respuestas)](https://docs.google.com/spreadsheets/d/1NUcfTdXZNA_6ybXAb5CNs-lAX8jmobf4v0IR2_lyeBw/edit) | 2025B | compartido 11-nov-2026 | Lectura | `Respuestas de formulario 1` | solo encabezado | ALTA (esquema) |
| 3 | [Preinscripción SPR 2026A (respuestas)](https://docs.google.com/spreadsheets/d/1HB4w-vpSa-2uEVoyoyOkjRVdzoNrcWnYpYhGLoy47ko/edit) | 2026A | pazyregion@ · 11-nov-2026 | Lectura | `Respuestas de formulario 1` | solo encabezado | ALTA (esquema) |
| 4 | [Preinscripción SPR 2026B (respuestas)](https://docs.google.com/spreadsheets/d/15R5XpvVaLI_SsysyzmXhJpGDk-jKmXA7ggqfZjivCxs/edit) | 2026B | pazyregion@ · 11-nov-2026 | Lectura | `Respuestas de formulario 1` (grid 566 filas), `Respuestas de formulario 2` | solo encabezado | ALTA (esquema) |
| 5 | [Tablero Maestro 2025A](https://docs.google.com/spreadsheets/d/1d5pPRDi4KtIhEE_xt6TSdVYZrsN3U5CNSdhljw0U1fo/edit) | 2025A | unidad compartida · 11-nov-2026 | Lectura | 31 pestañas: `Proy Def`, `Estudiantes`, `Caso especial`, `Morigen`, `Asignación Directa SPR 2024A`, `Pre-inscripción`, `Proyectos Aprobados`, `Sorteo`… | solo nombres de pestañas | ALTA (pestañas) |
| 6 | [Tablero Maestro 2025B](https://docs.google.com/spreadsheets/d/1ZFAET5fZGngeB77L3v8qPUBImKcF7ausJzdipS0XpT0/edit) | 2025B | unidad compartida · 11-nov-2026 | Lectura | 31 pestañas: `ADenviada`, `Proy Def`, `Estudiantes`, `PstConv`, `Post Asignados`, `Caso especial`, `Morigen`… | solo nombres de pestañas | ALTA (pestañas) |
| 7 | [Tablero Maestro 2026A](https://docs.google.com/spreadsheets/d/1RO-ndHQlR4TPaDKczIpszuduQx9ozsEHZ6uRXFTHJkg/edit) | 2026A | unidad compartida · 11-nov-2026 | Lectura | 32 pestañas: `Proyectos`, `Estudiantes`, `PstConv`, `Caso especial`, `Morigen`, `Proyectos Aprobados`… | solo nombres de pestañas | ALTA (pestañas) |
| 8 | [Tablero Maestro 2026B](https://docs.google.com/spreadsheets/d/1-eeaqsTdhth-td4jHH7iR60RPa7y2YSiq5dP4pOjfqo/edit) | 2026B | unidad compartida · 11-nov-2026 | Lectura | 24 pestañas: `Estudiantes`, `Proyectos`, `Caso especial`, `Convoc`, `Morigen`, `BSIGA`, `Remanentes`, `Pre-inscripción`, `Proyapla`, `Proyecciones_2027A`… | encabezados + 3 columnas categóricas | ALTA |
| 9 | [Base de datos proyectos 2025A](https://docs.google.com/spreadsheets/d/10vKwkjnWFfnAZyNMxNBcr7My7jkmAMyEHSP6zMnWz6k/edit) | 2025A | unidad compartida · 11-nov-2026 | Lectura | `Base de datos`, `BD historica 2025A`, `Form Cierre`, `Ev`, `Preinscripción` | solo encabezado | ALTA (esquema) |
| 10 | [Base de datos proyectos 2025B](https://docs.google.com/spreadsheets/d/1oCd5Yq72IexPkPVypX-QyKiBXt-BWjw12hUbOfoqRBA/edit) | 2025B | unidad compartida · 11-nov-2026 | Lectura | `Base de datos`, `Ev`, `Form Proyectos` (encabezado `#REF!`), `Form Comprensión` | solo encabezado | ALTA (esquema) |
| 11 | [Base de datos proyectos 2026A](https://docs.google.com/spreadsheets/d/1UzCoRdc7dbidrC0lExkDbkolCgfUOu1V3o50qpGSkH4/edit) | 2026A | unidad compartida · 11-nov-2026 | Lectura | `Base de datos`, `Ev 1`, `Ev 2`, `Ev. Plazas`, `BD final`, `Consolidado BD Proyecto`, `Consolidado Plaza` | solo encabezado | ALTA (esquema) |
| 12 | [Base de datos proyectos 2026B](https://docs.google.com/spreadsheets/d/1jgSBOj6TIoWuydY_v9ZcjuVLJFC51qZdg5N_T0G9fMg/edit) | 2026B | pazyregion@ · 11-nov-2026 (modificado 12-nov) | Lectura | `Base de datos` (grid 644×55), `Ev. Plazas`, `Consolidado BD Proyecto`, `Consolidado Plaza`, `Ev 1`, `Ev 2` | solo encabezado | ALTA (esquema) |
| 13 | [Formulario de Presentación Perfiles para Asignación por Convocatoria PyR Semestre B 2026 (respuestas)](https://docs.google.com/spreadsheets/d/1gN2LqYQNJwQbllFAY3oIQFut3SVniX_IqyTo8CBDXyc/edit) | 2026B | otro remitente · 11-nov-2026 | Lectura | `Respuestas de formulario 1` (grid 214 filas) | encabezado + dominio de `6. Modalidad` | ALTA |
| P1 | [Proceso Gestión de plazas y asignación SPR (1).xlsx](https://docs.google.com/spreadsheets/d/1raH91yX683c97DXBOCPl_UUlyhNHYvIy/edit) | proceso | Drive | Accesible (metadatos) | — | no releído en esta sesión | MEDIA |
| P2 | [Modelado AS-IS … MODIFICADO COR ACADEMICA.pdf](https://drive.google.com/file/d/1B0LotdJzvcPdumzylgK5RURLzlWYe1Pa/view) | proceso | Drive | **Leído** | — | texto completo (sin datos personales) | ALTA |
| P3 | [Modelado AS-IS Asignación de Plazas PyR.pdf](https://drive.google.com/file/d/1HIXC6pNxiVYSprPJF1rOGGrbH82M4p3_/view) | proceso | Drive | no leído en esta sesión | — | — | BAJA (solo brief) |
| P4 | [Informe Analisis ASIS PyR.pdf](https://drive.google.com/file/d/1mGj3eELE-r01WbitDGsDa-6IQ6OtdnZP/view) | proceso | Drive | no leído en esta sesión | — | — | BAJA (solo brief) |
| P5 | [ASIGNACIÓN 2026B](https://docs.google.com/spreadsheets/d/1a1mQXONetsB4ordEJEhxwZQysAva-qNhXtzUFcE2a-s/edit) (mod. 1-ago-2026) | 2026B (histórico) | Drive | Accesible (metadatos) | — | no releído (el brief reporta 5 columnas y ≥259 filas) | MEDIA |

## 2. Esquemas observados (encabezados) y comparación entre periodos

### 2.1 Preinscripción estudiantil (2025A, 2025B, 2026A, 2026B)
Esquema prácticamente idéntico en los 4 periodos (solo cambia el texto de la pregunta intersemestral y, en 2026B, se añaden columnas de acudiente/contacto de emergencia):

`Marca temporal`, `Dirección de correo electrónico`, `Código estudiantil`, `Número de Cédula`, `Primer apellido`, `Segundo apellido`, `Nombre`, `Fecha de Nacimiento`, `Dirección`, `Ciudad de residencia permanente…`, `Número de celular`, `Teléfono fijo`, `Correo electrónico personal`, `Sexo`, `Nombre de la EPS…`, `¿Ya cursó… el Seminario Paz y Región?`, `¿Planea cursar seminario… intersemestral…?`, **`¿Qué expectativas tiene frente a su semestre Paz y Región?`**, **`¿Qué aprendizajes espera lograr…?`**, `Autorizo expresamente…` (habeas data), [2026B] `Nombre de acudiente…`, `Teléfono de contacto de acudiente…`.

**Hallazgo crítico (ALTA):** ningún periodo histórico tiene habilidades, intereses, trabajo deseado ni preferencias de modalidad. La única evidencia profesional del estudiante son **dos respuestas abiertas** (expectativas y aprendizajes). Esto **confirma por observación** que dichas variables no existen históricamente (coherente con el plan reportado de recogerlas desde 2027). El programa académico no está en la preinscripción: se obtiene del Tablero Maestro (`Estudiantes.Programa`).

### 2.2 Tablero Maestro 2026B — pestañas clave
- `Estudiantes` (grid 522×40): `Categoría`, `Programa`, `Nombre`, `Código`, `CC`, `Correo`, `Matricula`, `Preinscripción`, `Tipo Asignación`, `Asignado`, `Caso Especial`, `Coter`, `Modal Coterm`, `Convoc`, `Municipio origen`, `Municipio asignar`, `Proyecto Investigación`, `Asignación (M)`, `Motivo`, `RESPUESTA CE`, `TIPO DE CASO`, `MUNICIPIO CE`, `HORARIO CE`, `JUSTIFICACIÓN CE`, `OBSERVACIÓN CE`, `OBSERVACIÓN`, `ARL tramitada`, `Grupo Inicial`, `Grupo Actual`, `Control grupos`, `asign SIGA`, `Conteo Matriculados`, `Asignado Gen`.
  - Dominio observado de `Tipo Asignación`: {`SIGA`, `DIRECTA`}; 521 filas con valor (J2:J522). Distribución no calculada.
- `Proyectos` (grid 368×46): `Gestionó`, `Estado`, `Tipo de plaza`, `Perfil`, `Perfil (aternativo)`, `Nombre de la Organización`, `Tipo de organización`, `Departamento`, `Municipio`, `Tipo gestión`, contacto de la organización (3 columnas), `Estado del convenio`, `Nombre del Proyecto`, `Descripción del proyecto`, `Línea de proyecto`, `Modalidad del Proyecto`, `Descripción Modalidad semipresencial`, `Nivel de riesgo ARL`, `Observación`, `GRUPO SIGA`, 3 bloques repetidos `Nombre/Código/Cédula`, `Control SIGA`, …, `Caso Especial`, `Tipo de caso`, `Horario Aprobado`, `Coterminal`, `Aprobados`, `Asignación Directa`, `SIGA`.
  - Dominio de `Estado` (B2:B368, 367 filas): {`Aprobada`}.
  - Dominio de `Tipo de plaza`: {`Normal`, `Convocatoria`, `Convocatoria Unibagué`, `Municipio de origen`, `Caso especial`} + 1 vacío.
  - **No se observó una columna de ID de plaza ni de cupos**: cada fila parece una plaza con hasta 3 bloques de estudiante. → *Bloqueo B2*.
- `Convoc`: `Código de convocatoria`, `Municipio`, `Organización`, `Programa Académico`, `Nombre completo`, `Código estudiantil`, `Número de identificación (CC)`, `Seleccionado`, `En base`, `Matriculado`, `Coterminal`, `Caso Especial`.
- `Morigen`: `Nombre completo`, `Código estudiantil`, `Identificación (CC)`, `Programa académico`, `Municipio de residencia (donde solicita realizar Paz y Región)`, `Departamento`, `En base`, `Matriculado`, `Coterminal`. *(No incluye columna explícita de aprobación.)*
- `Caso especial`: fila 1 con encabezados parciales (`RESPUESTA DEFINITIVA`, `MUNICIPIO`, `HORARIO`, `JUSTIFICACIÓN SEGUNDA RESPUESTA`, `OBSERVACIÓN`, `En BASE`, `Matriculado`, `Convocatoria`, `M. Origen`, …); el resto de encabezados no está en la fila 1 (posible encabezado multi-fila). Contiene justificaciones sensibles: **no se usa** como característica.
- `BSIGA`: `Programa`, `SIGA`, `Ubicados`, `Por Ubicar` (oferta SIGA agregada por programa → evidencia de que las plazas SIGA se organizan por programa).
- `Remanentes`: avance académico (`Total Unidades…`, `Habilitado para A2027`) — potencial fuente de elegibilidad futura.

### 2.3 Base de datos proyectos (por periodo)
| Campo | 2025A | 2025B | 2026A | 2026B |
|---|---|---|---|---|
| Programa Académico | ✓ | ✓ | ✓ | ✓ |
| Nombre/Tipo de organización | ✓ | ✓ | ✓ | ✓ |
| Departamento / Municipio | ✓ | ✓ | ✓ | ✓ |
| Nombre / Descripción / Línea del proyecto | ✓ | ✓ | ✓ | ✓ |
| Modalidad (+ descripción semipresencial) | ✓ | ✓ | ✓ | ✓ |
| Caso Especial / Tipo de caso / Horario aprobado | ✓ | ✓ | ✓ | ✓ |
| `Asignación` | — | ✓ | ✓ | ✓ |
| Universidad / Facultad / Sexo | — | — | ✓ | ✓ |
| Formularios de valoración de la experiencia | Form Cierre | VALORACIÓN EXP | Feb/May | Ago/Nov |

En 2026A/2026B existen además `Ev. Plazas` y `Consolidado Plaza`: valoraciones de la plaza por asesor (`Comunicación con el interlocutor`, `Garantías logísticas`, `Potencial formativo`, `Involucramiento`, `Interdisciplinariedad`, `Puntaje Total`) y por estudiante (`Acompañamiento`, `Clima org`, `Pertinencia`, `Puntaje Total Est`), y `Consolidado BD Proyecto` con `ODS`, `Código del proyecto`, `Clasificación resultados`, `Concepto`. Son **señales de resultado** sobre la calidad de la plaza/organización, no juicios de idoneidad estudiante↔plaza. Conteos no leídos.

### 2.4 Formulario de organizaciones (convocatoria) 2026B
`Marca temporal`, `1. Perfil Programa Académico`, `1.1 Perfil Programa Académico Alternativo`, `2. Nombre de la Organización`, `3. Ubicación y Dirección…`, `4. Número de Estudiantes Requeridos`, **`5. Descripción general de las actividades…`**, `6. Modalidad`, `6.1 Descripción de la Modalidad Semipresencial`, **`7. Requisitos (académicos, habilidades, conocimientos…)`**, **`8. Compromisos…`**, `9. Otra Información complementaria`, `10. Asesor(a) Regional…`. Dominio de `6. Modalidad`: {`Presencial – Asiste…toda la semana`, `Semipresencial – Asiste en algunas jornadas`}; **no se observó modalidad remota**.

## 3. Verificación de afirmaciones del brief

| Afirmación | Estado | Evidencia |
|---|---|---|
| Habilidades/preferencias/aspiraciones de estudiantes no existen históricamente | **Confirmada (ALTA)** | Esquema de preinscripción 2025A–2026B (§2.1). Solo existen expectativas y aprendizajes esperados. |
| Solo en 2026B se preguntó más a organizaciones | **Parcialmente confirmada (MEDIA)** | Formulario detallado observado solo para 2026B y **acotado a "Asignación por Convocatoria"**, no a todas las organizaciones. 2025B tiene `Form Proyectos` con encabezado roto (`#REF!`). |
| Plazas tienen perfil por programa | **Confirmada (ALTA)** | `Proyectos.Perfil` / `Perfil (aternativo)`; AS-IS: "Definir perfil académico requerido"; `BSIGA` por programa. |
| Tipos de directa: caso especial, municipio de origen, convocatoria | **Confirmada (ALTA)** | `Tipo de plaza` y AS-IS. |
| Remoto como categoría | **No observada** | Solo Presencial/Semipresencial. El motor no inventa "remoto". |

## 4. Diccionario canónico ↔ fuentes observadas

| Campo canónico | Fuente observada (2026B) | Uso | Disponibilidad histórica |
|---|---|---|---|
| `student_id` | `Código` / `Código estudiantil` | solo unión | ALTA |
| `academic_program` | `Estudiantes.Programa` | regla dura + componente `program` | ALTA |
| `origin_municipality` | `Municipio origen` / `Ciudad de residencia permanente` | componente blando informativo | MEDIA |
| `expectations_text`, `learning_goals_text` | preguntas abiertas de preinscripción | componente `semantic`/`lexical` | ALTA (4 periodos) |
| `skills_text`, `interests_text`, `desired_work_text` | — | futuras (2027) | **NO EXISTE** |
| `vacancy_id`, `capacity` | — (no observadas en `Proyectos`) | unión, cupos | **BLOQUEO B2** |
| `status`, `vacancy_type` | `Estado`, `Tipo de plaza` | reglas duras | ALTA |
| `program_profile(_alt)` | `Perfil`, `Perfil (aternativo)` | regla dura | ALTA |
| `project_name/description/line` | `Nombre/Descripción/Línea del proyecto` | semántico | ALTA |
| `municipality`, `modality` | `Municipio`, `Modalidad del Proyecto` | restricciones aprobadas | ALTA |
| `requirements_text`, `activities_text` | Formulario convocatoria 2026B (7, 5) | semántico/skills | Solo 2026B convocatoria |
| `direct_type`, `approval_status`, `approved_municipality` | `TIPO DE CASO`, `RESPUESTA CE`/`RESPUESTA DEFINITIVA`, `MUNICIPIO CE`, `Morigen`, `Convoc.Seleccionado` | decisiones directas | MEDIA — dominios no leídos (sensibles) |
| SIGA confirmada | `asign SIGA`, `Proyectos.SIGA` | conciliación | MEDIA |

**Columnas excluidas por diseño** (nunca se leen como característica ni se exportan): cédula, nombres/apellidos, correo, celular, teléfono, dirección, fecha de nacimiento, sexo, EPS, contacto de emergencia, justificación/observación/horario de caso especial, ARL.

## 5. Bloqueos y pendientes
- **B1** — La Universidad debe entregar (o aprobar) un libro limpio con las hojas del contrato canónico (`docs/../matching_engine/docs/EXCEL_CONTRACT.md`); el Tablero mezcla operación, datos personales y tablas dinámicas en una misma hoja.
- **B2** — Falta identificador estable de plaza y número de cupos en `Proyectos` (2026B). Sin ellos no hay unión ni control de capacidad confiables.
- **B3** — Dominios de valores de aprobación de casos especiales/municipio de origen/convocatoria no leídos (contienen datos sensibles): mapeo de `RESPUESTA CE` → `APROBADO/PENDIENTE/RECHAZADO` pendiente de confirmación institucional.
- **B4** — No existen etiquetas validadas de idoneidad. Las valoraciones `Ev. Plazas` podrían ser señal de resultado (calidad de plaza), previa validación; no se usan para entrenar.
- **B5** — P3, P4 y P5 no se releyeron en esta sesión.
- Ningún dato institucional fue copiado al repositorio; todas las pruebas usan datos sintéticos.

## 6. Adenda 12-nov-2026 (v0.3) — verificación de encabezados por periodo
Lectura de solo lectura, **solo fila 1**, vía conector Google Sheets: `Estudiantes` y `Proy Def` (Tablero 2025A y 2025B), `Estudiantes` y `Proyectos` (Tablero 2026A y 2026B), `Respuestas de formulario 1` (Preinscripción 2025A y 2026B), `Ev. Plazas` (BD proyectos 2026A). Hallazgos:
- `Proyectos`/`Proy Def` tienen la misma estructura en los 4 periodos: una fila por plaza con bloques repetidos `Nombre/Código/Cédula` (estudiantes ubicados) y `Tipo asignación`; 2026A/2026B añaden `Aprobados` (semántica sin confirmar). Sigue sin existir `ID_Plaza` ni `Cupos` (B2).
- `Estudiantes` 2025A/2025B tienen **dos** columnas `Municipio origen` (se usa la primera).
- `Ev. Plazas` es una evaluación por estudiante-plaza (asesor y estudiante, con `Puntaje Total` doble): señal de calidad POST-ubicación, no de idoneidad (D14).
- **Incidente de minimización**: la lectura del encabezado de `Ev. Plazas` usó el rango `1:2` y devolvió una fila con datos personales de un estudiante. No se registró en ningún archivo, log, prueba ni salida; desde entonces solo se leyó la fila 1. Recomendación: compartir con el equipo exportaciones con solo encabezados, o vistas sin columnas identificatorias.
- No se leyeron registros: el histórico canónico se construye localmente desde exportaciones institucionales con `pyr-match historical-build` (ver `matching_engine/docs/HISTORICAL_DATA.md`). **No se calcularon coberturas ni métricas sobre datos reales.**
