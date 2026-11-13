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

Salida: `<registry>/<model_id>/model.json` con versión del motor, esquema de características, huellas de política y dataset (sin datos crudos), hiperparámetros, semilla, métricas, comando y fuentes de etiquetas.

**v0.3: el entrenamiento nunca activa un modelo** (salvo `training.auto_activate=true` explícito en la política). El candidato queda `PROMOVIBLE` solo si: supera a la línea base (`promotion_min_auc_delta`), supera al modelo activo compatible, no degrada ningún subgrupo de programa/municipio más de `max_subgroup_auc_drop` y la prueba tiene al menos `min_test_labels` parejas. En otro caso: `RECHAZADO_NO_SUPERA_LINEA_BASE`, `RECHAZADO_NO_SUPERA_MODELO_ACTIVO`, `RECHAZADO_DEGRADA_SUBGRUPO` o `RECHAZADO_PRUEBA_INSUFICIENTE`.

Exit 3 = `NO_ENTRENABLE` con motivos (`NO_HAY_ETIQUETAS`, `FUENTE_NO_ACEPTADA`, `POCAS_ETIQUETAS`, `POCOS_POSITIVOS`, `POCOS_PERIODOS`, `UNA_SOLA_CLASE_EN_*`).

## Usar, auditar, revertir
```bash
.venv/Scripts/pyr-match match --inputs insumo.xlsx --period 2027B --out res.xlsx --registry D:/pyr_registry
```
```bash
.venv/Scripts/pyr-match registry --registry D:/pyr_registry list
```
```bash
.venv/Scripts/pyr-match registry --registry D:/pyr_registry check --model-id <id> --policy pyr_matching/config/policy_pyr_provisional.json
```
```bash
.venv/Scripts/pyr-match registry --registry D:/pyr_registry activate --model-id <id> --policy pyr_matching/config/policy_pyr_provisional.json --approved-by "Coordinación PyR" --reason "piloto 2027A"
```
```bash
.venv/Scripts/pyr-match registry --registry D:/pyr_registry rollback --policy pyr_matching/config/policy_pyr_provisional.json --approved-by "Coordinación PyR"
```
```bash
.venv/Scripts/pyr-match registry --registry D:/pyr_registry rollback-to-baseline
```
La activación verifica: pista `suitability`, estado `PROMOVIBLE`, mismo algoritmo y esquema de características, **misma huella de política**, fuentes de etiqueta aceptadas y aprobador nombrado (código de salida 4 si se rechaza). Al usar `match --registry/--model`, un modelo incompatible con la política vigente se rechaza (no se usa en silencio). El modelo solo re-puntúa parejas permitidas; `Resumen_Ejecucion.version_algoritmo` muestra `<algoritmo>+<model_id>`.

## Pista A — comportamiento histórico (EXPERIMENTAL, separada)
`pyr-match train-behavior --dataset historico_canonico.json --registry D:/pyr_registry_comportamiento` entrena un logit condicional sobre elecciones SIGA observadas (periodos anteriores → último periodo intocado). Se guarda en un registro de pista `behavior`, **no se puede activar ni cargar como modelo de idoneidad** y solo entra al puntaje como componente `historical` de v0.3 si una política le asigna peso (provisional: 0).

## Antes de promover a producción
Revisar con la Coordinación: métricas vs línea base, brecha de sobreajuste, auditoría por programa/municipio, tamaño del periodo de prueba, y que las etiquetas no provengan de un solo semestre (no sobreajustar 2026B).

## Ciclo con revisión experta (v0.3)
```bash
.venv/Scripts/pyr-match feedback-template --inputs insumo_2027A.xlsx --period 2027A --out D:/pyr_privado/revision_2027A.xlsx --blind
```
Revisores autorizados califican `evaluacion_idoneidad` (1–5 o `NO_EVALUABLE`) con un `id_revisor` seudónimo; un aprobador **distinto** marca `estado_aprobacion=APROBADA` y `aprobado_por`. `--blind` oculta puntaje y explicación (recomendado para etiquetas: evita el anclaje).
```bash
.venv/Scripts/pyr-match feedback-import --files D:/pyr_privado/revision_2027A.xlsx --store D:/pyr_privado/retro
```
Rechaza y cuenta: filas no aprobadas, huella de fila alterada (IDs modificados), sin revisor o aprobador, aprobador = revisor, valores fuera de dominio y `NO_EVALUABLE`. Varias revisiones de la misma pareja se promedian y se marca el desacuerdo. Los comentarios **no se almacenan** ni se usan. Cada importación crea una versión inmutable con huella; una versión alterada se detecta al cargar.
```bash
.venv/Scripts/pyr-match retrain --inputs D:/pyr_privado/insumos_2027A_2027B.xlsx --period 2027B --feedback-store D:/pyr_privado/retro --registry D:/pyr_registry --report-out D:/pyr_privado/reentreno.json
```
Pasos: suficiencia (mínimos de la política) → candidato con partición temporal → comparación con la línea base **y** con el modelo activo → subgrupos → registro con las versiones de retroalimentación usadas → **activación humana** (`registry activate --approved-by`) → `registry rollback` si es necesario. Código 3 = datos insuficientes.

