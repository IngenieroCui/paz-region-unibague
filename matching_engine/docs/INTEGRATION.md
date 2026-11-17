# Guía de integración con la plataforma de la Universidad

## Opciones
1. **Lote Excel (recomendado para empezar)**: la plataforma exporta el contrato de entrada, ejecuta `pyr-match match`, importa `resultados.xlsx` o `--json-out`.
2. **Biblioteca Python**: `from pyr_matching import match_files` o `pipeline.run_match(InputBundle, period, Policy)` con registros construidos desde la base institucional (sin Excel).
3. **Contrato JSON versionado (v0.3)**: `pyr_matching.api.match_request(dict) -> dict` o `pyr-match match-json --request req.json --out res.json`. Solicitud `pyr-match-request/1.0`, respuesta `pyr-match-result/1.0`. Ejemplo sintético: [`examples/request_example.json`](../examples/request_example.json).
4. **Servicio**: si la plataforma no es Python, envolver `match_request` en un servicio interno (p. ej. FastAPI) desplegado por TI de la Universidad. No se incluye servidor: no hay autenticación ni despliegue en este entregable.

## Contrato JSON de solicitud (`pyr-match-request/1.0`)
```json
{"schema_version": "pyr-match-request/1.0", "period": "2027A", "policy": "v0.3",
 "options": {"semantic": "tfidf", "simulate": false, "pairs": "top", "timestamp": null},
 "students":    [{"student_id": "S001", "academic_program": "Psicología", "origin_municipality": "Ibagué",
                  "expectations_text": "...", "learning_goals_text": "...", "skills_text": null}],
 "vacancies":   [{"vacancy_id": "V01", "capacity": 2, "status": "Aprobada", "vacancy_type": "Normal",
                  "program_profile": "Psicología", "program_profile_alt": null, "municipality": "Chaparral",
                  "modality": "Presencial", "project_description": "...", "requirements_text": null}],
 "decisions":   [{"student_id": "S002", "direct_type": "Municipio de origen", "approval_status": "Aprobado",
                  "approved_municipality": "Líbano", "approved_modalities": ["Presencial"]}],
 "enrollments": [{"student_id": "S003", "vacancy_id": "V01", "status": "Matriculado"}]}
```
- Campos permitidos = los del esquema canónico (`pyr_matching.api.allowed_fields("students")`, etc.). **Los campos desconocidos se rechazan** (`REQUEST_ERROR` / `CAMPO_NO_PERMITIDO`): un nombre, cédula o dato sensible no puede colarse por la integración.
- Errores: `{"status": "REQUEST_ERROR"|"VALIDATION_ERROR", "issues": [...]}` con códigos, nunca valores personales. Éxito: `{"status": "OK", "schema_version": "pyr-match-result/1.0", "summary", "warnings", "tables"}`, idéntico a la salida Excel.
- Python:
```python
from pyr_matching.api import match_request
res = match_request(request_dict)  # política según request["policy"] (v0.2 por defecto)
res["tables"]["Recomendaciones_SIGA"]; res["summary"]["violaciones_generadas_por_motor"]  # siempre 0
```

## Contrato estable
- `schema_version`: `pyr-match-result/1.0` (cambios incompatibles ⇒ nueva versión mayor).
- `summary.version_algoritmo`, `summary.politica_id`, `summary.politica_huella`, `summary.backend_semantico_version`, `summary.modelo_supervisado` deben guardarse con cada ejecución.
- `tables.<Hoja>` = lista de objetos con las columnas descritas en `EXCEL_CONTRACT.md`.
- Campos que representan decisiones reales: solo `Asignaciones_Directas.estado = CONFIRMADA_FIJA` (eco de la decisión institucional) y `Conciliacion_SIGA.estado_conciliacion = CONFIRMADA_SIGA`. Todo lo demás es propuesta o recomendación.

## Flujo sugerido por periodo
1. Exportar `Estudiantes`, `Plazas`, `Decisiones_Directas` (y `Matriculas_SIGA` si ya hay).
2. `validate` → corregir bloqueantes en la fuente institucional.
3. `match` → Coordinación revisa `Asignaciones_Directas` (propuestas) y `Sin_Asignacion`.
4. Registrar decisiones aprobadas como `Ubicacion_Confirmada=SI` y volver a ejecutar `match` (idempotente y determinista).
5. Publicar plazas `publicable_siga=SI` con `cupos_restantes`; mostrar `Recomendaciones_SIGA` como orientación al estudiante.
6. Tras SIGA: `reconcile` con las matrículas reales.

## Ciclo de mejora (v0.3)
`feedback-template` (libro de revisión experta) → revisores/aprobador → `feedback-import` (versiona en almacén fuera de git) → `retrain` (candidato, nunca activo) → `registry check/activate --approved-by` → `registry rollback` si es necesario. Evaluación histórica: `historical-build` → `evaluate-historical`. Detalle en [RETRAINING_PLAYBOOK.md](RETRAINING_PLAYBOOK.md) y [EVALUATION.md](EVALUATION.md).

## Requisitos
Python ≥ 3.10, `openpyxl`. Opcional `sentence-transformers` (CPU; modelo local, versión registrada en el resumen). Sin credenciales, sin Supabase, sin red (salvo la descarga única del modelo opcional).
