# Re-alcance del proyecto — noviembre 2026

## Decisión
El 11-nov-2026 se confirmó que la Universidad de Ibagué termina su propia plataforma Paz y Región. Este repositorio **deja de evolucionar como plataforma**. El entregable aceptado es un **motor independiente de selección/recomendación** (`matching_engine/`), invocable por la plataforma institucional, que opera por lotes Excel → Excel, es explicable, versionado y reentrenable cuando existan etiquetas válidas.

## Antes vs. ahora

| Elemento | Antes (plataforma P1–P12) | Ahora (motor independiente) |
|---|---|---|
| Producto | React/Vite + Supabase con portales, auth, RBAC, dashboard | Paquete Python `pyr-matching` + CLI + contrato JSON |
| Datos | Tablas Supabase `PYRUnibague_*` | Libros Excel limpios entregados por la Universidad |
| Scoring | `hybrid-v0.1` (TS, Edge Function) | `hybrid-pyr-v0.2` (Python) con paridad probada contra `hybrid-v0.1` |
| Optimizador | P6-C `solveAssignments.ts` | Port con paridad exacta; solo para **propuestas directas** y simulación opt-in |
| Electividad SIGA | Asignación global P6 | **Recomendaciones no vinculantes**; el estudiante elige en SIGA |
| Directas | No modeladas | Confirmadas (congeladas), propuestas sujetas a aprobación, gestión humana |
| IA | Embeddings por API externa opcional | TF-IDF offline por defecto + embeddings multilingües **locales** opcionales; re-ranqueador supervisado opt-in |
| UI / Auth / despliegue | Sí | **Fuera de alcance** |

## Qué se conserva
- Todo el código de la plataforma queda intacto (sin borrar ni migrar Supabase). Sus pruebas siguen ejecutándose.
- `hybrid-v0.1` y P6-C siguen siendo la referencia: los archivos `matching_engine/parity/golden_*.json` se generan **desde el TypeScript** y se verifican tanto en Python (`tests/test_parity.py`) como en vitest (`src/features/matching/pyr-parity.test.ts`). Ninguna de las dos implementaciones puede divergir en silencio.

## Qué queda obsoleto (no se borra)
- `docs/P7_OPERATIONAL_HANDOFF.md`, P8–P12 (demo, branding, dual auth, dashboard) describen la plataforma ya fuera de alcance.
- Pesos 25/20/10/10/10/10/15 y umbral 70 de `hybrid-v0.1`: siguen siendo sugerencias de UI, no criterios institucionales.

## Justificación técnica: Python
Excel nativo (`openpyxl`), NLP multilingüe local (`sentence-transformers`), entrenamiento y empaquetado para analistas sin Node/Supabase. Para evitar dos reglas de negocio divergentes, el port de `hybrid-v0.1`/P6-C es **literal** y está cubierto por paridad dorada; la nueva semántica vive en un identificador nuevo (`hybrid-pyr-v0.2`).

## Documentación del motor
`matching_engine/README.md` (inicio rápido e integración) y `matching_engine/docs/` (contrato Excel, algoritmo, política/decisiones, privacidad, reentrenamiento, demo). Auditoría de fuentes: `docs/data-source-audit.md`.
