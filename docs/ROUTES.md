# Rutas

| Ruta | Superficie | Acceso |
| --- | --- | --- |
| / | Landing | Público |
| /login | Login real | Público |
| /forgot-password | Recuperación real | Público |
| /auth/callback | Callback PKCE sin open redirects | Público; código válido requerido |
| /reset-password | Nueva contraseña | Sesión de recuperación real |
| /select-role | Selector multirrol | Sesión + roles RPC |
| /unauthorized | Sin permiso | Público |
| * | 404 | Público |
| /app/student | Inicio estudiante con datos Supabase | Sesión SDK + rol confiable |
| /app/organization | Inicio organización u onboarding RPC | Sesión SDK + rol confiable |
| /app/admin | Shell coordinación | Sesión SDK + rol confiable |
| /dev/student | Dashboard estudiante | Solo desarrollo |
| /dev/organization | Dashboard organización | Solo desarrollo |
| /dev/admin | Dashboard coordinación | Solo desarrollo |

Roles persistidos RPC: /app verifica rol real. Sin sesión → /login; con sesión sin rol → /unauthorized; fallo de verificación → error. No se usa from/next arbitrario: destinos Auth cerrados a rutas conocidas.

Subrutas de preview: student/profile, process, documents; organization/profile, projects, requests; admin/students, organizations, projects, assignments, settings. Son pantallas de preparación. Paths no registrados devuelven 404. /dev y fixtures no se empaquetan en producción.

## Evolución histórica

Las subrutas Admin se conectaron en P4–P7. Student y Organization conservan sus módulos productivos P3. Matching y asignaciones son superficies administrativas operativas.

Hosting SPA debe resolver rutas frontend hacia index.html sin reescribir API, Auth o archivos existentes. No cachear callbacks de Auth. Política de status HTTP se decide al desplegar.

## Subrutas P3

Student: /app/student/profile, /experience, /skills (habilidades e intereses), /preferences, /documents. Organization: /app/organization/profile, /documents, /reviews. Cada ruta mantiene RequireRole real y carga diferida. Navegación productiva separada de la navegación original de previews. La organización seleccionada se conserva en ?organization=<id>; solo se resuelve contra membresías autorizadas. Rutas Projects no se habilitan en P3.

## Rutas productivas P4 · Projects + Admin

| Ruta | Superficie | Acceso |
| --- | --- | --- |
| /app/organization/projects | Lista de proyectos | ORGANIZATION + membresía activa |
| /app/organization/projects/new | Crear borrador | ORGANIZATION + can_manage |
| /app/organization/projects/:projectId | Proyecto, plazas y perfil requerido | Membresía activa; edición can_manage + estado editable |
| /app/admin | Resumen real | ADMIN persistido |
| /app/admin/students | Lista administrativa | ADMIN persistido |
| /app/admin/students/:studentId | Perfil y participación | ADMIN persistido |
| /app/admin/organizations | Lista administrativa | ADMIN persistido |
| /app/admin/organizations/:organizationId | Perfil y revisión | ADMIN persistido |
| /app/admin/projects | Lista administrativa | ADMIN persistido |
| /app/admin/projects/:projectId | Revisión y corrección | ADMIN persistido |
| /app/admin/users | Usuarios y roles | ADMIN persistido |
| /app/admin/settings | Cinco catálogos, configuraciones y flags | ADMIN persistido |
| /app/admin/audit | Auditoría read-only | ADMIN persistido |
| /app/admin/matching | Matching P5 conectado | ADMIN persistido |
| /app/admin/assignments | Optimizador y decisiones P6-C | ADMIN persistido |

Se conservan los guards, la selección de organización y las rutas P3/P4. Las rutas actuales de P6/P7 se indican a continuación.

## P6/P7

| Ruta | Superficie | Acceso |
| --- | --- | --- |
| /app/admin/calls y /:callId | Convocatorias y revisión | ADMIN |
| /app/organization/calls y /:callId | Convocatorias y plazas existentes | ORGANIZATION, membresía RLS |
| /app/admin/groups | Proyectos con acceso a equipos | ADMIN |
| /app/organization/groups | Proyectos y estudiantes confirmados | ORGANIZATION, membresía RLS |
| /app/admin/projects/:projectId/groups | Equipos del proyecto | ADMIN |
| /app/organization/projects/:projectId/groups | Equipos del proyecto | ORGANIZATION, membresía RLS |
| /app/admin/advisors | Personal y responsabilidades históricas | ADMIN |
| /app/admin/special-cases | Casos mínimos y nombre ARL opcional | ADMIN |
| /app/advisor y /organizations, /students, /projects, /profile | Workspace de asesor | ADVISOR activo, responsabilidades propias |
| /app/student | Incluye destino confirmado, asesor y compañeros vinculados | STUDENT, proyección propia |

La ficha imprimible y relaciones institucionales están en los detalles existentes de proyectos. Interlocutores de organización permanece en `/app/organization/profile`. Las rutas productivas no incluyen harnesses de prueba.
