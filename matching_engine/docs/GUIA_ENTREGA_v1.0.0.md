# Guía de entrega — Motor de emparejamiento Paz y Región v1.0.0

Universidad de Ibagué · Programa Paz y Región · Fecha de entrega: noviembre de 2026
Repositorio: `IngenieroCui/paz-region-unibague`, carpeta `matching_engine/` (paquete Python `pyr-matching` 1.0.0).

## 1. Qué es

Un motor que recibe en Excel los estudiantes, las plazas (proyectos en territorio) y las decisiones ya tomadas por la institución, y devuelve otro Excel con:

- las **ubicaciones directas** confirmadas (no las toca) y **propuestas** para casos aprobados sin plaza, que requieren aprobación humana;
- **recomendaciones SIGA** no vinculantes: las mejores K plazas para cada estudiante, con puntaje, explicación y nivel de confianza;
- los casos **sin asignación** con motivo y siguiente paso;
- cupos, auditoría de reglas y trazabilidad (versiones, política y huellas SHA-256 de los archivos).

El motor **no** aprueba casos especiales, no elige ganadores de convocatoria y no matricula: esas decisiones siguen siendo institucionales.

## 2. Cómo funciona

```
 Excel(es) de entrada ──► 1. Validar (hojas, columnas, IDs, referencias)
                         2. Congelar lo confirmado (matrículas SIGA, directas confirmadas)
                         3. Reglas duras (programa/perfil, tipo de plaza, estado, municipio y modalidad aprobados, cupos)
                         4. Puntaje 0–100 por pareja permitida
                              programa · campo profesional · semántica de textos · requisitos · intereses
                              · léxico · ubicación · modalidad   (pesos en la política JSON)
                         5. Directas sin plaza → optimizador de flujo de costo mínimo (maximiza casos ubicados)
                         6. Electivas → top-K por estudiante (no consume cupos)
                         7. Auditoría independiente (segunda implementación de las reglas duras)
                       ──► Excel de resultados (+ JSON opcional)
```

- Las **reglas duras** nunca se compensan con puntaje: si una pareja las viola, no se recomienda.
- La **semántica** compara lo que el estudiante escribió (expectativas, habilidades, intereses) con la descripción de la plaza, usando TF-IDF con un léxico temático PyR (sin Internet) o, opcionalmente, embeddings multilingües locales.
- Cada puntaje viene con su **cobertura de evidencia** (ALTA/MEDIA/BAJA): un puntaje alto con poca información se marca como de baja confianza.
- Todo es **determinista y reproducible**: mismos insumos + misma política = mismo resultado.

Detalle técnico: [MATCHING_ENGINE_PYR.md](MATCHING_ENGINE_PYR.md) · Contrato de hojas y columnas: [EXCEL_CONTRACT.md](EXCEL_CONTRACT.md) · Decisiones de política: [POLICY_DECISIONS.md](POLICY_DECISIONS.md).

## 3. Cómo usarlo (resumen)

```bash
cd matching_engine
python -m venv .venv
.venv/Scripts/python -m pip install -e .
.venv/Scripts/pyr-match validate --inputs insumo.xlsx --period 2027A
.venv/Scripts/pyr-match match --inputs insumo.xlsx --period 2027A --out resultados.xlsx --policy pyr_matching/config/policy_pyr_v03_provisional.json
```
Abrir `resultados.xlsx` por `Resumen_Ejecucion` y `Diccionario_Salida`. Paso a paso completo: [MANUAL_DE_USO.md](MANUAL_DE_USO.md).

## 4. Cómo entrenarlo más (reentrenamiento)

Hoy el motor funciona con una **línea base explicable** (pesos fijados por política, no aprendidos). Puede seguir aprendiendo con revisiones de expertos, en un ciclo controlado que evita el sobreajuste:

1. `feedback-template --blind --explore 2` → libro de revisión ciego con parejas recomendadas y de exploración.
2. Revisores califican la idoneidad 1–5; un aprobador distinto marca `APROBADA`.
3. `feedback-import` → guarda una versión inmutable y validada de las revisiones.
4. `retrain` (≥ 2 periodos revisados) → entrena un candidato con partición temporal; el último periodo es la prueba.
5. Compuertas automáticas: debe superar a la línea base y al modelo activo, no empeorar el orden por estudiante ni ningún subgrupo de programa/municipio, y tener prueba suficiente. Si no, queda `RECHAZADO_*` con el motivo.
6. `registry activate --approved-by "Coordinación PyR"` → solo una persona activa un modelo; `registry rollback` lo revierte.

**Sobre el sobreajuste**: el reporte de entrenamiento incluye la brecha AUC entrenamiento − prueba, auditoría de fuga (estudiantes/plazas compartidos) y equidad por subgrupo. No se deben usar como etiquetas asignaciones históricas ni matrículas SIGA (el comando las rechaza) ni entrenar con un solo semestre.

Comandos exactos, requisitos de datos y compuertas: [MANUAL_DE_USO.md §8](MANUAL_DE_USO.md) y [RETRAINING_PLAYBOOK.md](RETRAINING_PLAYBOOK.md).

## 5. Requisitos

Resumen: cualquier portátil con Python 3.10+ y 2 GB de RAM libres; para servidor, 1–2 vCPU y 1–4 GB RAM; para reentrenar, al menos 200 parejas revisadas en 2 periodos (recomendado 800+ en 3+). Tabla completa de mínimos y recomendados: [REQUISITOS.md](REQUISITOS.md).

## 6. Servidor y API

`pyr-match serve` levanta una API HTTP para que otra aplicación **suba el Excel y reciba el Excel transformado**:

```bash
curl -X POST "https://<servidor>/v1/match/excel?period=2027A&policy=v0.3" \
  -H "Authorization: Bearer $PYR_API_TOKEN" \
  -H "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" \
  --data-binary @insumo.xlsx -o resultados.xlsx
```
Despliegue con Docker o systemd, HTTPS, variables de entorno y ejemplos en Python y JavaScript: [DESPLIEGUE_Y_API.md](DESPLIEGUE_Y_API.md). Integración sin HTTP (biblioteca Python o contrato JSON): [INTEGRATION.md](INTEGRATION.md).

## 7. Calidad verificada en la entrega

| Verificación | Resultado (2026-11-24) |
|---|---|
| Pruebas automatizadas (`pytest`) | 349 pasan, 2 omitidas (requieren el modelo de embeddings opcional) |
| Pruebas de la API HTTP | 12 casos: Excel crudo y multipart, validación, JSON, errores, token y límite de tamaño |
| Paridad con la plataforma original | 160 casos dorados `hybrid-v0.1` y 60 del optimizador P6-C |
| Prueba de punta a punta por la API | 520 estudiantes × 370 plazas sintéticos → libro de resultados correcto |
| Violaciones de reglas duras generadas por el motor | 0 (invariante auditado en cada corrida) |

## 8. Límites conocidos (honestos)

- Los pesos de la política v0.3 son **provisionales** y no se han aprendido con resultados de PyR: falta que la institución produzca revisiones validadas.
- La pista A (comportamiento histórico) es experimental y tiene peso 0.
- La imagen Docker se entrega con su `Dockerfile` pero su construcción no se probó en el equipo de desarrollo (no tenía Docker); el servidor sí se probó directamente con Python.
- La calidad semántica medida (paráfrasis) usa conjuntos pequeños escritos por el equipo: es indicativa, no una medición sobre datos reales.

## 9. Mapa de documentos

| Documento | Para quién |
|---|---|
| [MANUAL_DE_USO.md](MANUAL_DE_USO.md) | Analistas PyR: operación semestral, lectura de resultados, entrenamiento |
| [REQUISITOS.md](REQUISITOS.md) | Coordinación y TI: mínimos y recomendados |
| [DESPLIEGUE_Y_API.md](DESPLIEGUE_Y_API.md) | TI y desarrolladores: servidor, API, seguridad |
| [INTEGRATION.md](INTEGRATION.md) | Desarrolladores: biblioteca Python y contrato JSON |
| [RETRAINING_PLAYBOOK.md](RETRAINING_PLAYBOOK.md) | Coordinación: cuándo y cómo reentrenar, activar y revertir |
| [EXCEL_CONTRACT.md](EXCEL_CONTRACT.md) | Quien prepara los insumos |
| [PROGRAMAS_UNIBAGUE.md](PROGRAMAS_UNIBAGUE.md) | Catálogo de programas, alias y ramas ocupacionales |
| [FAIRNESS_PRIVACY.md](FAIRNESS_PRIVACY.md) | Protección de datos y equidad |
| [../CHANGELOG.md](../CHANGELOG.md) | Historial de versiones |
