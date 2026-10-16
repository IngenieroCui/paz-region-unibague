# P6-A · Personal, asesores e interlocutores

Implementación sobre P4+P5, base `b7502fe`, rama exclusiva `feat/p6a-advisors`. Fuente: `Modelo_Datos_Paz_Region_v04.md`, cargado por el usuario en `docs` del checkout original. No se alteran las migraciones 001–007 ni las features de Projects, Matching, Assignments, Calls o Groups.

## Migración y contrato

Aplicar `supabase/migrations/202610010008_advisors_contacts_p6a.sql` después de 007 y antes de 009/010. El prefijo mantiene el orden del repositorio; no renombrar a un timestamp que coloque 008 después de las migraciones de B/C. No se ha aplicado a una instancia remota.

Crea exactamente las ocho tablas y columnas del diccionario v0.4:

- `PYRUnibague_StaffProfiles`: identidad de personal única por `user_id`; código interno único opcional, teléfono, unidad y estado.
- `PYRUnibague_OrganizationContacts`: contactos múltiples, usuario opcional, índice único parcial de principal por organización.
- `PYRUnibague_AdvisorOrganizationAssignments`: historial por organización/periodo; índice único parcial de `is_current`.
- `PYRUnibague_AdvisorStudentAssignments`: historial por participación; índice único parcial de `is_current`; origen opcional en Assignments. El actor del cambio se registra en AuditLogs porque el modelo no define `assigned_by` en esta tabla.
- `PYRUnibague_StudentSpecialCases`: código abierto, municipio opcional, estado, revisor y fundamento administrativo mínimo.
- `PYRUnibague_ProjectTechnicalTeachers`: relación opcional y única proyecto/docente.
- `PYRUnibague_ProjectInterlocutors`: contacto de la organización titular, relación única, máximo un principal operativo por proyecto.
- `PYRUnibague_ProjectParticipatingOrganizations`: relación única proyecto/colaborador; no puede repetir al titular. Tiene solo `created_at`, tal como indica v0.4.

Única columna agregada a tablas existentes: `StudentPeriodParticipations.arl_provider_name text NULL`. Sus políticas existentes permiten escritura solo a ADMIN. No se agregan campos ni documentos de matrícula, certificados ARL, seguimiento académico o entregables. `Projects.zone_type` corresponde a B.

Se añaden FK con nombres `pyr_p6a_*`, índices para sus columnas, RLS, grants explícitos, timestamps y auditoría de nombres de campos (sin valores). Referencias históricas usan RESTRICT; actores opcionales usan SET NULL; las relaciones de ficha son hijos con CASCADE desde Projects. Se protege el cambio de organización del proyecto para impedir contradicciones con sus relaciones existentes. Los contactos y las identidades de Staff no pueden moverse entre propietarios.

`status='active'` en Staff es un marcador técnico de habilitación, no una aprobación institucional. Los tipos y estados de casos especiales permanecen como texto abierto. No se crean catálogos, diagnósticos ni categorías definitivas.

Los tipos de `src/lib/supabase/database.types.ts` siguen siendo el fallback estricto del repositorio. El smoke SQL verifica sus 350 columnas y 19 FK nuevas; no afirmar que fueron generados por CLI. Regenerarlos desde el esquema integrado cuando exista Supabase.

## Identidad y autorización

ADVISOR se incorpora al catálogo existente como «Asesor regional». No se asigna a usuarios automáticamente. Un administrador usa `/app/admin/users` para otorgarlo en UserRoles; registrar Staff o vincular un contacto nunca otorga permisos. Se conserva el mismo SDK, AuthProvider, RPC `pyr_unibague_current_roles`, selección multirrol y RequireRole. ADMIN continúa como coordinación administrativa; no existe COORDINATOR ni workspace de docente técnico. ADVISOR se incluye en la protección de identidad de roles del sistema.

El pequeño ajuste en `PreviewRoutes.tsx` evita que el nuevo rol caiga en la preview de ADMIN por el antiguo ternario de tres roles. Muestra el estado de desarrollo existente, sin usuarios ni datos ficticios de asesoría productiva.

| Recurso | ADMIN | ADVISOR | ORGANIZATION | STUDENT/anon |
|---|---|---|---|---|
| Staff | Gestionar | Consultar perfil propio | Sin acceso | Sin acceso |
| Historial de responsabilidades | Leer; cambiar solo por RPC | Leer filas propias vigentes, con rol y Staff activo | Responsabilidad vigente de sus organizaciones | Sin acceso |
| Contactos | Gestionar | Solo proyección necesaria en workspace | Miembro activo consulta; manager gestiona propios | Sin acceso |
| Casos especiales | Gestionar; revisor derivado de auth.uid | Sin acceso | Sin acceso | Sin acceso |
| ARL | Editar nombre | Sin acceso agregado | Sin acceso agregado | Estudiante conserva lectura propia; sin escritura |
| Relaciones de ficha | Gestionar | Consultar solo proyectos asociados | Consultar propios; gestionar con can_manage y estado editable de proyecto | Sin acceso agregado |
| Documentos privados | Permisos anteriores | Sin permisos nuevos | Permisos anteriores | Permisos anteriores |

Las funciones privilegiadas tienen `search_path=''`, referencias calificadas, autorización persistida y EXECUTE revocado a PUBLIC/anon. Los helpers se alojan en el schema privado. Guardas de UI y selección del espacio no sustituyen RLS.

## RPC y endpoints

Los endpoints son los RPC estándar de PostgREST (`/rest/v1/rpc/<nombre>`), autenticados con la sesión del usuario. No hay Edge Function nueva ni service_role en el cliente.

| RPC | Argumentos | Retorno / autorización |
|---|---|---|
| `pyr_unibague_change_organization_advisor` | `p_organization_id uuid`, `p_academic_period_id uuid`, `p_advisor_id uuid NULL`, `p_starts_on date DEFAULT current_date` | UUID nuevo/vigente o NULL al retirar; ADMIN |
| `pyr_unibague_change_student_advisor` | `p_participation_id uuid`, `p_advisor_id uuid NULL`, `p_starts_on date DEFAULT current_date`, `p_reason text NULL`, `p_source_assignment_id uuid NULL` | UUID nuevo/vigente o NULL al retirar; ADMIN |
| `pyr_unibague_save_organization_contact` | `p_organization_id uuid`, `p_full_name text`, `p_id uuid NULL`, `p_position_title text NULL`, `p_email text NULL`, `p_phone text NULL`, `p_user_id uuid NULL`, `p_is_primary boolean DEFAULT false` | UUID; ADMIN o manager de organización, SECURITY INVOKER bajo RLS |
| `pyr_unibague_advisor_workspace` | `p_academic_period_id uuid` | JSON `{organizations, students, projects}`; ADVISOR con Staff activo |

Las dos RPC de responsabilidad son transaccionales. La de organización bloquea el padre Organizations antes de leer/finalizar la responsabilidad, incluso si todavía no existe historial; serializa también periodos distintos de esa misma organización. La individual bloquea StudentPeriodParticipations. No basta un lock de la fila vigente, que no existe en la primera asignación. Los índices parciales son una defensa adicional. Las escrituras directas de historiales se revocan a authenticated, incluido ADMIN. Los triggers también impiden reescribir/eliminar historia mediante SQL privilegiado.

La fecha de cambio cierra la fila anterior e inicia la nueva; ambas pueden compartir el día. No se permiten responsabilidades futuras marcadas como vigentes, cambios anteriores al inicio vigente ni reactivaciones de filas cerradas. Solicitar el mismo asesor de organización es idempotente. En estudiantes, cambios de motivo/origen con el mismo asesor crean una fila histórica nueva; repetir idénticos argumentos es idempotente. NULL finaliza sin crear otra fila. Un error revierte toda la operación.

Para recibir responsabilidad vigente, Staff debe estar activo y su usuario debe tener ADVISOR en UserRoles. Revocar el rol o inactivar Staff corta el acceso del asesor inmediatamente; las filas históricas se conservan. El origen individual debe coincidir con estudiante y periodo, incluso en inserciones privilegiadas. No se propaga ningún cambio de organización a estudiantes.

La proyección del asesor consulta únicamente el periodo solicitado. Organizaciones provienen de sus responsabilidades de organización; estudiantes, de sus responsabilidades individuales. Los proyectos se autorizan mediante cualquiera de esas responsabilidades: organización vigente o asignación activa de un estudiante asesorado en el mismo periodo. Así el asesor individual puede seguir consultando el proyecto de su estudiante cuando cambia el asesor de la organización, sin adquirir esa responsabilidad de organización.

La proyección incluye nombre, programa/semestre, presentación/trabajo deseado, experiencias, habilidades/intereses y contactos operativos necesarios. Excluye códigos de estudiante, Auth IDs, correo del perfil del estudiante, ARL, datos tributarios, documentos, enlaces del perfil y decisiones confidenciales. No añade políticas amplias a Students/UserProfiles/Storage. El adaptador valida JSON y descarta atributos inesperados. La UI pagina los resultados a 25 y ofrece búsqueda; los datos administrativos se leen en lotes paginados, con filtro del periodo.

## Rutas y exports

- `/app/advisor`: inicio con contadores reales del periodo.
- `/app/advisor/organizations`, `/students`, `/projects`, `/profile`: organizaciones/contactos, perfil profesional de estudiantes, proyectos y perfil institucional propio.
- `/app/admin/advisors`: perfiles, vínculos manuales organización/periodo, vínculos individuales, cambios/retiros e historiales.
- `/app/admin/special-cases`: creación/revisión administrativa mínima y nombre opcional de ARL, con confirmación.
- `/app/organization/profile`: CRUD de interlocutores bajo la membresía existente.
- `/app/admin/matching`: carga diferida del `MatchingWorkspace` real de P5, dentro de RequireRole ADMIN. El placeholder de AdminWorkspace ya no recibe esta ruta; no se modifica esa feature ajena.

Exports públicos para integración:

- `features/advisors/AdvisorWorkspace.tsx`: `AdvisorWorkspace`.
- `features/advisors/AdvisorsAdminWorkspace.tsx`: `AdvisorsAdminWorkspace`.
- `features/advisors/services.ts`: adaptadores de carga/cambio, tipos `Staff`, `SpecialCase`, `AdminAdvisorData`, `AdvisorData` y parser de proyección.
- `features/organizations/OrganizationContacts.tsx`: `OrganizationContacts({organizationId,canManage})`.
- `features/organizations/services/contacts.ts`: cargar/guardar/eliminar contactos, `OrganizationContact` y `ContactDraft`.

## Conexión con B y C

**B:** integrar la ficha de proyectos con ProjectInterlocutors, ProjectParticipatingOrganizations y ProjectTechnicalTeachers después de 008. OrganizationContacts conserva el principal administrativo por separado del principal operativo. No duplicar nombre/asesor/contacto en Projects. Los contactos operativos deben pertenecer a la organización titular; las instituciones colaboradoras no cambian al titular ni autorizan acceso al proyecto. La ausencia de docente nunca bloquea proyectos o asignaciones. Exportar las páginas nuevas de Calls/Groups y entregar sus rutas al integrador; no se añaden imports de módulos que aún no existen en esta base.

**C:** no existe inicialización automática de AdvisorStudentAssignments en esta rama. Tras fusionar, el integrador podrá consultar el asesor vigente de la organización en el periodo al confirmar la asignación y llamar a la RPC individual con el `source_assignment_id` definitivo, dentro de la transacción de confirmación que defina C. Si no existe asesor vigente, dejar sin vínculo y permitir corrección administrativa. No inferirlo por municipio ni propagar cambios futuros. Los triggers de 008 impiden cambiar estudiante/periodo de Assignments cuando sea origen de historia de asesoría, y student_id/academic_period_id de participaciones referenciadas por asesorías o casos. Las RPC de C deben conservar esas identidades y añadir sus propias garantías transaccionales; no deshabilitar estas guardas.

## Validación reproducible

```powershell
npm run typecheck
npm run lint
npm test -- --maxWorkers=2
npm run build
npm run test:e2e
node tests/run-p4-e2e.mjs --project=auth --grep P4
node tests/advisors/run-e2e.mjs
git diff --check
node --test tests/advisors/runtime.test.mjs
```

El runner P6A reserva el puerto 5484, rechaza un servidor ajeno y detiene sus procesos. Los E2E recorren rutas productivas y llamadas del SDK con HTTP aislado; comprueban selección multirrol, independencia de responsables, retiro/historial, confirmaciones por teclado, contactos CRUD/solo lectura, revisión de casos, ARL, errores, vacíos, viewport 320/390/768/1440 y axe. Las capturas de 320 px se inspeccionaron visualmente.

`supabase/tests/p6a_advisors.test.sql`: pgTAP transaccional con fixtures revertidas, 85 aserciones de integridad, historial, legitimidad del rol, aislamiento entre asesores/periodos, origen individual, no propagación, contactos principales/operativos, ficha opcional, casos y ARL. `tests/advisors/wasm.mjs` aplica 001–008, comprueba el fallback y ejecuta P6A más las 27 regresiones SQL de P5. Para usarlo, configurar `P6A_PGLITE_MODULE` con un módulo PGlite existente; no cambia package/lockfile. **Es complementario: Auth/Storage están simulados y hay una sola sesión. No sustituye RLS/concurrencia en Supabase real.**

Para las pruebas reales, configurar `P6A_PG_MODULE` (módulo `pg`) y `P6A_POSTGRES_URL` de una instancia Supabase desechable con 001–008 aplicadas. El primer test ejecuta el archivo pgTAP y revierte sus fixtures. La prueba concurrente requiere además `P6A_ADMIN_USER_ID`, `P6A_ORGANIZATION_ID`, `P6A_PERIOD_ID`, `P6A_ADVISOR_A_ID` y `P6A_ADVISOR_B_ID` legítimos y exclusivos de pruebas. Abre dos sesiones reales, observa el lock y verifica un único vigente e historial retenido. **Ese segundo test conserva los cambios en la organización de prueba**; nunca usar fixtures de producción. Sin estas variables informa SKIPPED explícitamente.

## Estado de entrega y pendientes

| Comprobación final | Resultado |
|---|---|
| Typecheck / lint / build / diff --check | PASS |
| Vitest, 2 workers | 167 PASS en 22 archivos |
| E2E base / regresión P4 / P6A | 30 + 15 + 11 PASS |
| SQL complementario P6A / P5 | 85 + 27 PASS |
| Tipos fallback | 350 columnas y 19 FK nuevas verificadas |
| Supabase real: RLS / concurrencia | 2 SKIPPED |

Se observó un fallo intermitente de paginación P4 al correr suites en paralelo; la corrida completa posterior de P4 pasó sus 15 pruebas. El hook compartido preexistente `components/forms/usePaged.ts` reinicia `page` a 0 al vencer su debounce inicial de 250 ms, aunque no cambie la búsqueda; puede competir con un clic inmediato en Siguiente. Se deja registrado para el integrador porque modificar ese hook compartido queda fuera del ownership P6-A. No se oculta el fallo previo ni se cambia el test para evitarlo. Los cambios en tests P4 actualizan exclusivamente el contrato anterior del placeholder de matching y sus fixtures HTTP.

La implementación local y las pruebas complementarias no certifican un despliegue productivo. El conector Supabase devolvió una lista vacía de proyectos; no hay CLI/psql ni credenciales de ejecución real configuradas. Pruebas de RLS real y concurrencia: **SKIPPED (2)**. Pendientes de integración: aplicar migración en entorno de pruebas, ejecutar pgTAP/concurrencia y advisors de Supabase, regenerar tipos desde la base combinada y conectar los exports/RPC de B/C descritos arriba. No se enviaron mensajes a otras conversaciones ni se modificaron sus archivos.
