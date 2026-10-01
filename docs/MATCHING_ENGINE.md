# Matching P5 · hybrid-v0.1

P5 recomienda compatibilidad Student ↔ ProjectPosition. No inserta ni actualiza Assignments/AssignmentEvents, no consume capacidad ni toma la decisión global de P6. Core Schema P2+P3 permanece autoritativo. Implementación pura única: `supabase/functions/_shared/matching/engine.ts`; Edge y tests importan el mismo cálculo. Cambiar fórmulas, normalización, stopwords o reglas exige una nueva versión, no reutilizar silenciosamente `hybrid-v0.1`.

## Pool y filtros duros

Periodo solicitado real. Estudiante activo con participación en ese mismo periodo y `eligible_for_matching=true`. Plaza activa con capacidad positiva y proyecto en el mismo periodo. Project.status y Organization.status no filtran. La capacidad delimita plazas válidas, no reserva cupos.

Antes del score: si hay programas `is_required=true`, el programa del estudiante debe estar en ese subconjunto; si falta, `ACADEMIC_PROGRAM_REQUIRED`. Coincidir con un programa opcional no supera un programa obligatorio diferente. Si `requiredSkillsAreHardConstraint=true`, cada habilidad requerida ausente produce `REQUIRED_SKILL_MISSING` con skill_id. Puede desactivarse para valorar dichas ausencias solo en skills. Geografía nunca bloquea. Requisitos libres aportan texto; no se inventa una comprobación binaria para cada requisito.

Pareja bloqueada: `is_eligible=false`, `total_score=null`. Se conservan componentes diagnósticos, bloqueos, recomendaciones y explicación. Sin bloqueos: `is_eligible=true` y total calculado.

## Configuración explícita

MatchingConfigurations: versión soportada, umbral numérico 0–100, exactamente siete pesos no negativos que sumen 100, máximo cuatro decimales por peso. Reglas JSON exactamente `{requiredSkillsAreHardConstraint:boolean, semanticEnabled:boolean}`; desconocidas se rechazan para no fingir su aplicación. Un academic_period_id null permite reutilizar una configuración entre periodos; en otro caso debe coincidir con el run. Solo configuraciones activas ejecutan.

La UI ofrece una **sugerencia editable**, no seed ni criterio institucional: academic 25, skills 20, experience 10, interests 10, location 10, preference 10, semantic 15; umbral 70. Habilidades duras true; envío semántico false hasta activación explícita. El cálculo siempre usa el umbral persistido.

## Fórmulas

| Componente | Fórmula y datos |
| --- | --- |
| academic | Sin programas asociados: unavailable. Programa en cualquier asociación: 100, sujeto primero a required. Solo opcionales y programa ausente: 0. Required incumplido: bloqueo, sin total. |
| skills | Sin habilidades solicitadas: unavailable. Coincidencia por skill_id. Required pesa 2; optional 1. `100 × peso solicitado coincidente / peso solicitado total`. Habilidades extra irrelevantes no aumentan este componente. |
| experience | Texto de experiencias: title, organization_name, description. Comparación textual contra target profesional. |
| interests | Texto de intereses: label, description, contra target profesional. |
| preference | Únicamente desired_work_description y bio, contra target. Intereses no se duplican aquí. |
| location | Proyecto sin municipio: unavailable. Preferencia n: `max(50,100−10×(n−1))` (1=100,2=90,3=80). Fuera de preferencias: municipio actual 70; origen 60; información geográfica existente sin coincidencia 40; ninguna información geográfica unavailable. 40 no significa prohibición. Preferencias tienen prioridad sobre actual/origen. |
| semantic | Opcional: `clamp(cosine(embedding_student,embedding_position),0,1) × 100`. Nunca sustituir ausencia o error por un score inventado. |

Target profesional: Project.name/summary/description, Position.title/description, Requirements.label/description y nombres de las Skills solicitadas.

Para experience/interests/preference: lowercase → Unicode NFD → retirar marcas diacríticas → conservar letras/números y tokenizar → descartar tokens menores de tres caracteres → eliminar lista fija común ES/EN en engine.ts → deduplicar y ordenar. Coseno sobre vectores binarios: `intersección / sqrt(tokensA × tokensB)`. Score `round(cosine × 100)`, clamp 0–100. Si cualquiera no tiene tokens: unavailable. Es coincidencia textual determinística, no IA.

Para cada componente se persisten `raw_score` (null cuando falta), `configured_weight`, `effective_weight` y `available`. Si W es la suma de pesos configurados disponibles, peso efectivo disponible = `peso_configurado × 100 / W`; unavailable recibe peso efectivo 0. No redondear pesos antes de sumar. Total = `Σ(raw_score × effective_weight / 100)`, redondeado a dos decimales. UI muestra una decimal. Si W=0, todos los pesos efectivos son 0, total 0 y recomendación `NO_WEIGHTED_EVIDENCE`; no puede redistribuirse peso sin evidencia positiva ponderada.

Recomendada si y solo si total no null y `total >= minimum_recommended_score`. El estado se deriva del snapshot del run y se registra como recomendación JSON; sin columna nueva. Total bajo umbral permanece visible. Ranking servidor descendente por total, nulos al final, id estable para empates; filtros por estudiante/plaza/elegibilidad/recomendación y páginas de 25. No es optimización global.

## Explicación y recomendaciones

Explicaciones determinísticas: programa asociado/no disponible; X/Y habilidades solicitadas; score territorial y orden si aplica; hasta tres componentes ≥75 con prioridad por peso efectivo; brechas disponibles <50; semántica disponible/no disponible y falta de evidencia. Texto usa “compatibilidad calculada”, no “la IA decidió”. Recomendaciones estructuradas identifican habilidad requerida faltante, programa obligatorio, pocas coincidencias en habilidades/experiencia/intereses y proyecto fuera de preferencias. Umbral histórico explícito. Cortes 50/75 describen brechas/fortalezas, no cambian filtros duros ni recomendación global. Nunca inferir salud, discapacidad, edad, género, personalidad u otros atributos sensibles.

## Semántica y privacidad

Solo Edge lee `PYRUNIBAGUE_AI_BASE_URL`, `PYRUNIBAGUE_AI_API_KEY`, `PYRUNIBAGUE_AI_EMBEDDING_MODEL`. Ninguno usa VITE_. Endpoint HTTPS OpenAI-style: BASE_URL (incluye /v1 cuando el proveedor lo necesita) + `/embeddings`, input string[], model y encoding_format=float. No redirecciones, credenciales en URL, query o fragment. Los nombres de las variables y el modelo se documentan; nunca se registran ni devuelven claves, URL secreta o errores crudos del proveedor.

Un texto por estudiante y uno por plaza; únicamente entidades con alguna pareja sin bloqueos; deduplicación global y lotes de 32 textos, no llamadas por pareja. Student semantic: bio, desired_work_description, experiencias, intereses, skill names/evidence. Target: contenido profesional descrito arriba. Los builders usan una whitelist explícita: no concatenan nombre personal, email, student_code, auth IDs, tax IDs, municipios, documentos ni CV binario. Los campos libres deben contener información profesional: la whitelist no es un sistema de extracción/redacción automática de PII en prosa.

**El CV PDF/DOCX no se analiza ni envía**. P3 guarda documentos privados; un extractor seguro y una política de tratamiento se definirán en otra fase. No pgvector y no persistencia de embeddings. Vector faltante, cero, no finito, dimensión inconsistente, índices repetidos o respuesta incompleta invalidan todo el lote semántico del run. Falta de secrets → warning `SEMANTIC_SETTINGS_MISSING`; fallo/proveedor/timeout → `SEMANTIC_PROVIDER_FAILED`; textos vacíos/largos tienen warning propio. Continúa structured_only y renormaliza. Tiempo máximo de proveedor: 20s por petición, 40s total. Textos mayores de 20.000 caracteres desactivan semántica en el run, sin truncar silenciosamente.

Referencias: [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [JWT y RLS en Edge](https://supabase.com/docs/guides/functions/auth-legacy-jwt), [contrato embeddings](https://developers.openai.com/api/reference/resources/embeddings/methods/create).

## Runs, seguridad e historial

POST `matching-run`, body exactamente `{academic_period_id: UUID, matching_configuration_id: UUID}`. JWT verificado con Auth.getUser; rol persistido consultado mediante current_roles, nunca metadata. started_by sale de la identidad verificada y DB lo reestablece con auth.uid. UUIDs validados, límite de body, métodos POST/OPTIONS. CORS por lista exacta `PYRUNIBAGUE_ALLOWED_ORIGINS`, separada por comas; sin wildcard. Sin Origin se permite llamada servidor, siempre con JWT y ADMIN. Respuestas no cacheables.

Usa cliente anon/public del proyecto **con Authorization del usuario** y RLS existente para lecturas/escrituras; ninguna service_role. No se cambian grants/policies P2. ADMIN-only para configuraciones, runs y candidatos. Leer pool paginado estable (500 filas, grupos de IDs de 100), agrupación por mapas. Crear run running, snapshot DB bajo lock de configuración, pool, filtros duros, semántica opcional, cálculo y batches de candidatos de 200, completed. Error crítico: failed + código técnico seguro; conservar candidatos parciales pero ocultarlos en ranking normal. Si falla la escritura de failed, respuesta recovery_required=true; no afirmar que se confirmó el estado final.

Summary incluye algorithm_version, configuration_snapshot lógico (periodo, versión, umbral, pesos, reglas), student_count, position_count, pair_count, eligible_pairs, blocked_pairs, recommended_pairs, below_threshold_pairs, semantic_mode, embedding_model, warnings y timing. evaluated_pairs/persisted_pairs permiten distinguir progreso parcial en fallo. Sin PII, textos profesionales, vectores ni secretos en summary.

Migración `202610010007_matching_p5.sql`: índice único parcial de running por periodo/configuración; índice de ranking; validación DB de configuraciones; trigger de inmutabilidad tras cualquier run, incluso fallido. Nombre/is_active gestionables. Duplicar para cambiar significado. Trigger de run exige summary object y bloquea cambio de id/snapshot/periodo/configuración, actor salvo FK SET NULL, cambios de runs terminados y eliminación de historial. CHECK NOT VALID exige en nuevas escrituras que total exista si y solo si is_eligible=true, sin reescribir filas históricas anteriores. Reruns después de completed/failed son válidos. Al instalar, dos runs running preexistentes con la misma combinación hacen fallar el índice: resolver sus estados administrativamente antes de aplicar, sin borrar histórico.

## Reproducibilidad y límites reales

Structured-only es determinístico para mismos inputs profesionales y snapshot; semántica depende del proveedor/modelo. Los scores/componentes/explicación se conservan, pero no snapshots de PII ni vectores, por lo que no se garantiza recalcular exactamente una ejecución después de editar perfiles/proyectos o actualizar el proveedor. Labels de estudiante/plaza en UI muestran registros actuales; significado y umbral históricos vienen del run.

Síncrono en Edge: máximo técnico 250.000 parejas y presupuesto de evaluación 100s desde inicio; volúmenes mayores fallan con código explícito. Antes de ampliar se necesita cola/checkpoints y consulta consistente. Lecturas del pool son paginadas, no una transacción snapshot global; evitar editar sus datos durante un run si se requiere coherencia estricta. Caída del proceso, límite del host, revocación de rol/JWT o error de red al finalizar puede dejar running; no reintentar ciegamente. ADMIN debe comprobar actividad/logs seguros y actualizar a failed conservando snapshot para liberar el índice. No hay reconciliador automático ni garantía de transacción única entre batches.

## Pruebas

Vitest: valores numéricos, bloqueos, umbral exacto, renormalización, municipios, determinismo, skills irrelevantes, normalización, whitelist, embeddings batching/fallos, JWT/RBAC/CORS, fallos parciales, servicios y UI. Playwright aislado en `tests/matching` ejercita el SDK contra HTTP simulado, confirmación, ejecución, ranking paginado, bloqueos, duplicación, responsive/axe y denegación. Harness únicamente DEV, sin ruta productiva ni imports del router.

`supabase/tests/p5_matching.test.sql`: pgTAP transaccional con fixtures revertidas, ADMIN/STUDENT/ORGANIZATION/anon, visibilidad de candidatos, índice de exclusión, duplicación, significado histórico y reruns. `tests/matching/wasm.mjs` aplica migraciones ordenadas y mismas aserciones con PostgreSQL WASM, stubs de auth/storage y shim de aserciones; no sustituye Supabase ni sesiones concurrentes reales. `node --test tests/matching/runtime.test.mjs` queda SKIPPED si faltan URL, clave pública, JWTs de cuentas aisladas e IDs de periodo/configuración; requiere instancia desechable de pruebas y conserva runs de prueba. Ver P5_INTEGRATION para comandos y validación.
