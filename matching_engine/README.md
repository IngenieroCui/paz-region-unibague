# pyr-matching — motor de emparejamiento Paz y Región (Excel → Excel)

Motor independiente, explicable y versionado para la Universidad de Ibagué. Recibe libros Excel **ya limpios y validados por la institución** y produce un libro auditable con:

- **asignaciones directas** confirmadas (congeladas) y **propuestas** que requieren aprobación;
- **recomendaciones SIGA no vinculantes** (top-K por estudiante) y ranking de idoneidad por plaza;
- casos **sin asignación** con motivo y siguiente paso;
- cupos, trazabilidad (versiones, política, huellas SHA-256) y diccionario de salida.

> No aprueba casos especiales, no selecciona ganadores de convocatoria y no matricula estudiantes. **No está entrenado** con resultados de PyR: la línea base es determinista; el re-ranqueador supervisado solo se habilita con etiquetas institucionales validadas.

## Instalación

```bash
cd matching_engine
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[test]"
```
(Linux/macOS: `.venv/bin/python`.) Opcional — embeddings multilingües **locales** (descarga ~470 MB una vez; no envía datos a terceros):
```bash
.venv/Scripts/python -m pip install -e ".[semantic]"
```

## Inicio rápido (analistas)

```bash
.venv/Scripts/pyr-match make-sample --out ejemplo.xlsx
```
```bash
.venv/Scripts/pyr-match validate --inputs ejemplo.xlsx --period 2027A
```
```bash
.venv/Scripts/pyr-match match --inputs ejemplo.xlsx --period 2027A --out resultados.xlsx --json-out resultados.json
```
Abrir `resultados.xlsx`: empezar por `Resumen_Ejecucion` y `Diccionario_Salida`. Con embeddings locales: `--semantic sentence-transformers`. Simulación de asignación general (no vinculante): `--simulate`.

Conciliar matrículas SIGA reales (fase 5):
```bash
.venv/Scripts/pyr-match reconcile --inputs ejemplo.xlsx --period 2027A --enrollments siga.xlsx --previous-output resultados.xlsx --out conciliacion.xlsx
```

Varias fuentes: `--inputs estudiantes.xlsx plazas.xlsx decisiones.xlsx` (cada hoja se busca por nombre). Encabezados institucionales distintos: `--mapping mi_mapeo.json` (ver `pyr_matching/config/mapping_canonical.json` y `pyr_matching/config/mapping_tablero_2026b_EJEMPLO.json`).

Códigos de salida: `0` ok · `2` validación/mapeo · `3` no entrenable · `1` inesperado.

## Integración (plataforma institucional)

```python
from pyr_matching import match_files
res = match_files(["insumo.xlsx"], "2027A", output="resultados.xlsx")
res.summary                      # dict con versiones, conteos, coberturas
res.tables["Recomendaciones_SIGA"]  # list[dict]
payload = res.to_json_dict()      # contrato JSON versionado: schema_version = "pyr-match-result/1.0"
```
Sin Excel: construir `pyr_matching.schema.InputBundle` y llamar `pyr_matching.pipeline.run_match(bundle, period, Policy.load())`. Detalles: [docs/INTEGRATION.md](docs/INTEGRATION.md).

## Documentación
| Documento | Contenido |
|---|---|
| [docs/EXCEL_CONTRACT.md](docs/EXCEL_CONTRACT.md) | Hojas/columnas de entrada y salida, valores permitidos |
| [docs/MATCHING_ENGINE_PYR.md](docs/MATCHING_ENGINE_PYR.md) | Algoritmo, fases, cambios vs `hybrid-v0.1`, benchmarks |
| [docs/POLICY_DECISIONS.md](docs/POLICY_DECISIONS.md) | Precedencia de restricciones y registro de decisiones pendientes |
| [docs/FAIRNESS_PRIVACY.md](docs/FAIRNESS_PRIVACY.md) | Datos excluidos, minimización, auditorías |
| [docs/RETRAINING_PLAYBOOK.md](docs/RETRAINING_PLAYBOOK.md) | Cuándo y cómo entrenar, promover y revertir |
| [docs/DEMO.md](docs/DEMO.md) | Escenario sintético verificable a mano |
| [../docs/data-source-audit.md](../docs/data-source-audit.md) | Auditoría de fuentes institucionales |

## Pruebas
```bash
.venv/Scripts/python -m pytest -q
```
Incluye paridad dorada con el TypeScript original (`parity/`), escenario manual, privacidad, ida y vuelta Excel, reproducibilidad, oráculo exhaustivo del optimizador y compuertas de entrenamiento.

**Nunca** agregar a git libros institucionales reales, registros de modelos entrenados con datos reales ni cachés de embeddings (ver `.gitignore`).
