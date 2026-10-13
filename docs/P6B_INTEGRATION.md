# P6-B · Convocatorias, proyectos y equipos

Rama `feat/p6b-calls-projects`, base `b7502fe` (P4+P5). Ownership: `features/projects`, `features/calls`, `features/groups`, pruebas propias, este documento y migración reservada 009. Router, navegación, Auth, roles, self-service, matching, optimizer, tipos compartidos y migraciones 001–007 se conservan.

Se leyó el modelo maestro v0.4 añadido por el usuario en el checkout principal, `docs/Modelo_Datos_Paz_Region_v04.md`, SHA256 `7EB33B7B22740A9B54405F7A22E4DF4E17435BE843AA893871CF7C5ADC0CA76A`. No se copia ni modifica ese documento compartido en esta rama. No se insertan ejemplos de la ficha ni otros datos productivos.

## Rutas que registra A

Registrar dentro del shell autenticado existente, con los guards actuales. Los componentes tienen comprobaciones de acceso y usan el mismo cliente Supabase; la autorización definitiva reside en RLS.

| Ruta | Exportación pública | Uso |
| --- | --- | --- |
| `/app/organization/calls` | `OrganizationCallsPage` de `src/features/calls/index.ts` | Lista por organización activa; `?new=1&organization=<uuid>` abre creación |
| `/app/organization/calls/:callId` | `OrganizationCallsPage` | Detalle, edición, plazas, envío/publicación/cierre |
| `/app/admin/calls` | `AdminCallsPage` de `src/features/calls/index.ts` | Consulta global, filtros de institución/periodo/estado |
| `/app/admin/calls/:callId` | `AdminCallsPage` | Revisión administrativa y cambio de estado |
| `/app/organization/projects/:projectId/groups` | `GroupsPage` de `src/features/groups/index.ts` | Opcional: página autónoma de equipos |
| `/app/admin/projects/:projectId/groups` | `GroupsPage` | Opcional: página autónoma administrativa |

`ProjectsWorkspace` amplía las rutas P4 existentes: ficha imprimible, zona y panel de grupos integrado. No es necesario sustituir las rutas de proyectos para disponer de los equipos. Mantener selección `?organization=` al navegar en Organization. El integrador añade los enlaces de Convocatorias en navegación; esta rama no los registra.

Para lazy loading, seleccionar el named export del módulo como `default`, siguiendo el patrón del router actual. Usar el `UnsavedChanges` existente; no crear otro router, shell o proveedor productivo. El router de `tests/p6b/harness.mjs` es exclusivamente de prueba y no entra en el build.

## Unión con A: asesor e interlocutor

`src/features/projects/index.ts` exporta `InstitutionalReader`, `InstitutionalRelations`, `InstitutionalPerson`, `ProjectsWorkspace` e `InstitutionalSheet`.

```tsx
const readInstitutional: InstitutionalReader = async project => {
  // A implementa la consulta autorizada de sus tablas y devuelve IDs + nombres.
  // Interlocutores: ProjectInterlocutors → OrganizationContacts.full_name.
  // Asesor: organization_id + academic_period_id → AdvisorOrganizationAssignments
  // vigente → StaffProfiles → UserProfiles.display_name.
  return { availability: 'available', interlocutors: [], advisors: [] }
}
<ProjectsWorkspace readInstitutional={readInstitutional} />
```

El ejemplo define la forma del adaptador; no es una consulta productiva. A debe sustituir el cuerpo por sus relaciones reales y mantener estable la función para evitar recargas innecesarias.

El reader recibe `{id, organization_id, academic_period_id}`. Devuelve personas con `{id, displayName: string | null}`. El lector predeterminado declara `not_integrated`, devuelve arrays vacíos y **no consulta tablas inexistentes**. Se muestra «Sin registrar» y una indicación de integración pendiente; no se fabrican nombres. Un reader integrado debe devolver `not_integrated` únicamente cuando sus tablas aún no estén disponibles, sin ocultar errores de permiso o conexión.

No se crean tablas de A, ni imports de archivos futuros. El nombre de institución titular, municipio y semestre proceden de las relaciones de Projects. El semestre visible usa `AcademicPeriods.code`. Instituciones colaboradoras adicionales y docente técnico no forman parte de este bloque.

## Unión con C: asignaciones confirmadas

Contrato provisional explícito: un integrante puede incorporarse solo si su Assignment tiene `status='confirmed'`, `is_active=true`, `unassigned_at IS NULL`, pertenece a una plaza del mismo proyecto y al mismo periodo. C debe conservar esa convención o coordinar un cambio coherente antes del merge.

Este módulo **no crea Assignments**. `pyr_unibague_project_team(uuid)` devuelve únicamente grupos, membresías e identidades mínimas de asignaciones confirmadas o con historial en el proyecto. Nombres y programas se derivan de Students/UserProfiles/AcademicPrograms en cada lectura. No se copian en Projects, Groups ni GroupMembers.

El helper privado del roster es SECURITY DEFINER porque las policies existentes no dan a Organization lectura general de Students/UserProfiles. Comprueba `auth.uid()` y ADMIN persistido o membresía de la entidad del proyecto antes de leer. No expone emails, documentos, perfil profesional ni datos de otros proyectos. El wrapper público es SECURITY INVOKER; EXECUTE solo authenticated. No se cambian las policies compartidas de identidad.

C debe finalizar una asignación mediante UPDATE. El trigger 009 retira automáticamente sus membresías activas en la misma transacción si queda inactiva, deja de estar confirmada o recibe `unassigned_at`. La fecha de salida nunca precede al ingreso. El historial no se borra ni se reactiva: reincorporar crea otra membresía.

Una Assignment con historial de equipo no puede cambiar estudiante, plaza o periodo. Para reasignar, C debe cerrar la asignación anterior y crear otra. Las FK RESTRICT conservan asignaciones, grupos y proyectos referenciados. No eliminar/reemplazar estos triggers al integrar 010.

## Migración y contrato temporal

`supabase/migrations/202610010009_calls_projects_groups_p6b.sql` añade exactamente las cuatro tablas v0.4 y `Projects.zone_type` nullable (`rural`/`urban`). No depende de 008 ni 010. Aplicar aditivamente después de las migraciones previas, coordinando el historial con el integrador. No se aplicó a ninguna base remota. La CLI Supabase no está instalada aquí; se conserva el nombre reservado 009 solicitado por el usuario.

- Calls: 10 columnas v0.4, fechas opcionales coherentes, título no vacío, FK de entidad/periodo.
- CallPositions: 5 columnas v0.4, UNIQUE(call_id, project_position_id), sin capacidad. Trigger valida entidad y periodo, bloqueando convocatoria, plaza y proyecto para serializar cambios.
- Groups: 7 columnas v0.4, varios por proyecto, nombre único normalizado dentro del proyecto, fecha de inicio opcional.
- GroupMembers: 8 columnas v0.4, fechas coherentes, un índice parcial permite una sola membresía activa por Assignment. Su trigger bloquea la asignación antes de validar/integrar, serializando la incorporación con una desasignación y con otros equipos.

Guards inversos impiden mover plazas referenciadas, equipos o cambiar entidad/periodo de proyectos con vínculos de convocatoria/equipo. El cambio de periodo de una convocatoria requiere retirar primero sus plazas. La identidad de la convocatoria no cambia de entidad. No se puede publicar/enviar sin plazas ni retirar la última plaza de una convocatoria abierta/enviada.

RLS: ADMIN consulta/gestiona globalmente; miembros activos de Organization consultan solo su entidad; `can_manage` autoriza escritura. Sin acceso STUDENT/anon a las cuatro tablas. No se concede DELETE de Calls/Groups/GroupMembers a authenticated: se cierran/retiran conservando historial. Solo CallPositions permite quitar un vínculo bajo autorización y guards. Auditoría central registra operaciones/campos, sin valores. Todas las tablas tienen índices de FK, RLS y timestamps.

Los tipos de Calls/CallPositions y Groups/GroupMembers se definen estrictamente dentro de sus adaptadores de servicio. Projects amplía localmente su tabla con `zone_type`. Las aserciones del límite del SDK reutilizan el cliente autenticado existente: no crean otro cliente ni amplían permisos. El roster JSON se valida en runtime. Sin `any`, `@ts-ignore` ni edición de `database.types.ts`. Después del merge, el responsable único regenera los tipos y sustituye estas extensiones locales.

## Comportamiento y límites

Estados provisionales de convocatoria: draft, submitted, changes_required, open, closed. Organization crea draft, edita draft/changes_required y puede enviar o publicar; después solo cerrar. ADMIN puede revisar/cambiar el estado. La publicación directa no representa una aprobación institucional oficial. Estados de grupo: active/closed; de membresía: active/inactive. Cerrar un grupo conserva su roster y permite retiros explícitos; no crea ni mueve estudiantes.

Una convocatoria puede vincular plazas de varios proyectos de su misma entidad/periodo. Una plaza admite varios programas compatibles, pero su capacidad cuenta una sola vez. Para 2 cupos Sistemas y 1 Mecánica se crean dos ProjectPositions. La lista muestra capacidad por convocatoria y capacidad **única** de las plazas de la página para evitar sumar dos veces plazas repetidas entre convocatorias. Ningún flujo escribe capacidad en CallPositions ni realiza postulaciones estudiantiles.

Listas de convocatorias paginadas a 25 filas; relaciones paginadas en lotes y consultas de IDs a 100 para evitar truncamiento REST/URLs demasiado largas. La ficha carga todas las plazas del proyecto, independientemente de la página de edición P4. Fechas de convocatoria se introducen en hora Colombia y se envían como instantes UTC. La impresión oculta formularios y controles, manteniendo ficha, plazas y equipos. La ficha se actualiza tras editar proyecto/plazas/equipos.

Zona es información geográfica; no asigna asesores ni modifica matching. No se construyen planes, objetivos, cronogramas, entregables, actividades, matrícula, archivos nuevos de A/C, integración Drive o workflows institucionales adicionales.

## Verificación reproducible

Desde la raíz del worktree:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
node tests/p6b/run-e2e.mjs
node tests/run-p4-e2e.mjs --project auth
git diff --check
node --test tests/p6b/remote.test.mjs
# SQL suplementario, módulo externo sin cambiar package.json:
$env:P6B_PGLITE_MODULE = 'file:///ruta/a/pglite/dist/index.js'
node tests/p6b/wasm.mjs
```

El runner E2E P6B usa puerto exclusivo 5396 y HTTP aislado con el SDK real. Verifica UI → requests → estado de fixture → respuesta → renderizado; **no equivale a PostgREST real**. El runner arranca/cierra hijos Node directamente, sin reutilizar servidores ajenos. Pruebas de navegador: múltiples plazas/proyectos, cupos, estados, revisión ADMIN, equipos, retiro e historial, ficha actualizada, impresión, lectura sin gestión, empty/error/retry/teclado, responsive 320/768/1440 y axe WCAG.

SQL reproducible en `tests/p6b/database.test.sql`, transacción revertida con pgTAP. Sobre una base **aislada** real ya migrada y con pgTAP/driver `pg` disponibles, configurar `P6B_DATABASE_URL` y, si es necesario, `P6B_PG_MODULE`, y ejecutar el runner remoto. Sin esa variable devuelve SKIPPED explícito. El runner nunca aplica migraciones ni seeds.

Resultados finales y evidencia de QA: ver `P6B_VALIDATION.md`. La ejecución WASM emplea stubs de auth/storage y aserciones compatibles con pgTAP; no certifica Supabase Auth, PostgREST, caches de esquema, grants del runtime, ni concurrencia entre conexiones. Las pruebas remotas y concurrencia real permanecen SKIPPED. Antes de producción, ejecutar pgTAP/RLS sobre Supabase real y verificar en dos conexiones incorporación simultánea y desasignación concurrente, conservando las garantías de locks/índice único. No se declara despliegue productivo.

Referencia de seguridad consultada: [Supabase · Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
