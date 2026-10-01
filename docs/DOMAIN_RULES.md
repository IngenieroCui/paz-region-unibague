# Reglas de dominio

## Confirmado
- Programa Paz y Región, Universidad de Ibagué; stack/arquitectura existentes.
- Supabase único backend, identidad Auth real y UserRoles multirrol STUDENT/ORGANIZATION/ADMIN.
- Core Schema v0, nombres literales quoted PYRUnibague_; relaciones estudiantes/periodos, organizaciones/membresías, proyectos/plazas, matching y asignaciones.
- RLS por propietario, gestión por can_manage y rol global, matching admin-only, notificaciones propias, auditoría técnica sin valores, Storage privado.
- Elegibilidad de participación y activación administrativa solo ADMIN; los campos académicos del perfil son editables y no establecen elegibilidad. Source MATCHING/MANUAL es origen técnico. OrganizationMembers.status='active' es marcador técnico de autorización, no decisión de aprobación institucional.
- Sin datos médicos/discapacidad, pgvector/embeddings, credenciales o catálogos institucionales ficticios.

## Provisional / pendiente de Unibagué
- Estados/transiciones institucionales, documentación exigida, revisión y publicación de proyectos, plazos, periodos, programas y municipios reales.
- Precarga/SSO, dominios institucionales y reglas institucionales definitivas de alta de organizaciones. Signup público deshabilitado; recuperación email/password implementada.
- Criterios/pesos/reglas de matching y algoritmo P5; decisión/capacidad/asignación transaccional P6.
- Proceso Paz y Región, evaluaciones, seguimiento, SIGA e integraciones.
- Consentimiento/retención y cualquier necesidad futura de datos sensibles, antes de crear campos.

Datos preview no son reglas, periodos ni estados persistidos. No inventar requisitos institucionales, diagnósticos, contactos o estadísticas. ADMIN tiene permisos técnicos iniciales; reglas institucionales definitivas deben aprobarse antes de habilitar sus flujos.

## P3 implementado

Onboarding técnico Organization con rol persistido, RPC atómica y membresía manager, sin autoverificación. pending_review es provisional; los requisitos jurídicos no se inventan. Student edita perfil académico/profesional propio y consulta su participación; completitud UX no concede elegibilidad. Preferencias municipales no son restricciones de matching. CV se presenta explícitamente; experiencia/enlaces son opcionales y no se definen otros documentos obligatorios. Perfiles sensibles siguen excluidos.

## Extensión P4 · Projects + Admin

Estados técnicos provisionales de proyecto: draft, submitted, changes_required, approved y closed; labels centralizados, sin enum. Organization manager crea borrador, edita draft/changes_required y envía a revisión; ADMIN aprueba, pide cambios o cierra. DB congela proyecto/plazas/perfil durante revisión para miembros. Elegibilidad por periodo es una decisión ADMIN confirmada, independiente de completitud UX. Revocar aprobación de organización limpia verificación. Catálogos con active se desactivan; periodos actuales o referenciados no se eliminan. Workflows institucionales pendientes. Detalle: [PROJECTS_ADMIN_P4.md](PROJECTS_ADMIN_P4.md).
