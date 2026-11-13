# Histórico canónico (Fase 2) — `pyr-match historical-build`

Reconstruye, de forma reproducible y seudonimizada, los conjuntos lógicos históricos a partir de **exportaciones Excel locales** de los libros institucionales (Tablero Maestro, preinscripción, base de datos de proyectos, cuestionario de convocatoria). El motor **no** descarga datos personales desde Google Drive: la institución exporta los libros a una carpeta institucional fuera de git y los referencia en un manifiesto.

## Conjuntos producidos (`historico_canonico.xlsx` / `.json`)

| Hoja | Contenido | Momento | Uso permitido |
|---|---|---|---|
| `ESTUDIANTES_PRE_ASIGNACION` | ID seudónimo, periodo, programa, municipio de origen, expectativas, aprendizajes (y habilidades/intereses si algún día existen) | PRE | Características |
| `PLAZAS_PRE_ASIGNACION` | ID de plaza estable, organización/proyecto (IDs hash), descripción, línea, perfil y alterno, municipio, modalidad, tipo, estado, requisitos/actividades (solo convocatoria 2026B), cupo **solo si** se autoriza un modo de reconstrucción | PRE | Características / restricciones |
| `ASIGNACIONES_OBSERVADAS` | estudiante, plaza, periodo, mecanismo (`SIGA`, `DIRECTA_<tipo>`, `DESCONOCIDO`), relación con el perfil, conflictos | POST | Evaluación y pista A (comportamiento). **Nunca** etiqueta de idoneidad |
| `RETROALIMENTACION_CALIDAD` | `Ev. Plazas` (puntaje asesor y estudiante normalizado), fuente, fecha | POST | Ninguno hasta aprobación (D14): `NO_VALIDADA_COMO_IDONEIDAD` |
| `COBERTURA_CAMPOS` | cobertura por entidad/periodo/campo (`COMPLETO`/`PARCIAL`/`NO_EXISTE_EN_FUENTE`) | — | Auditoría |
| `PROBLEMAS_CALIDAD_DATOS` | duplicados, uniones fallidas, conflictos históricos (solo códigos/IDs) | — | Auditoría |
| `PROCEDENCIA` | archivo, hoja, SHA-256, filas, columnas leídas | — | Auditoría |

`reporte_cobertura.md` resume mecanismos, cobertura y problemas.

## Manifiesto

```json
{
  "capacity_mode": "none",
  "sources": [
    {"kind": "tablero_estudiantes", "period": "2026B", "path": "Tablero_Maestro_2026B.xlsx"},
    {"kind": "tablero_plazas",      "period": "2026B", "path": "Tablero_Maestro_2026B.xlsx"},
    {"kind": "preinscripcion",      "period": "2026B", "path": "Preinscripcion_2026B.xlsx"},
    {"kind": "evaluacion_plazas",   "period": "2026B", "path": "BD_proyectos_2026B.xlsx"},
    {"kind": "convocatoria_organizaciones", "period": "2026B", "path": "Convocatoria_2026B.xlsx"}
  ]
}
```
Hojas por defecto: `Estudiantes`; `Proyectos` o `Proy Def`; `Respuestas de formulario 1`; `Ev. Plazas`. Se puede fijar `"sheet"` y `"header_row"` por fuente. Rutas relativas al manifiesto.

## Ejecutar

```bash
set PYR_PSEUDONYM_KEY=<clave secreta institucional, >=16 caracteres, fuera de git>
.venv/Scripts/pyr-match historical-build --manifest D:/pyr_privado/manifest.json --out-dir D:/pyr_privado/historico --export-engine-period 2026B
```
Demostración 100 % sintética (formatos institucionales, contenido falso):
```bash
.venv/Scripts/pyr-match make-historical-sample --out-dir D:/tmp/pyr_sintetico
```

## Reglas de integridad y privacidad (implementadas y probadas)

- **Solo columnas configuradas** (`pyr_matching/config/historical_sources_tablero.json`, encabezados verificados el 12-nov-2026). Un guardia rechaza configuraciones que apunten a cédula, nombre, correo, celular, dirección, sexo, EPS, acudiente, asesor(a), observaciones, justificaciones o tipo/respuesta de caso especial.
- **Seudonimización HMAC-SHA256** con clave secreta: IDs estables entre periodos y ejecuciones; sin la clave no se pueden revertir ni regenerar. La clave nunca se escribe; solo su huella.
- **Escritura fuera de git**: se rechaza escribir dentro de un repositorio salvo ruta ignorada por git.
- **Duplicados**: preinscripción repetida → se conserva la respuesta más reciente (`PREINSCRIPCION_DUPLICADA`); estudiante repetido con programa distinto → `ESTUDIANTE_DUPLICADO_CONFLICTIVO`; archivo idéntico cargado dos veces → ignorado y reportado; estudiante en dos plazas → `ASIGNACION_MULTIPLE` (se conserva y marca).
- **Integridad referencial**: `ASIGNACION_SIN_ESTUDIANTE`, `PREINSCRIPCION_SIN_ESTUDIANTE_EN_TABLERO`, `EVALUACION_SIN_UNION`, `CONVOCATORIA_SIN_PLAZA`.
- **Conflictos históricos** (`ASIGNACION_HISTORICA_FUERA_DE_PERFIL`, `SOBRECUPO_HISTORICO`) se reportan, no se corrigen.
- **Fuga de información**: `FIELD_TIMING` clasifica cada campo como PRE/POST; `to_input_bundle` solo copia campos PRE. Asignaciones y evaluaciones nunca llegan a características.
- **Cupos**: `capacity_mode` = `none` (defecto, no se inventan cupos) · `approved_column` (columna `Aprobados`, semántica sin confirmar) · `row_count` (filas por plaza) · `observed_count` (cota inferior). Todo modo distinto de `none` queda `RECONSTRUIDA_NO_VERIFICADA_INSTITUCIONALMENTE` (bloqueo B2).

## Identificador de plaza

No existe `ID_Plaza` en las fuentes (B2). Se deriva `P<periodo>-<hash>` de (periodo, organización, proyecto, municipio, tipo, perfil). Filas con la misma clave se tratan como asientos de la misma plaza; filas con textos inconsistentes se reportan (`PLAZA_FILAS_INCONSISTENTES`). Organización (`O-…`) y proyecto (`PR-…`) tienen IDs estables entre periodos.

## Limitaciones conocidas

- Habilidades, intereses, trabajo deseado y modalidad preferida **no existen** en 2025A–2026B (cobertura `NO_EXISTE_EN_FUENTE`).
- El significado de los tres bloques `Nombre/Código/Cédula` por fila de `Proyectos` no está documentado; se interpretan como estudiantes ubicados en esa fila.
- Requisitos/actividades solo existen para convocatoria 2026B y se unen por nombre de organización (coincidencia exacta normalizada).
- Los estados de aprobación de casos especiales no se reconstruyen (B3, datos sensibles): el histórico no produce `Decisiones_Directas`.
