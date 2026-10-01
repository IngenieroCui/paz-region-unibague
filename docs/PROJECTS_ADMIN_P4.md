# Projects + Admin · P4

Implementación aditiva sobre P1/P2/P3. No importa Matching, no modifica Assignments ni Process y no modifica migraciones anteriores. Los datos de producción provienen exclusivamente de Supabase.

## Superficies

- Organization: `/app/organization/projects`, `/projects/new`, `/projects/:projectId`. Selección de organización mediante membresías activas persistidas; `?organization=` solo selecciona una membresía disponible. Miembros consultan; managers editan. La navegación central conserva la selección.
- Admin: resumen, estudiantes/lista/detalle, organizaciones/lista/detalle, proyectos/lista/detalle, usuarios y roles, configuración y catálogos, auditoría. Matching y Asignaciones conservan placeholders P5/P6.
- Las rutas se cargan de forma diferida; los previews P1 se mantienen separados de la navegación productiva.

## Projects

El formulario separa General, Contexto y Plazas → Perfil requerido. Cada sección se guarda de forma independiente con confirmación de éxito/error; no se presenta como una transacción de todo el proyecto. Primero se crea el proyecto en borrador; después se añaden plazas, programas, habilidades requeridas/deseables y requisitos obligatorios/deseables con orden y descripción. Capacidad positiva entera validada en cliente y por constraints existentes.

`projectStates` centraliza labels provisionales: draft, submitted, changes_required, approved y closed. Un manager crea únicamente draft y puede editar draft/changes_required o enviar submitted. Solo ADMIN decide aprobación/cierre. La migración protege identidad, autor y estados frente a llamadas directas, congela proyecto/plazas/perfil durante revisión y bloquea borrado de solicitudes enviadas. Los triggers de hijos bloquean la fila del proyecto para serializar una edición con el envío concurrente. RLS P2/P3 continúa validando roles y membresías.

Las listas usan filtros y rangos de 25 filas con conteo exacto. Capacidad total se agrega en servidor por lote de hasta 25 proyectos con RLS; no hay una consulta por fila ni truncamiento por el límite REST. El detalle pagina plazas y carga sus relaciones por lotes.

## Admin

El dashboard agrega registros reales en SQL, incluyendo participación/elegibilidad del periodo actual, capacidad y pendientes; presenta enlaces para configurar catálogos faltantes. Los estados de participación permanecen text: no se inventa un workflow institucional.

Estudiantes: búsqueda de identidad/código en servidor, filtros de programa/semestre/estado/periodo/elegibilidad y paginación. El detalle consulta UserProfile, Student, experiencia, habilidades, intereses, preferencias, enlaces, documentos y participaciones. Admin corrige campos profesionales y metadata de identidad mediante whitelist. La escritura de Student y UserProfile son dos operaciones: un fallo de identidad se comunica explícitamente como parcial. Elegibilidad nunca se deriva de completitud y requiere confirmación por periodo.

Organizaciones: filtros de estado/tipo/municipio/verificación, documentos y contacto principal; detalle del perfil, membresías, historial, documentos y proyectos. Corrección de perfil por whitelist; revisión y verificación transaccionales. No se accede a `auth.users` desde browser. Documentación reutiliza DocumentsPanel y el servicio privado P3, incluyendo firmas temporales, compensación y confirmación de eliminación.

Catálogos: AcademicPeriods, AcademicPrograms, Municipalities, OrganizationTypes y Skills. Alta/edición y desactivación para catálogos con active; solo se pueden eliminar periodos no actuales y sin referencias históricas (FK RESTRICT). El cambio de periodo actual se hace por una sola RPC. Configuraciones JSON y flags usan claves reales, sin precarga ficticia; editar, crear y eliminar configuración requiere acciones explícitas. Flags no autorizan acceso.

Usuarios: UserProfiles/Roles/UserRoles exclusivamente. Asignar o retirar ADMIN exige escribir ADMIN y confirmar. La protección del último administrador reside en PostgreSQL, incluso frente a SQL directo, cambios de role_id/user_id y cascadas; la identidad de los tres roles del sistema es inmutable.

Auditoría: lectura ADMIN paginada, filtros de fecha (límites America/Bogota), actor UUID, acción y tabla. Presenta actor, entity_id y changed_fields; no reconstruye valores anteriores ni escribe logs desde el cliente.

## Migración 202610010006

| API/protección | Autorización y comportamiento |
| --- | --- |
| pyr_unibague_review_organization(uuid,text,text) | SECURITY DEFINER, search_path vacío, ADMIN persistido + auth.uid. Valida decisión/existencia, bloquea organización, inserta revisión y actualiza estado/verificación en una transacción. Revocar aprobación limpia verified_at/by. |
| pyr_unibague_set_current_academic_period(uuid) | SECURITY DEFINER, ADMIN persistido, valida existencia y serializa cambios con lock de tabla. Desmarca actual y marca solicitado respetando índice parcial. |
| keep_last_admin | Trigger SECURITY DEFINER sin bypass. Actualiza/bloquea la fila de rol ADMIN para serializar cambios, incluyendo errores de serialización bajo aislamiento fuerte. Impide retirar el último rol. |
| keep_system_roles | Bloquea renombrar/eliminar/cambiar UUID de ADMIN/STUDENT/ORGANIZATION. No crea usuarios ni roles privilegiados. |
| protect_project_state / protect_project_child | Triggers complementan RLS sin cambiar policies anteriores; congelan solicitudes enviadas y previenen autoaprobación. |
| pyr_unibague_admin_dashboard | SECURITY INVOKER + ADMIN, agregados sobre tablas con RLS. |
| pyr_unibague_admin_students | SECURITY INVOKER + ADMIN, búsqueda/paginación de identidad sin FK directa entre UserProfiles y Students. |
| pyr_unibague_project_totals | SECURITY INVOKER, agregado de capacidad por lote bajo RLS existente. |

Todas las RPC públicas P4 revocan EXECUTE de PUBLIC/anon y lo conceden solo a authenticated. Los triggers privados no son endpoints REST. No se añaden tablas, enums, seeds, algoritmos ni asignaciones.

`database.types.ts` añade exclusivamente firmas reales P4 y sigue siendo fallback sincronizado, no generado por CLI. Conservar firmas adicionales del agente P5 al integrar.

## Validación reproducible

```powershell
npm run typecheck
npm run lint
npm test
npm run build
node tests/run-p4-e2e.mjs
git diff --check
# Supabase real, cuando esté disponible:
supabase test db
# Suplementario con PGlite instalado fuera del repo o resoluble por Node:
$env:PYR_PGLITE_MODULE = 'file:///ruta/a/pglite/dist/index.js'
node tests/sql/run-p4-wasm.mjs
```

El runner WASM aplica únicamente P2/P3/P4 desde cero y valida 284 columnas/38 FKs del fallback. Ejecuta los tests pgTAP mediante stubs de aserción y auth/storage; no sustituye Supabase runtime. La fixture P2 de proyecto editable cambia de estado test a draft; conserva sus 67 aserciones. P4 añade servicios y recorridos reales del SDK contra HTTP aislado, comprobaciones responsive/axe/teclado y 61 aserciones SQL.

## Integración P5 y pendientes de puesta en marcha

El integrador debe reemplazar únicamente el placeholder `/app/admin/matching` por el workspace P5, conservar router/navigation P4 y combinar firmas RPC en el fallback. No hay imports P5 desde P4. Assignments permanece pendiente P6.

Continúa pendiente configurar una instancia Supabase, aplicar migraciones, regenerar tipos mediante CLI, ejecutar pgTAP/RLS/Storage y concurrencia en PostgreSQL/Supabase real, cargar catálogos/periodos institucionales y validar los estados/workflows con Unibagué. No se afirma despliegue productivo ni PASS remoto.
