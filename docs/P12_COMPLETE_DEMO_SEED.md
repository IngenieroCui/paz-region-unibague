# Demo completa · Paz y Región

Esta ejecución usa exclusivamente `paz-region-demo` (`irykykwhvattrduuqxhj`). No se conecta al proyecto institucional. Los identificadores Auth los asigna Auth Admin; los registros nuevos se crean con UUID nuevos y se conservan en un manifiesto privado. Los catálogos y el periodo presentes en esta base demo se consultan por sus claves, sin trasladar UUID del sistema institucional.

## Ejecución idempotente

```sh
node scripts/seed-pilot-complete.mjs --apply --confirm=PYR-DEMO-2026B
node scripts/seed-pilot-complete.mjs --verify
```

Configura únicamente la URL/clave pública demo y la clave privada de Auth Admin en un entorno privado; `scripts/supabase-admin.mjs` rechaza cualquier otro proyecto. La aplicación recibe únicamente las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. No se habilitan registro público ni Google.

La primera orden crea el ledger privado si no existe, provisiona las nueve cuentas por Auth Admin, vincula perfiles/roles y crea los StaffProfiles de asesores antes de ejecutar el seeder existente. No requiere cuentas ni registros institucionales previos. Las siguientes ejecuciones conservan credenciales, UUID, relaciones y el matching completado del manifiesto. No vuelve a generar el ledger existente.

El seeder usa `work/p12/cuentas-test.local.json` para las credenciales y `work/p12/manifest.local.json` para recuperar las operaciones. Ambos están ignorados por Git. No imprimas estos archivos. La clave administrativa de esta ejecución se usó desde `work/admin.env`, también ignorado; se retira al terminar. Para repetir el provisionamiento, vuelve a proporcionar esa clave exclusivamente en un proceso privado.

## Cuentas

| Correo | Rol |
| --- | --- |
| pyrdemo.administrador@unibague.edu.co | ADMIN |
| pyrdemo.estudiante@estudiantesunibague.edu.co | STUDENT |
| pyrdemo.estudiante2@estudiantesunibague.edu.co | STUDENT |
| pyrdemo.estudiante3@estudiantesunibague.edu.co | STUDENT |
| pyrdemo.estudiante4@estudiantesunibague.edu.co | STUDENT |
| pyrdemo.entidad@unibague.edu.co | ORGANIZATION |
| pyrdemo.entidad2@unibague.edu.co | ORGANIZATION |
| pyrdemo.asesor@unibague.edu.co | ADVISOR |
| pyrdemo.asesor2@unibague.edu.co | ADVISOR |

Las contraseñas aleatorias se recuperan privadamente desde el ledger local. Si se pierde el archivo, usa una rotación controlada de Auth Admin que actualice el ledger al mismo tiempo. No se envían invitaciones ni correos a estas direcciones ficticias de evaluación.

## Datos y verificación real

Se sembraron cuatro perfiles de estudiante, dos organizaciones del escenario, dos asesores, tres programas de referencia, tres habilidades del escenario, intereses, requisitos, participaciones y responsabilidades de asesoría. Hay dos proyectos aprobados del escenario, cada uno con dos plazas de capacidad dos, y dos convocatorias abiertas. Se conserva el periodo 2026B de la base demo. El cuarto estudiante está deliberadamente marcado como no elegible; los otros tres participan del matching.

La ejecución `6fe4a44c-4d35-4730-9722-9b57f8e75db6` terminó en 309 ms y persistió 18 pares: seis elegibles y recomendados, doce bloqueados. Evaluó tres estudiantes elegibles frente a seis plazas presentes en el periodo (cuatro plazas del escenario y dos de una demo anterior). Se usa el motor real `matching-run`, algoritmo `hybrid-v0.1`, modo estructurado con componente semántico desactivado; no se presentan resultados de IA inventados.

Las nueve cuentas pasaron login y consulta del rol persistido. ADMIN actualizó una configuración autorizada. STUDENT recibió HTTP 403 al ejecutar matching y `42501` al insertar una configuración administrativa. ORGANIZATION consultó sus registros y ambos ADVISOR consultaron sus responsabilidades propias. El informe sin contraseñas queda en `work/p12/verification-final.local.json`.

La interfaz tenía un hostname Supabase antiguo fijado en su configuración y por eso bloqueaba el login aun con las variables correctas de Vercel. Se corrigió para aceptar únicamente `irykykwhvattrduuqxhj.supabase.co`; pasaron las seis pruebas específicas de configuración y la compilación. No se repitieron las pruebas de matching previamente aprobadas.

## Recorrido

Abre https://paz-region-unibague.vercel.app/login y elige el acceso universitario para ADMIN, STUDENT y ADVISOR; para ORGANIZATION elige el acceso de organizaciones. Entra al panel del rol, consulta tus registros y cierra sesión. Como ADMIN, abre Matching, selecciona el periodo 2026B y la configuración `PYR-DEMO-2026B · TEST · Matching estructurado`, ejecuta el motor y consulta los resultados persistidos.

Se conserva la configuración de protección de Vercel. No se crean enlaces temporales ni bypass. La accesibilidad de la URL principal y del dominio inmutable del despliegue se informa por separado; cualquier ampliación de acceso a los dominios protegidos requiere que el propietario cambie Deployment Protection expresamente.

No se aplicaron migraciones nuevas en esta ejecución de Paz y Región: se usó el esquema demo ya migrado. Las tablas usadas tienen prefijo `PYRUnibague_`, principalmente `UserProfiles`, `UserRoles`, `Students`, `StaffProfiles`, `AcademicPeriods`, `AcademicPrograms`, `Skills`, `StudentSkills`, `StudentInterests`, `StudentLocationPreferences`, `StudentPeriodParticipations`, `Organizations`, `OrganizationMembers`, `OrganizationContacts`, `AdvisorOrganizationAssignments`, `AdvisorStudentAssignments`, `Projects`, `ProjectPositions`, `ProjectPositionPrograms`, `ProjectPositionSkills`, `Calls`, `CallPositions`, `MatchingConfigurations`, `MatchingRuns` y `MatchCandidates`.
