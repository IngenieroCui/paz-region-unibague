# Evaluación histórica (Fase 4) — `pyr-match evaluate-historical`

```bash
.venv/Scripts/pyr-match evaluate-historical --dataset D:/pyr_privado/historico/historico_canonico.json --out-dir D:/pyr_privado/evaluacion --embeddings
```
Salidas: `evaluacion_historica.xlsx` (Resumen, Comparacion_Modelos, Subgrupos_Programa, Subgrupos_Municipio, Cobertura, Directas, Simulacion_Retrospectiva, Controles_Fuga, Limitaciones), `.json` y `.md`.

## Tres preguntas distintas (nunca mezcladas)
| Pregunta | Métricas | Interpretación |
|---|---|---|
| **Predicción** del comportamiento histórico | Recall@3, Recall@5, MRR y NDCG@5 de la plaza observada dentro del conjunto elegible, con la línea base aleatoria esperada | Coincidencia con decisiones pasadas (autoselección SIGA, disponibilidad, orden de llegada). **No es idoneidad.** |
| **Factibilidad** de la asignación | Cobertura de candidatos, cobertura de plazas elegibles, factibilidad de directas, violaciones de restricciones y cupos en la simulación retrospectiva (auditoría independiente) | El motor puede producir asignaciones válidas; las asignaciones históricas fuera de regla son conflictos institucionales. |
| **Calidad** real | Solo con etiquetas de idoneidad validadas (pista B) | Hoy **NO_EVALUABLE** (bloqueo B4). |

## Ranqueadores comparados
`solo_programa` (línea base) · `hybrid-pyr-v0.2` · `tfidf_semantico` · `embeddings_semantico` (con `--embeddings`) · `hybrid-pyr-v0.3_tfidf` / `_embeddings` · `comportamiento_historico` (pista A, entrenado solo con periodos anteriores) · `idoneidad_supervisada` (solo si hay etiquetas válidas).

## Partición y controles de fuga
- El último periodo (p. ej. 2026B) es la prueba intocada; los periodos anteriores son de desarrollo.
- TF-IDF y embeddings: no supervisados, ajustados por periodo con texto previo a la decisión.
- Ninguna característica depende de la etiqueta; la retroalimentación de calidad (POST) nunca se usa.
- Los estudiantes repetidos entre desarrollo y prueba se reportan.
- Disponibilidad: `eligible_with_uptake` usa "plazas con al menos una asignación observada" como aproximación de la oferta (información posterior: limitación explícita); `eligible_all` sobrestima la oferta.

## Estado de los resultados
**No se han calculado métricas sobre datos institucionales reales**: el equipo no tiene las exportaciones locales (solo se verificaron encabezados). Las pruebas y la demostración usan datos sintéticos en formato institucional; sus métricas validan la herramienta, no el motor. Para el piloto: ejecutar `historical-build` + `evaluate-historical` sobre las exportaciones 2025A–2026B en un equipo institucional y revisar el reporte con la Coordinación.
