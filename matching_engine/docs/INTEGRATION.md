# Guía de integración con la plataforma de la Universidad

## Opciones
1. **Lote Excel (recomendado para empezar)**: la plataforma exporta el contrato de entrada, ejecuta `pyr-match match`, importa `resultados.xlsx` o `--json-out`.
2. **Biblioteca Python**: `from pyr_matching import match_files` o `pipeline.run_match(InputBundle, period, Policy)` con registros construidos desde la base institucional (sin Excel).
3. **Servicio**: si la plataforma no es Python, envolver `run_match` en un servicio interno (p. ej. FastAPI) desplegado por TI de la Universidad. No se incluye servidor: no hay autenticación ni despliegue en este entregable.

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

## Requisitos
Python ≥ 3.10, `openpyxl`. Opcional `sentence-transformers` (CPU; modelo local, versión registrada en el resumen). Sin credenciales, sin Supabase, sin red (salvo la descarga única del modelo opcional).
