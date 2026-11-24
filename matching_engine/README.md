# pyr-matching — motor de emparejamiento Paz y Región (Excel → Excel)

Motor independiente, explicable y versionado para la Universidad de Ibagué. Recibe libros Excel **ya limpios y validados por la institución** y produce un libro auditable con:

- **asignaciones directas** confirmadas (congeladas) y **propuestas** que requieren aprobación;
- **recomendaciones SIGA no vinculantes** (top-K por estudiante) y ranking de idoneidad por plaza;
- casos **sin asignación** con motivo y siguiente paso;
- cupos, trazabilidad (versiones, política, huellas SHA-256) y diccionario de salida.

> No aprueba casos especiales, no selecciona ganadores de convocatoria y no matricula estudiantes. **No está entrenado** con resultados de PyR: la línea base es determinista; el re-ranqueador supervisado solo se habilita con etiquetas institucionales validadas.

> **Versión 1.0.0 (entrega).** Empiece por la [guía de entrega](docs/GUIA_ENTREGA_v1.0.0.md): cómo funciona, cómo entrenarlo más, [requisitos mínimos y recomendados](docs/REQUISITOS.md) y [despliegue en servidor con API HTTP](docs/DESPLIEGUE_Y_API.md) para subir el Excel y recibir el resultado. Cambios: [CHANGELOG.md](CHANGELOG.md).

> **Manual de uso completo:** [docs/MANUAL_DE_USO.md](docs/MANUAL_DE_USO.md) (qué entra, qué sale, cómo entrenar más, requisitos, problemas frecuentes).

## Novedades v1.0.0
| Área | Detalle |
|---|---|
| API HTTP | `pyr-match serve`: `POST /v1/match/excel?period=2027A` recibe el Excel y devuelve `resultados.xlsx` (o JSON); validación, contrato JSON, token Bearer, límite de tamaño, sin dependencias nuevas |
| Despliegue | `Dockerfile`, unidad systemd, proxy nginx HTTPS y cliente de ejemplo en `deploy/` |
| Documentación | Guía de entrega, requisitos mínimos/recomendados, despliegue y API |
| Algoritmo | Sin cambios respecto a 0.3.2 (resultados idénticos) |

## Novedades v0.3.2 (motor 0.3.2, política `pyr-v032-provisional-2026-11-16`)
| Área | Detalle |
|---|---|
| Restricción de perfil reforzada | Catálogo oficial Unibagué (17 programas + heredados) con alias y corrección de un solo error de digitación; nada silencioso: hoja `Normalizacion_Programas` y advertencias `PROGRAMA_*`. Evita excluir estudiantes por `Ingeniería Sistemas` vs `Ingeniería de Sistemas` y nunca convierte una disciplina distinta en otra |
| Datos pendientes | `PENDIENTE`, `N/A`, `#REF!` se tratan como desconocidos; si eran una restricción aprobada, la pareja se bloquea (falla segura) |
| Verificador independiente | La auditoría vuelve a comprobar las reglas duras con una implementación escrita aparte, más rangos y duplicados en las recomendaciones |
| Campo profesional | Componente `occupational`: ramas del perfil ocupacional oficial de cada carrera, mejor rama, solo para estudiantes sin texto ([docs/PROGRAMAS_UNIBAGUE.md](docs/PROGRAMAS_UNIBAGUE.md)) |
| Léxico | `pyr-conceptos-es/1.1`: 51 áreas (12 nuevas de campos profesionales) |
| Estructura de plazas | Evidencia 2026B: una fila de `Proyectos` = un cupo; `Aprobados` trae programas, no cupos (diagnóstico `APROBADOS_NO_NUMERICO`, usar `row_count`) |
| Rendimiento | Escritura de Excel 7 veces más rápida (520 × 370: unos 7 s en total) |

## Novedades v0.3.1 (motor 0.3.1, política `pyr-v031-provisional-2026-11-16`)
| Área | Detalle |
|---|---|
| Respaldo semántico `tfidf-conceptos` (predeterminado v0.3) | TF-IDF + léxico temático PyR (39 áreas, `pyr_matching/semantic_lexicon.py`), sin dependencias ni red. Paráfrasis, conjunto reservado: top-1 33 % → 90 % (embeddings: 97 %). Simulación: NDCG@5 0.76 → 0.88 |
| Revisión experta | `feedback-template --explore N` agrega parejas elegibles no recomendadas (reduce sesgo de selección); `--blind` oculta también el rango y desordena filas |
| Compuertas de promoción | Nueva `RECHAZADO_EMPEORA_ORDEN_POR_ESTUDIANTE` (NDCG graduado por estudiante); compuerta de subgrupos exige tamaño mínimo (30 parejas, 5 por clase) y reporta los pequeños |
| Simulación | `benchmarks/simulacion_reentrenamiento.py`: verdad latente, revisores simulados y ciclo real de reentrenamiento |

La política v0.3.1 cambia de huella: modelos entrenados con la política v0.3.0 deben reentrenarse.

## Novedades v0.3 (`hybrid-pyr-v0.3`, motor 0.3.0)
| Área | Estado | Detalle |
|---|---|---|
| Correcciones v0.2 | **Funcional** | Consolidación multi-hoja/multi-archivo con procedencia y duplicados explícitos · perfil de plaza faltante = bloqueo seguro · registro con verificación de política, aprobador y pistas separadas · protección contra inyección de fórmulas en Excel · auditoría independiente: `conflictos_historicos_institucionales` vs `violaciones_generadas_por_motor` (hoja `Auditoria_Restricciones`) |
| Histórico canónico | **Funcional** (probado con datos sintéticos en formato institucional) | `historical-build`: seudonimización HMAC, PRE/POST, cobertura, problemas, procedencia. [docs/HISTORICAL_DATA.md](docs/HISTORICAL_DATA.md) |
| Puntaje v0.3 | **Funcional, pesos provisionales NO aprendidos** | Semántica por campo (aspiraciones↔proyecto, habilidades↔requisitos, intereses↔proyecto), evidencia faltante explícita. Política `config/policy_pyr_v03_provisional.json` (v0.2 sigue siendo el defecto y conserva paridad) |
| Embeddings locales | **Funcional, opt-in** | MiniLM multilingüe local, sin red por defecto (`download-model` explícito), lotes y caché opcional |
| Pista A — comportamiento histórico | **EXPERIMENTAL** | `train-behavior`: logit condicional sobre elecciones SIGA; no es idoneidad; peso 0 |
| Pista B — idoneidad supervisada | **Infraestructura lista, NO entrenada** | No existen etiquetas validadas (B4) |
| Evaluación histórica temporal | **Funcional (herramienta)**; sin métricas reales | `evaluate-historical`: predicción vs factibilidad vs calidad, separadas. [docs/EVALUATION.md](docs/EVALUATION.md) |
| Revisión experta y reentrenamiento | **Funcional** | `feedback-template` → `feedback-import` (versionado, validado) → `retrain` (nunca activa) → `registry activate --approved-by` / `rollback` |
| Integración JSON | **Funcional** | `pyr_matching.api.match_request` / `match-json` (`pyr-match-request/1.0`, campos desconocidos rechazados). [docs/INTEGRATION.md](docs/INTEGRATION.md) |

```bash
.venv/Scripts/pyr-match match --inputs ejemplo.xlsx --period 2027A --out resultados.xlsx --policy pyr_matching/config/policy_pyr_v03_provisional.json
```

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
Por HTTP (otra aplicación sube el Excel): `pyr-match serve` y `POST /v1/match/excel?period=2027A` — ver [docs/DESPLIEGUE_Y_API.md](docs/DESPLIEGUE_Y_API.md).
Sin Excel: construir `pyr_matching.schema.InputBundle` y llamar `pyr_matching.pipeline.run_match(bundle, period, Policy.load())`. Detalles: [docs/INTEGRATION.md](docs/INTEGRATION.md).

## Documentación
| Documento | Contenido |
|---|---|
| [docs/GUIA_ENTREGA_v1.0.0.md](docs/GUIA_ENTREGA_v1.0.0.md) | **Guía de entrega v1.0.0** (punto de partida) |
| [docs/MANUAL_DE_USO.md](docs/MANUAL_DE_USO.md) | **Manual de uso** (operación, entrenamiento, requisitos) |
| [docs/REQUISITOS.md](docs/REQUISITOS.md) | Requisitos mínimos y recomendados (uso, reentrenamiento, servidor) |
| [docs/DESPLIEGUE_Y_API.md](docs/DESPLIEGUE_Y_API.md) | Servidor HTTP, Docker/systemd, HTTPS, conexión desde otras aplicaciones |
| [docs/PROGRAMAS_UNIBAGUE.md](docs/PROGRAMAS_UNIBAGUE.md) | Catálogo de programas, alias y ramas ocupacionales |
| [docs/EXCEL_CONTRACT.md](docs/EXCEL_CONTRACT.md) | Hojas/columnas de entrada y salida, valores permitidos |
| [docs/MATCHING_ENGINE_PYR.md](docs/MATCHING_ENGINE_PYR.md) | Algoritmo, fases, cambios vs `hybrid-v0.1`, benchmarks |
| [docs/POLICY_DECISIONS.md](docs/POLICY_DECISIONS.md) | Precedencia de restricciones y registro de decisiones pendientes |
| [docs/FAIRNESS_PRIVACY.md](docs/FAIRNESS_PRIVACY.md) | Datos excluidos, minimización, auditorías |
| [docs/RETRAINING_PLAYBOOK.md](docs/RETRAINING_PLAYBOOK.md) | Cuándo y cómo entrenar, promover y revertir |
| [docs/DEMO.md](docs/DEMO.md) | Escenario sintético verificable a mano |
| [docs/HISTORICAL_DATA.md](docs/HISTORICAL_DATA.md) | Histórico canónico: fuentes, seudonimización, PRE/POST, cupos |
| [docs/EVALUATION.md](docs/EVALUATION.md) | Evaluación temporal y su interpretación |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | Contrato JSON e integración con la plataforma institucional |
| [../docs/data-source-audit.md](../docs/data-source-audit.md) | Auditoría de fuentes institucionales |

## Pruebas
```bash
.venv/Scripts/python -m pytest -q
```
Incluye paridad dorada con el TypeScript original (`parity/`), escenario manual, privacidad, ida y vuelta Excel, reproducibilidad, oráculo exhaustivo del optimizador y compuertas de entrenamiento.

**Nunca** agregar a git libros institucionales reales, registros de modelos entrenados con datos reales ni cachés de embeddings (ver `.gitignore`).
