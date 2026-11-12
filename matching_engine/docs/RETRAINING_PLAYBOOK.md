# Reentrenamiento (opt-in)

**Estado actual: no entrenado.** No existen etiquetas institucionales de idoneidad. El motor funciona con la línea base explicable.

## Cuándo entrenar
Solo cuando la Universidad entregue juicios **validados** sobre parejas estudiante–plaza:
- `REVISION_EXPERTA_PAR`: un revisor institucional califica la idoneidad de la pareja (0–1), idealmente antes de conocer el resultado;
- `EVALUACION_RESULTADO_VALIDADA`: resultado de la experiencia (p. ej. valoración final) aprobado como indicador de ajuste estudiante–plaza.

No son etiquetas: asignaciones históricas, matrículas SIGA, ubicaciones por convocatoria o caso especial (sesgo de selección y restricciones). El comando las rechaza.

Mínimos por defecto (política `training`): 200 parejas utilizables, 20 positivas, ≥ 2 periodos, ambas clases en entrenamiento y prueba.

## Preparar
Hoja `Etiquetas` (`ID_Estudiante`, `ID_Plaza`, `Periodo`, `Etiqueta`, `Fuente_Etiqueta`) + libros `Estudiantes`/`Plazas` de **todos** los periodos etiquetados (con el mismo mapeo). Mantener los archivos fuera de git (p. ej. carpeta institucional cifrada).

## Entrenar
```bash
.venv/Scripts/pyr-match train --inputs datos/estudiantes_plazas_2026A_2027A.xlsx --period 2027A --labels datos/etiquetas_validadas.xlsx --registry D:/pyr_registry
```
(`--period` es obligatorio por la interfaz común; la partición usa los periodos de las etiquetas.)

Qué hace: une etiquetas con insumos; descarta parejas bloqueadas por reglas duras; calcula componentes `hybrid-pyr-v0.2` + indicadores de disponibilidad; **partición temporal** (periodos anteriores → entrenamiento, último → prueba); regresión logística L2 con semilla fija; métricas en prueba (AUC, log-loss, precision@k, recall@k, NDCG@k) para modelo y línea base; brecha train−test (sobreajuste); auditoría de fuga (estudiantes/plazas compartidos); auditoría de equidad por programa y municipio; tasa de violación de restricciones (0 por construcción).

Salida: `<registry>/<model_id>/model.json` con versión del motor, esquema de características, huellas de política y dataset (sin datos crudos), hiperparámetros, semilla, métricas, comando y fuentes de etiquetas. Se **activa solo si supera a la línea base** (`promotion_min_auc_delta`); si no, queda `RECHAZADO_NO_SUPERA_LINEA_BASE`.

Exit 3 = `NO_ENTRENABLE` con motivos (`NO_HAY_ETIQUETAS`, `FUENTE_NO_ACEPTADA`, `POCAS_ETIQUETAS`, `POCOS_POSITIVOS`, `POCOS_PERIODOS`, `UNA_SOLA_CLASE_EN_*`).

## Usar, auditar, revertir
```bash
.venv/Scripts/pyr-match match --inputs insumo.xlsx --period 2027B --out res.xlsx --registry D:/pyr_registry
```
```bash
.venv/Scripts/pyr-match registry --registry D:/pyr_registry list
```
```bash
.venv/Scripts/pyr-match registry --registry D:/pyr_registry rollback-to-baseline
```
`activate --model-id <id>` reactiva un modelo anterior. El modelo solo re-puntúa parejas permitidas; `Resumen_Ejecucion.version_algoritmo` muestra `hybrid-pyr-v0.2+<model_id>`.

## Antes de promover a producción
Revisar con la Coordinación: métricas vs línea base, brecha de sobreajuste, auditoría por programa/municipio, tamaño del periodo de prueba, y que las etiquetas no provengan de un solo semestre (no sobreajustar 2026B).
