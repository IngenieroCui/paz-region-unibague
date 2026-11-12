"""Static data dictionary exported as the `Diccionario_Salida` sheet."""

_A = "ASIGNACION_REAL"
_P = "PROPUESTA_SUJETA_A_APROBACION"
_R = "RECOMENDACION_NO_VINCULANTE"
_I = "INFORMATIVO_AUDITORIA"


def _d(hoja, columna, significado, valores="", naturaleza=_I):
    return {"hoja": hoja, "columna": columna, "significado": significado, "valores_permitidos": valores, "naturaleza": naturaleza}


OUTPUT_DICTIONARY = [
    _d("Asignaciones_Directas", "id_estudiante", "Identificador del estudiante usado solo para unir con sistemas institucionales.", "texto"),
    _d("Asignaciones_Directas", "id_plaza", "Identificador de la plaza.", "texto"),
    _d("Asignaciones_Directas", "tipo_directa", "Categoría de asignación directa aprobada (no sensible).", "CASO_ESPECIAL | MUNICIPIO_ORIGEN | CONVOCATORIA"),
    _d("Asignaciones_Directas", "estado", "CONFIRMADA_FIJA = ubicación ya confirmada por la institución y congelada. PROPUESTA_REQUIERE_APROBACION = sugerencia del optimizador que solo cumple restricciones aprobadas; requiere aprobación institucional.",
       "CONFIRMADA_FIJA | PROPUESTA_REQUIERE_APROBACION", f"{_A} (CONFIRMADA_FIJA) / {_P}"),
    _d("Asignaciones_Directas", "es_asignacion_real", "SI solo cuando la institución ya confirmó la ubicación.", "SI | NO"),
    _d("Asignaciones_Directas", "compatibilidad", "Puntaje 0-100 de hybrid-pyr-v0.2 (o modelo supervisado si se indica). No es una decisión institucional.", "0-100"),
    _d("Asignaciones_Directas", "cobertura_evidencia", "Fracción del peso configurado con evidencia disponible.", "0-1"),
    _d("*", "confianza_evidencia", "Nivel de evidencia: ALTA (cobertura >= 0.7), MEDIA (>= 0.4), BAJA. Un puntaje alto con confianza BAJA no indica alta idoneidad.", "ALTA | MEDIA | BAJA"),
    _d("Asignaciones_Directas", "verificacion_reglas", "OK o ALERTA con códigos de reglas que una ubicación confirmada no cumple (no se modifica, se informa).", "OK | ALERTA: códigos"),
    _d("Asignaciones_Directas", "excede_cupos", "SI si la ubicación confirmada supera los cupos registrados.", "SI | NO"),
    _d("Recomendaciones_SIGA", "rango", "Posición de la plaza en la lista personal del estudiante (1 = más compatible).", "1..top_k", _R),
    _d("Recomendaciones_SIGA", "cupos_restantes_al_ejecutar", "Cupos publicables tras restar directas confirmadas/propuestas y matrículas previas. SIGA puede cambiar luego.", "entero >= 1", _R),
    _d("Recomendaciones_SIGA", "sobre_umbral", "Si la compatibilidad supera el umbral provisional de la política.", "SI | NO", _R),
    _d("Recomendaciones_SIGA", "tipo_resultado", "Siempre RECOMENDACION_NO_VINCULANTE: el estudiante elige y se matricula en SIGA.", "RECOMENDACION_NO_VINCULANTE", _R),
    _d("Recomendaciones_SIGA", "explicacion", "Aportes principales, componentes sin evidencia y cobertura.", "texto", _R),
    _d("Plazas_Disponibles", "cupos_originales", "Cupos de la plaza en el insumo.", "entero"),
    _d("Plazas_Disponibles", "ocupados_directa_confirmada", "Cupos ocupados por directas confirmadas.", "entero"),
    _d("Plazas_Disponibles", "ocupados_siga_confirmada", "Cupos ocupados por matrículas SIGA ya registradas.", "entero"),
    _d("Plazas_Disponibles", "reservados_directa_propuesta", "Cupos reservados para propuestas directas pendientes de aprobación.", "entero"),
    _d("Plazas_Disponibles", "cupos_restantes", "Cupos aún disponibles (nunca negativo).", "entero >= 0"),
    _d("Plazas_Disponibles", "publicable_siga", "Si el tipo/estado de plaza permite publicarla para electividad según la política.", "SI | NO"),
    _d("Sin_Asignacion", "estado", "REQUIERE_GESTION_HUMANA: directa aprobada sin plaza factible o con datos incompletos. PENDIENTE_APROBACION_INSTITUCIONAL: decisión no registrada/pendiente. SIN_RECOMENDACION: estudiante electivo sin plazas elegibles.",
       "REQUIERE_GESTION_HUMANA | PENDIENTE_APROBACION_INSTITUCIONAL | SIN_RECOMENDACION"),
    _d("Sin_Asignacion", "codigo_motivo", "Código no sensible del motivo; nunca incluye justificaciones de casos especiales.", "ver docs/EXCEL_CONTRACT.md"),
    _d("Sin_Asignacion", "siguiente_paso", "Acción institucional sugerida.", "texto"),
    _d("Idoneidad_Por_Plaza", "rango", "Ranking de estudiantes electivos más compatibles con la plaza (reporte informativo para la organización/coordinación).", "1..N", _R),
    _d("Simulacion_No_Vinculante", "tipo_resultado", "Solo si se solicitó --simulate: distribución óptima hipotética de electivos. No sustituye la elección SIGA.", "SIMULACION_NO_VINCULANTE", _R),
    _d("Pares_Evaluados", "c_<componente>", "Puntaje bruto 0-100 por componente; vacío = desconocido (no es cero).", "0-100 | vacío"),
    _d("Pares_Evaluados", "peso_efectivo_<componente>", "Peso renormalizado aplicado en esta pareja.", "0-100"),
    _d("Pares_Evaluados", "bloqueos", "Códigos de reglas duras que bloquean la pareja.", "códigos"),
    _d("Resumen_Ejecucion", "clave/valor", "Periodo, versiones (motor, algoritmo, política, esquema, backend semántico, modelo), conteos, coberturas, advertencias y huellas SHA-256 de archivos fuente.", "texto"),
]
