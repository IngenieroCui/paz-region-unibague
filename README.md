# paz_region_unibague

Plataforma de gestión del programa **Paz y Región de la Universidad de Ibagué**.

**Demo actual:** esta rama apunta a Supabase `paz-region-demo` (`irykykwhvattrduuqxhj`). Google y el registro público permanecen desactivados. El despliegue protegido de Vercel conserva SSO; los usuarios autorizados pueden iniciar sesión con las cuentas ficticias creadas por el seeder.

**Integración funcional P7 · alcance v0.4.** Un árbol con estudiantes, organizaciones, asesores, proyectos/plazas, convocatorias, matching, optimizador, asignaciones y equipos. 45 tablas, migraciones 001–012, Auth/RBAC/RLS, auditoría y Storage privado. Incluye pendientes por periodo, exportaciones CSV y notificaciones personales. La certificación contra Supabase real sigue pendiente; ver [entrega operativa](docs/P7_OPERATIONAL_HANDOFF.md).

## Requisitos e instalación

Node.js 22.12+ (o LTS compatible con Vite 8), npm y navegador moderno.

~~~sh
npm ci
cp .env.example .env.local
npm run dev
~~~

En PowerShell: `Copy-Item .env.example .env.local`. Si se bloquea npm.ps1, usar `npm.cmd`.

La aplicación **inicia sin credenciales**: landing y previews no dependen de Supabase.

## Variables

| Variable | Uso |
| --- | --- |
| VITE_SUPABASE_URL | URL del proyecto Supabase |
| VITE_SUPABASE_ANON_KEY | Clave pública anon o publishable |

No hay valores reales en el repositorio. Todo VITE_* llega al navegador: nunca colocar service_role, secret keys ni secretos de Edge Functions. Se rechazan claves privilegiadas reconocibles; esa validación no sustituye la revisión de secretos. Revocar cualquier clave privada publicada accidentalmente.

La configuración válida activa login y solicitudes de recuperación de Supabase. Guards resuelven roles persistidos por RPC y fallan cerrados ante errores. La interfaz mantiene cerrado el registro público; esto no modifica la configuración remota de Auth. La entrega de correo requiere SMTP autorizado. Ver [puesta en marcha](docs/SUPABASE_SETUP.md).

## Demo autorizada

El seeder administrativo es idempotente y se ejecuta desde un entorno privado:

~~~sh
node scripts/generate-demo-ledger.mjs
node scripts/crear-cuentas-piloto.mjs --apply
node scripts/seed-pilot-complete.mjs --apply --confirm=PYR-DEMO-2026B
node scripts/seed-pilot-complete.mjs --verify
~~~

`work/admin.env` contiene únicamente la clave secreta de `paz-region-demo` y `work/p12/cuentas-test.local.json` contiene las contraseñas generadas. Ambos archivos están ignorados por Git y nunca deben copiarse a `VITE_*` ni imprimirse.

Las cuentas de evaluación son `pyrdemo.estudiante@estudiantesunibague.edu.co`, `pyrdemo.estudiante2@estudiantesunibague.edu.co`, `pyrdemo.estudiante3@estudiantesunibague.edu.co`, `pyrdemo.estudiante4@estudiantesunibague.edu.co` (STUDENT), `pyrdemo.asesor@unibague.edu.co` y `pyrdemo.asesor2@unibague.edu.co` (ADVISOR), `pyrdemo.entidad@unibague.edu.co` y `pyrdemo.entidad2@unibague.edu.co` (ORGANIZATION), y `pyrdemo.administrador@unibague.edu.co` (ADMIN). Las contraseñas actuales se recuperan únicamente desde el ledger privado protegido; si se pierde, se usa el flujo de recuperación de Supabase o una rotación Auth Admin controlada. No se deben regenerar contraseñas sin actualizar Auth Admin y el ledger privado a la vez; nunca se registran contraseñas en Git.

El recorrido demo usa el periodo 2026B y crea cuatro estudiantes, dos organizaciones, dos asesores y dos proyectos aprobados con cuatro plazas de capacidad dos, programas, habilidades, requisitos y una configuración de matching. El seeder hace automáticamente el bootstrap de cuentas mediante Auth Admin. Consulta docs/P12_COMPLETE_DEMO_SEED.md para los resultados reales y el recorrido actualizado. El matching se ejecuta con la sesión ADMIN contra la Edge Function `matching-run`; sus candidatos y resultados quedan persistidos y se consultan desde el panel. Un usuario sin rol ADMIN recibe rechazo de RLS/RPC al intentar administrar configuraciones.

## Comandos

| Comando | Uso |
| --- | --- |
| npm run dev | Desarrollo con previews |
| npm run typecheck | TypeScript estricto |
| npm run lint | Oxlint, warnings tratados como fallo |
| npm test | Vitest, una ejecución |
| npm run test:watch | Vitest interactivo |
| npm run test:e2e | Edge: responsive, accesibilidad, navegación y PWA |
| npm run build | Typecheck y build con PWA |
| npm run preview | Servir build de producción |

test:e2e requiere ejecutar build primero y Microsoft Edge instalado. Arranca los servidores dev/preview y un servidor Auth aislado en 5174 con respuestas HTTP de prueba si no están activos. En CI, adaptar el canal de Playwright a Chromium instalado y ejecutar `npx playwright install chromium`; coordinar el cambio.

## Recorrer experiencias

Solo npm run dev ofrece:

- /dev/student: experiencia guiada.
- /dev/organization: organización y validación ilustrativa.
- /dev/admin: resumen y bandeja con filtros locales.

La landing contiene accesos de desarrollo y la topbar permite cambiar rol visual. Las rutas y fixtures quedan fuera del grafo de producción; npm run preview devuelve 404 para ellas. No se crean usuarios ni sesiones. Subrutas de módulos muestran preparación, sin formularios reales.

Públicas: /, /login, /forgot-password, /auth/callback, /unauthorized y 404. /reset-password requiere sesión de recuperación; /select-role resuelve acceso multirrol. /app/student y /app/organization tienen guards/RBAC reales, perfiles/CRUD/documentos y onboarding P3. /app/admin conecta las superficies administrativas reales; /app/advisor consulta responsabilidades propias. /app/student/assignment permite seleccionar periodo y /app/admin/operations reúne pendientes y CSV. Cada espacio ofrece /notifications.

## Estructura

~~~text
src/
  app/                 router, providers, errores y efectos de navegación
  components/          ui, layout, navigation y feedback
  config/              metadata, roles provisionales y navegación
  features/            auth, public, students, organizations, admin y preview
  layouts/             PublicLayout y AppShell
  lib/supabase/        configuración y cliente oficial
  styles/              tokens y estilos de superficies
  test/                preparación de Vitest
  utils/               helpers sin lógica institucional
docs/                  contratos y decisiones
tests/e2e/             verificaciones en navegador
~~~

Se crearán projects, matching, assignments y process al implementar sus primeras funciones; no hay archivos vacíos. Servicios/hooks/tipos de dominio viven dentro de cada feature. services/, hooks/ y types/ compartidos se añadirán cuando exista uso concreto.

## Estado y siguientes pasos

Incluye tema claro, drawer nativo con foco contenido, estados UI accesibles, fixtures separados, Supabase sin esquema inventado y PWA con actualizaciones voluntarias. Dismiss de instalación se respeta siete días. Solo el shell está preparado para offline; los datos requieren conexión.

Los módulos de proyectos, convocatorias, matching, asignaciones y paneles de los cuatro roles están conectados al esquema remoto del demo. El registro público y Google continúan desactivados por diseño.

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Core Schema v0](docs/DATABASE_CONTRACT.md)
- [Reglas de dominio](docs/DOMAIN_RULES.md)
- [Sistema de diseño](docs/DESIGN_SYSTEM.md)
- [Rutas](docs/ROUTES.md)
- [Trabajo paralelo](docs/PARALLEL_WORK.md)
- [PWA](docs/PWA.md)
- [Validación](docs/VALIDATION.md)

- [Auth y RBAC](docs/AUTH_RBAC.md)
- [Matriz RLS](docs/RLS_MATRIX.md)
- [Supabase setup](docs/SUPABASE_SETUP.md)

- [Módulos Student/Organization P3](docs/STUDENT_ORGANIZATION_MODULES.md)
