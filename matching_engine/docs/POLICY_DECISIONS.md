# Precedencia de restricciones y registro de decisiones de política

Política activa por defecto: `pyr_matching/config/policy_pyr_provisional.json` — **`PROVISIONAL_NO_APROBADA_POR_UNIBAGUE`**. Cada ejecución registra `politica_id` y `politica_huella` (SHA-256 del JSON). Cambiar reglas = nuevo archivo de política, no editar código.

## Precedencia (de mayor a menor)
1. Decisiones institucionales confirmadas (directas confirmadas, matrículas SIGA) — se congelan; el motor solo informa alertas.
2. Validación de datos (IDs, referencias, cupos válidos).
3. Estado de aprobación: solo `APROBADO` genera propuestas; `PENDIENTE`/desconocido nunca se asume aprobado.
4. Requisitos de proceso: convocatoria requiere plaza seleccionada; municipio de origen requiere municipio aprobado.
5. Restricciones duras aprobadas (municipio, modalidad), tipo de plaza por flujo, estado de plaza, perfil de programa, cupo.
6. Prioridad de directas sobre electividad (cupos de propuestas se reservan).
7. Puntaje blando (`hybrid-pyr-v0.2` o modelo promovido) — solo ordena opciones ya permitidas.
8. Desempate determinista por ID.

## Registro de decisiones pendientes de la Universidad
| ID | Decisión | Valor provisional | Evidencia | Responsable sugerido |
|---|---|---|---|---|
| D1 | Pesos de componentes | program 30, semantic 35, lexical 10, skills 10, location 10, modality 5 | Ninguna institucional; criterio de ingeniería | Coordinación PyR |
| D2 | Perfil de programa como regla dura | `hard` (alterno permitido con 85) | AS-IS "Definir perfil académico requerido"; `BSIGA` por programa | Coord. Académica |
| D3 | Umbral de recomendación | 50 (solo marca `sobre_umbral`; no oculta opciones) | Ninguna; depende del backend | Coordinación PyR |
| D4 | Tipos de plaza publicables en SIGA | solo `Normal` | `Tipo de plaza` observado | Coord. Proyectos |
| D5 | Tipos de plaza válidos por tipo de directa | MO→{MO, Normal}; CE→{CE, Normal}; Conv→{Conv, Conv. Unibagué} | Inferido del AS-IS | Coord. Proyectos |
| D6 | ¿Reservar cupo de propuestas directas antes de publicar SIGA? | sí | AS-IS: directas se consolidan antes de cargar SIGA | Coordinación PyR |
| D7 | ¿Casos pendientes reciben recomendaciones SIGA? | no | Conservador | Comité de casos especiales |
| D8 | Prioridad entre tipos de directa cuando compiten por cupo | ninguna (óptimo conjunto: máx. casos, luego compatibilidad) | Sin regla documentada | Comité |
| D9 | Mapeo de `RESPUESTA CE` / `Seleccionado` / `Morigen` a `Estado_Aprobacion` | pendiente | Dominios no leídos (sensibles) | Coord. Académica |
| D10 | Elegibilidad (`Habilitado`): fuente oficial (`Remanentes`, matrícula) | insumo ya validado (defecto SI) | `Remanentes.Habilitado para A2027` observado | Registro académico |
| D11 | Uso de municipio de origen como componente blando | sí, peso 10 | Disponible; no es atributo protegido, pero proviene de dirección | Protección de datos |
| D12 | Backend semántico por defecto | TF-IDF; embeddings locales recomendados tras aprobación | Benchmark sintético | TI / Protección de datos |
| D13 | Fuentes de etiquetas aceptadas para entrenar | `REVISION_EXPERTA_PAR`, `EVALUACION_RESULTADO_VALIDADA` | Rechazo de asignaciones históricas (sesgo) | Coordinación PyR |
| D14 | ¿`Ev. Plazas` puede ser señal de resultado? | no, hasta validar | Mide calidad de plaza, no ajuste estudiante-plaza | Coordinación PyR |
| D15 | Retención de salidas y registros de modelos | fuera de git; definir plazo | Ley 1581/2012 (habeas data) | Protección de datos |
| D16 | Transiciones de aprobación (propuesta → confirmada) | la institución re-ingresa la decisión como `Ubicacion_Confirmada=SI` | — | Coordinación PyR |
| D17 | Estrategia de evaluación | partición temporal (periodos previos → último), AUC/P@k/R@k/NDCG@k, violaciones = 0, auditoría por programa/municipio | — | Equipo + Coordinación |

## Decisiones añadidas en v0.3 (12-nov-2026) — todas PROVISIONALES
| ID | Decisión | Valor provisional | Evidencia | Responsable sugerido |
|---|---|---|---|---|
| D18 | Plaza sin perfil académico con regla de perfil `hard` | `missing_vacancy_profile = block` (bloqueo `PERFIL_PLAZA_NO_VERIFICABLE`); alternativa `review` = permitida con alerta `REQUIERE_REVISION_PERFIL` | v0.2 dejaba pasar parejas inverificables | Coord. Académica |
| D19 | Pesos `hybrid-pyr-v0.3` | program 30, semantic 30, requirements 10, interests 5, lexical 10, location 10, modality 5, historical 0 | Criterio de ingeniería; **no aprendidos** | Coordinación PyR |
| D20 | Uso de la señal de comportamiento histórico | peso 0 (desactivada); experimental | Refleja decisiones pasadas, no idoneidad | Coordinación PyR + Comité |
| D21 | Activación de modelos supervisados | nunca automática (`training.auto_activate=false`); requiere `--approved-by` y política compatible | Salvaguarda | Coordinación PyR |
| D22 | Reconstrucción de cupos históricos | `none` por defecto; `approved_column` solo con confirmación del significado de `Aprobados` | B2 | Coord. Proyectos |
| D23 | Backend semántico por defecto | TF-IDF (sin dependencias). Embeddings locales MiniLM recomendados: top-1 0,767 vs 0,30 en benchmark sintético de paráfrasis (30 pares) | `benchmarks/semantic_benchmark.py` | TI / Protección de datos |
| D24 | Clave de seudonimización histórica | secreto institucional fuera de git; rotarla invalida la continuidad de IDs | Ley 1581/2012 | Protección de datos |
