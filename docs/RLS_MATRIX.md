# Matriz RLS v0
Todas las tablas propias tienen RLS. ADMIN significa rol persistido, no metadata. CRUD siempre sujeto a constraints y triggers de campos. anon no recibe acceso a tablas privadas.
| Recurso | STUDENT | ORGANIZATION | ADMIN |
| --- | --- | --- | --- |
| UserProfiles | Leer/editar propio; identidad ligada a Auth | Leer/editar propio; identidad ligada a Auth | CRUD |
| Roles | Leer catálogo | Leer catálogo | CRUD |
| UserRoles | Leer propios | Leer propios | CRUD |
| AcademicPeriods | Leer catálogo | Leer catálogo | CRUD |
| AcademicPrograms | Leer catálogo | Leer catálogo | CRUD |
| Municipalities | Leer catálogo | Leer catálogo | CRUD |
| OrganizationTypes | Leer catálogo | Leer catálogo | CRUD |
| Skills | Leer catálogo | Leer catálogo | CRUD |
| SystemConfigurations | Leer is_public (también anon) | Leer is_public (también anon) | CRUD |
| FeatureFlags | Leer is_public (también anon) | Leer is_public (también anon) | CRUD |
| Students | Crear/leer/editar propio; identidad/activación protegidas | — | CRUD |
| StudentPeriodParticipations | Leer propia | — | CRUD |
| StudentExperiences | CRUD propio | — | CRUD |
| StudentSkills | CRUD propio | — | CRUD |
| StudentInterests | CRUD propio | — | CRUD |
| StudentLocationPreferences | CRUD propio | — | CRUD |
| StudentDocuments | CRUD propio | — | CRUD |
| Organizations | — | Registro RPC P3; miembros leen, managers editan perfil; verificación protegida | CRUD |
| OrganizationMembers | — | Leer membresías de su organización | CRUD |
| OrganizationDocuments | — | CRUD manager propio | CRUD |
| OrganizationReviews | — | SELECT de su organización por membresía activa; sin writes | CRUD |
| Projects | — | Leer miembro / CRUD manager de organización propietaria | CRUD |
| ProjectPositions | — | Leer miembro / CRUD manager de organización propietaria | CRUD |
| ProjectPositionPrograms | — | Leer miembro / CRUD manager de organización propietaria | CRUD |
| ProjectRequirements | — | Leer miembro / CRUD manager de organización propietaria | CRUD |
| ProjectPositionSkills | — | Leer miembro / CRUD manager de organización propietaria | CRUD |
| MatchingConfigurations | — | — | CRUD |
| MatchingRuns | — | — | CRUD |
| MatchCandidates | — | — | CRUD |
| Assignments | Leer propias | Leer plazas de su organización | CRUD |
| AssignmentEvents | — | — | CRUD |
| Notifications | Leer propias / RPC read_at | Leer propias / RPC read_at | Leer propias / RPC read_at; sin escritura arbitraria |
| AuditLogs | — | — | Solo leer (trigger escribe) |
## Storage y funciones
| Recurso | STUDENT | ORGANIZATION | ADMIN |
| --- | --- | --- | --- |
| student-documents | CRUD paths de Student propio | — | CRUD |
| organization-documents | — | CRUD manager propia | CRUD |
| current_roles / ownership helpers | Ejecutar authenticated | Ejecutar authenticated | Ejecutar authenticated |
| mark_notification_read | Solo propia | Solo propia | Solo propia |

Sin INSERT/UPDATE/DELETE directo de Assignments o AssignmentEvents desde authenticated, incluido ADMIN (010); escrituras solo por RPC administrativa. Sin escritura cliente en AuditLogs; sin UPDATE genérico Notifications. Matching solo ADMIN, sin scores globales para otros roles. Escrituras OrganizationReviews y lectura AssignmentEvents siguen ADMIN. P3 permite SELECT de revisiones a miembros activos de su entidad. Un miembro no puede insertar organizaciones/membresías directamente ni modificar can_manage; solo la RPC P3 crea su organización y membresía inicial tras validar el rol persistido.

Policies USING validan la fila existente; WITH CHECK la nueva fila. Helpers SECURITY DEFINER evitan recursión RLS, usan auth.uid() y rol persistido; search_path vacío y EXECUTE revocado de PUBLIC/anon. Helpers técnicos en schema privado no expuesto por REST. Triggers invoker protegen campos institucionales aun con un UPDATE de fila propia.

Pruebas pgTAP en supabase/tests/security.test.sql comprueban denegaciones, cambios de UUID, metadatos manipulados, campos protegidos, notificaciones, auditoría y Storage. Ejecutar en Supabase local antes de desplegar; el entorno actual carece de Docker/CLI y no certifica RLS runtime Supabase.

P3: registro SECURITY DEFINER exige auth.uid + rol ORGANIZATION persistido, con EXECUTE solo authenticated y sin policy INSERT genérica. RPCs de orden SECURITY INVOKER validan propietario y usan las policies P2. Los miembros no pueden cambiar status/verified_at/verified_by/created_by; los triggers P2 siguen activos.

## Extensión P4 · Projects + Admin

No se reemplazan policies P2/P3. Triggers adicionales limitan los writes ya autorizados: Organization manager solo crea draft, edita draft/changes_required y envía submitted; miembros sin can_manage no escriben. Ningún miembro puede autoaprobarse ni alterar plazas/perfil de proyectos en revisión. ADMIN mantiene gestión operativa. Nuevas RPC revocan PUBLIC/anon y conceden EXECUTE solo authenticated, con validación ADMIN para revisión/periodo/dashboard/estudiantes. Totales de proyectos son SECURITY INVOKER bajo RLS. Hay 61 aserciones P4 preparadas en supabase/tests/p4.test.sql; el PASS WASM es suplementario. Detalle: [PROJECTS_ADMIN_P4.md](PROJECTS_ADMIN_P4.md).

## P6/P7 integrado

| Recurso | ADMIN | ADVISOR | ORGANIZATION | STUDENT |
| --- | --- | --- | --- | --- |
| Asesorías históricas | Lectura; cambio por RPC persistida | Solo responsabilidades vigentes propias | Solo asesor vigente de su organización | Solo nombre de su asesor por proyección |
| Convocatorias/equipos | Gestión auditada | Sin acceso genérico adicional | Membresía propia; escritura con can_manage | Sin acceso genérico |
| Ficha institucional RPC 011 | Permitido | Proyecto autorizado por responsabilidad | Organización titular propia | Denegado |
| Proyección estudiantil RPC 011 | Denegado salvo rol STUDENT y estudiante propio | Denegado salvo rol STUDENT y estudiante propio | Denegado salvo rol STUDENT y estudiante propio | Solo asignación confirmada propia y compañeros del mismo grupo |
| Matching / snapshot / confirmación | Permitido, decisión explícita | Denegado | Denegado | Denegado |

Las proyecciones SECURITY DEFINER de 011 comprueban auth.uid y autorización persistida, usan search_path vacío y EXECUTE solo authenticated. No amplían policies de identidades, documentos o candidatos. El helper transaccional permanece privado sin EXECUTE de authenticated. Auditoría de asesorías registra actor y campos, eventos de asignación conservan resultados de integración. Ver reportes P6-A/B/C y P6_INTEGRATION_REPORT para límites de pruebas simuladas y validación real pendiente.

012 agrega summary/export exclusivamente ADMIN y una proyección de equipos ADVISOR que filtra estudiantes por responsabilidad individual vigente, aun cuando el asesor tenga acceso a la organización del proyecto. Notifications conserva solo la policy propia: tampoco ADMIN puede leer mensajes ajenos ni emitir avisos arbitrarios. El trigger privado de AssignmentEvents crea avisos al estudiante destinatario en la misma transacción. Los enlaces incluyen el periodo. Se conserva mark-read idempotente propio. Sin ampliación de acceso a documentos, identidades, puntajes o Storage.
