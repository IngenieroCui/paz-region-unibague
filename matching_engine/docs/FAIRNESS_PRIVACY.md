# Equidad y privacidad

## Minimización
- Solo se leen las columnas mapeadas del contrato canónico. Las demás (aunque estén en el mismo libro) no se cargan.
- **Guardia de mapeo**: el motor rechaza (código 2) cualquier mapeo que alimente un campo de compatibilidad con columnas cuyo encabezado contenga: cédula, nombre/apellido (estudiantes), sexo/género, EPS/salud, nacimiento, celular/teléfono, correo, dirección, acudiente/emergencia, discapacidad, etnia, religión, estrato, justificación/motivo/observación/respuesta/horario de caso especial. Usar la cédula como `ID_Estudiante` produce advertencia (recomendado: código o seudónimo).
- Las salidas contienen IDs y datos de la plaza; nunca textos del estudiante ni motivos de casos especiales. Los códigos de motivo son genéricos.
- Validación y logs: solo códigos, hojas, filas e IDs.
- Embeddings: solo modelo **local**; los vectores viven en memoria y no se persisten. No se usa ninguna API externa ni LLM.

## Equidad
- No hay atributos protegidos en el esquema de características (`pyr-features/1.0`): ni el puntaje ni el modelo pueden usarlos.
- Información faltante = desconocida (peso 0, renormalización explícita, `confianza_evidencia`), nunca "baja capacidad".
- `train` produce una auditoría por programa y municipio (n, positivos, puntaje medio modelo vs línea base). Revisarla antes de promover.
- Riesgo conocido: la similitud textual favorece a quien escribe respuestas más largas/técnicas. Mitigaciones: el programa domina la elegibilidad; recomendaciones no vinculantes; revisar distribución de `confianza_evidencia` por programa.
- Las asignaciones históricas no se usan como "verdad": SIGA es libre elección por orden de llegada y las directas son forzadas por restricciones.

## Datos en git
Solo código, configuraciones, fixtures sintéticos y archivos dorados sintéticos (`parity/`, prueba automática sin correos). `.gitignore` excluye `*.xlsx`, `registry/`, cachés de modelos y salidas.
