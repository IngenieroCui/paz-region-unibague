# Contrato Excel (entrada y salida) — `pyr-match-result/1.0`

Los nombres de hoja/columna de abajo son el **contrato canónico**. Los encabezados institucionales reales se adaptan con un archivo de mapeo (`--mapping`), sin tocar el código. Coincidencia de encabezados insensible a mayúsculas, tildes y espacios. Las uniones usan **solo IDs**, nunca el orden de filas ni nombres. Columnas no mapeadas se ignoran y nunca se leen.

## Entrada

### `Estudiantes` (obligatoria)
| Columna | Obligatoria | Tipo | Notas |
|---|---|---|---|
| `ID_Estudiante` | sí | texto | Llave de unión (se recomienda código estudiantil o seudónimo, no cédula). Único por periodo. |
| `Periodo` | sí | texto | p. ej. `2027A`. Filas de otros periodos se ignoran (advertencia). |
| `Programa` | sí | texto | Programa académico; se compara con el perfil de la plaza. |
| `Municipio_Origen` | no | texto | Componente blando informativo. |
| `Habilitado` | no | SI/NO | Por defecto SI (insumo ya validado). |
| `Expectativas`, `Aprendizajes_Esperados` | no | texto | Respuestas de preinscripción (existen 2025A–2026B). |
| `Habilidades`, `Intereses`, `Trabajo_Deseado`, `Modalidad_Preferida` | no | texto | A recolectar desde 2027. Vacío = **desconocido**, nunca cero. |

### `Plazas` (obligatoria)
| Columna | Oblig. | Notas |
|---|---|---|
| `ID_Plaza` | sí | Único por periodo (**hoy no existe en el Tablero: bloqueo B2**). |
| `Periodo`, `Cupos` (entero ≥ 0), `Estado`, `Tipo_Plaza` | sí | `Estado` habilitado por política: `Aprobada`. `Tipo_Plaza`: `Normal`, `Municipio de origen`, `Caso especial`, `Convocatoria`, `Convocatoria Unibagué`. |
| `Perfil_Programa`, `Perfil_Programa_Alterno` | no | Regla dura de programa (si la política lo indica). |
| `Municipio`, `Modalidad` | no | `Presencial…`/`Semipresencial…` se normalizan a `PRESENCIAL`/`SEMIPRESENCIAL`. |
| `ID_Proyecto`, `Nombre_Proyecto`, `Descripcion_Proyecto`, `Linea_Proyecto`, `ID_Organizacion`, `Nombre_Organizacion`, `Departamento`, `Actividades`, `Requisitos`, `Necesidades_Organizacion`, `Codigo_Convocatoria` | no | Texto profesional para NLP; descriptivos para la salida. |

### `Decisiones_Directas` (opcional) — decisiones **institucionales** ya tomadas
| Columna | Oblig. | Valores |
|---|---|---|
| `ID_Estudiante`, `Periodo` | sí | Una fila por estudiante y periodo. |
| `Tipo_Directa` | sí | `Caso especial` · `Municipio de origen` (alias `Paz y Región en tu territorio`) · `Convocatoria` |
| `Estado_Aprobacion` | sí* | `Aprobado` · `Pendiente` · `Rechazado`. Vacío/otro ⇒ `PENDIENTE_APROBACION_INSTITUCIONAL` (nunca se asume aprobado). |
| `ID_Plaza_Confirmada` | no | Plaza aprobada/seleccionada. Obligatoria para `Convocatoria`. |
| `Ubicacion_Confirmada` | no | `SI` ⇒ ubicación congelada (`CONFIRMADA_FIJA`). |
| `Municipio_Aprobado` | no | Restricción territorial **dura** (obligatoria para `Municipio de origen`). |
| `Modalidades_Aprobadas` | no | Lista separada por comas; restricción **dura**. |
| `Codigo_Convocatoria` | no | Trazabilidad. |

Nunca incluir justificaciones, diagnósticos ni documentos de soporte de casos especiales.

### `Matriculas_SIGA` (opcional en `match`; usada en `reconcile`)
`ID_Estudiante`, `ID_Plaza`, `Periodo`, `Estado` (`Matriculado`/`Confirmado`/`Inscrito` activos). Ocupan cupo y excluyen al estudiante de recomendaciones.

### `Etiquetas` (solo `train`)
`ID_Estudiante`, `ID_Plaza`, `Periodo`, `Etiqueta` (0–1; ≥ 0.5 positivo), `Fuente_Etiqueta` (`REVISION_EXPERTA_PAR` o `EVALUACION_RESULTADO_VALIDADA`). `ASIGNACION_HISTORICA` y `MATRICULA_SIGA` se rechazan.

### Validación (bloqueante, código de salida 2)
`ID_DUPLICADO`, `CUPOS_INVALIDOS`, `DECISION_DIRECTA_DUPLICADA`, `DECISION_SIN_ESTUDIANTE`, `MATRICULA_DUPLICADA`, `MATRICULA_PLAZA_INEXISTENTE`, `MATRICULA_SIN_ESTUDIANTE`, `SIN_ESTUDIANTES_EN_PERIODO`, `SIN_PLAZAS_EN_PERIODO`, columnas obligatorias faltantes, mapeo que apunte a columnas sensibles. Los mensajes solo contienen códigos, hoja, fila e ID.

## Salida (`pyr-match match --out`)
| Hoja | ¿Asignación real? | Contenido |
|---|---|---|
| `Asignaciones_Directas` | `CONFIRMADA_FIJA` = **sí** (institucional); `PROPUESTA_REQUIERE_APROBACION` = **no** | ID estudiante/plaza, datos de plaza, tipo de directa, compatibilidad, cobertura, confianza, verificación de reglas, explicación |
| `Recomendaciones_SIGA` | **no** (`RECOMENDACION_NO_VINCULANTE`) | top-K por estudiante, rango, cupos restantes al ejecutar, sobre umbral, explicación |
| `Plazas_Disponibles` | — | cupos originales, ocupados por directa confirmada / SIGA, reservados por propuestas, restantes, publicable SIGA |
| `Sin_Asignacion` | — | `REQUIERE_GESTION_HUMANA`, `PENDIENTE_APROBACION_INSTITUCIONAL`, `SIN_RECOMENDACION` + código y siguiente paso |
| `Idoneidad_Por_Plaza` | **no** | top-N estudiantes electivos por plaza (informativo) |
| `Simulacion_No_Vinculante` | **no** | solo con `--simulate` |
| `Pares_Evaluados` | — | desglose por componente, pesos efectivos, bloqueos (`--pairs none|top|all`) |
| `Resumen_Ejecucion` | — | periodo, fecha UTC, versiones (motor, algoritmo, política+huella, esquema, backend semántico, modelo), conteos, coberturas, advertencias, SHA-256 de insumos |
| `Diccionario_Salida` | — | significado y valores de cada columna |

Códigos de `Sin_Asignacion.codigo_motivo`: `DECISION_PENDIENTE`, `ESTADO_APROBACION_DESCONOCIDO`, `TIPO_DIRECTA_DESCONOCIDO`, `DOBLE_ASIGNACION_DIRECTA_Y_SIGA`, `PLAZA_CONFIRMADA_INEXISTENTE`, `PLAZA_OBJETIVO_INEXISTENTE`, `CONVOCATORIA_SIN_PLAZA_SELECCIONADA`, `MUNICIPIO_APROBADO_FALTANTE`, `SIN_PLAZA_COMPATIBLE_CON_RESTRICCIONES_APROBADAS`, `CUPOS_AGOTADOS_ENTRE_DIRECTAS`, `SIN_OPCIONES_ELEGIBLES`, `ESTUDIANTE_NO_HABILITADO`.

Bloqueos de pareja (`Pares_Evaluados.bloqueos`, detalle de `Sin_Asignacion`): `PERIODO_DISTINTO`, `PLAZA_NO_APROBADA`, `TIPO_PLAZA_NO_HABILITADO`, `PROGRAMA_NO_COMPATIBLE`, `PROGRAMA_NO_VERIFICABLE`, `MUNICIPIO_RESTRINGIDO`, `MUNICIPIO_NO_VERIFICABLE`, `MODALIDAD_RESTRINGIDA`, `MODALIDAD_NO_VERIFICABLE`, `ESTUDIANTE_NO_HABILITADO`, `SIN_CUPO`.

Orden determinista: directas por (estado, estudiante); recomendaciones por estudiante y rango (empates por ID de plaza); idoneidad por plaza, puntaje, cobertura, estudiante.

## Conciliación (`pyr-match reconcile`)
`Conciliacion_SIGA` (`CONFIRMADA_SIGA` / `REVISION_HUMANA` / `NO_ACTIVA` + alertas `DOBLE_MATRICULA`, `DOBLE_ASIGNACION_CON_DIRECTA`, `PLAZA_NO_PUBLICABLE_SIGA`, `PROGRAMA_FUERA_DE_PERFIL`, `SOBRECUPO_PLAZA`, `PLAZA_NO_ENCONTRADA`, `ESTUDIANTE_NO_ENCONTRADO`; rango de la plaza elegida en las recomendaciones previas), `Plazas_Conciliadas`, `Estudiantes_Sin_Ubicacion`. Las matrículas son hechos institucionales: se marcan, no se mueven.
