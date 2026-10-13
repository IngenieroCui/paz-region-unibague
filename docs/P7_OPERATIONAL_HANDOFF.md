# P7 · Entrega operativa integrada

13 de octubre de 2026 · alcance v0.4. Rama `integration/p6-complete`.

Repositorio original: `C:\Users\SENA\Documents\PyR2026B\paz_region_unibague`.
Worktree final: `C:\Users\SENA\Documents\Codex\2026-10-13\c-users-sena-documents-pyr2026b-paz-4\work\p7-integration`.
Se continuó la integración existente `7bb117c`; no se duplicaron merges ni se modificaron main/dev. El commit de cierre es el HEAD de esta rama (`git log -1 --oneline`). No hubo push ni despliegue.

## Historial y contratos preservados

| Trabajo | Commit fuente | Merge existente |
| --- | --- | --- |
| P6-A · asesores/interlocutores | `1d9aebd` | `275bae0` |
| P6-B · proyectos/convocatorias/equipos | `9ca13d6` | `9efce7d` |
| P6-C · optimizador/asignaciones | `a2357b8` | `1f2b290` |

Base común verificada `b7502fe`. Los tres commits son ancestros del árbol entregado. Fusiones originales sin conflictos textuales; la integración anterior resolvió conflictos de contratos, rutas y tipos (detalle histórico en P6_INTEGRATION_REPORT.md). Este cierre completa funciones operativas; conserva las migraciones anteriores byte por byte. Los archivos locales sin seguimiento del checkout dev, incluido el modelo maestro original y el comprimido, permanecen intactos. Se incorporó una copia del modelo con una nota de estado P7.

## Flujo conectado

Organización → proyecto → plazas/cupos → convocatoria → aprobación → elegibilidad → matching explicable → propuesta del optimizador → confirmación ADMIN → asesor individual → selección explícita de equipo → consulta del estudiante.

La integración transaccional 011 toma el asesor vigente de organización/periodo y registra `source_assignment_id`. Si falta, mantiene la asignación y registra `missing_advisor`; ADMIN lo resuelve en Asesores. Cambiar el asesor de organización no propaga cambios a estudiantes. Reasignación/retiro cierra vínculos y membresías, preserva eventos/auditoría y libera cupos. Grupos valida proyecto, periodo, asignación confirmada y unicidad en PostgreSQL. No se elige automáticamente entre varios equipos.

La ficha imprimible obtiene organización, periodo, municipio/zona, plazas, interlocutores, asesor regional, colaboradores e integrantes/programas desde relaciones reales. Organización consulta sus confirmados y equipos. Asesor conserva perfiles profesionales permitidos y ahora consulta equipos solo con sus estudiantes individuales vigentes; conocer una organización no concede los estudiantes de otros asesores. Estudiante dispone de ruta propia con selector de periodo, estado, municipio, destino, asesor y compañeros/programas. Se corrigieron accesos rotos y el aviso obsoleto de proyectos en el inicio de organización.

## Funciones operativas nuevas

- **Pendientes por periodo:** organizaciones pendientes (global), proyectos submitted, elegibles sin asignación, plazas/cupos disponibles aprobados, organizaciones sin asesor válido, confirmados sin asesor individual válido y asignaciones para revisión. Revisión significa intervención MANUAL o cambio de elegibilidad/estado del estudiante o destino. Cada indicador abre su módulo; Projects/Assignments conserva el periodo.
- **CSV:** dos descargas ADMIN, asignaciones con historial y plazas/ocupación. Relaciones reales; sin correos, documentos, códigos estudiantiles, datos médicos, notas o puntajes. Asesor/grupo son los vínculos vigentes; no se atribuyen vínculos actuales a una asignación histórica retirada. BOM UTF-8, separador `;`, comillas/CRLF y neutralización de fórmulas incluso tras espacios/controles. Páginas por UUID de 500 filas; no depende del límite de filas PostgREST. Cada página tiene su snapshot SQL; regenerar si hay cambios concurrentes durante la exportación.
- **Notificaciones personales:** listado paginado, filtro sin leer, actualización, RPC propia idempotente, foco tras lectura y enlace interno validado. Un trigger privado crea avisos al estudiante desde eventos confirmados/reasignados/retirados en la misma transacción. Reasignar produce aviso de retiro y de destino. Enlaces incluyen el periodo. Nadie, incluido ADMIN, puede fabricar avisos arbitrarios ni leer los ajenos mediante la tabla. Sin correos, workers o colas nuevas.
- **Paginación:** se conserva la corrección de debounce existente y sus cinco regresiones. Carga, errores y datos obsoletos por periodo tienen cobertura adicional. Una exportación que termina tras salir/cambiar periodo no descarga datos obsoletos.

## Migraciones y seguridad

Secuencia: 001 core, 002 domain, 003 security, 004 reference, 005 estudiante/organización, 006 proyectos/admin, 007 matching, 008 asesores/contactos, 009 convocatorias/grupos, 010 asignaciones, 011 integración, **012 `202610010012_p7_operations.sql`**.

012 no agrega tablas ni altera 001–011. Crea el trigger privado de avisos y tres RPC: `pyr_unibague_operational_summary(uuid)`, `pyr_unibague_operational_export(uuid,text,uuid)` y `pyr_unibague_advisor_project_team(uuid)`. Amplía la proyección propia `student_assignment` y restringe Notifications a destinatario. Añade un índice de bandeja por usuario/fecha/id.

RPC nuevas: `SECURITY DEFINER`, `search_path=''`, referencias calificadas, `auth.uid()` y roles persistidos; EXECUTE revocado a PUBLIC/anon. El trigger privado no es ejecutable por clientes. No se amplían permisos de identidades, candidatos o documentos. Se mantienen capacidad, asignación única por periodo, historial, auditoría y escrituras de asignación exclusivamente por RPC. Catálogo suplementario: 45 tablas con RLS, 381 columnas, 60 FK públicas y 29 RPC. Fallback TypeScript sincronizado con ese catálogo; **no generado oficialmente por Supabase**. CLI ausente: se utilizó el siguiente ordinal reservado 012; creación/listado por CLI queda pendiente.

## Rutas definitivas

| Rol | Rutas |
| --- | --- |
| ADMIN | `/app/admin`, `/students[/:studentId]`, `/organizations[/:organizationId]`, `/projects[/:projectId]`, `/projects/:projectId/groups`, `/calls[/:callId]`, `/groups`, `/advisors`, `/special-cases`, `/users`, `/matching`, `/assignments`, `/settings`, `/audit`, **`/operations?period=:id`**, **`/notifications`** |
| ORGANIZATION | `/app/organization`, `/profile`, `/documents`, `/reviews`, `/projects`, `/projects/new`, `/projects/:projectId`, `/projects/:projectId/groups`, `/calls[/:callId]`, `/groups`, **`/notifications`** |
| ADVISOR | `/app/advisor`, `/organizations`, `/students`, `/projects` (equipos de consulta), `/profile`, **`/notifications`** |
| STUDENT | `/app/student`, `/profile`, `/experience`, `/skills`, `/preferences`, `/documents`, **`/assignment?period=:id`**, **`/notifications`** |

Las subrutas de cada fila conservan el prefijo del rol. Refresh, guards y navegación comprobados con router/shell productivos. Sin placeholders de módulos desarrollados. Se conserva todo lo excluido de v0.4 fuera del flujo: matrícula, planes/cronogramas/entregables/diarios/Comprensión del Entorno, documentos ARL, asesoría territorial automática y docente técnico obligatorio.

## Evidencia ejecutada en esta entrega

| Comprobación | Resultado |
| --- | --- |
| Typecheck / lint / build producción / git diff --check | PASS |
| Vitest | **271 PASS**, 33 archivos |
| E2E P1–P3 / P4 / P5 / P6-A / P6-B / P6-C / P7 | **30 / 15 / 2 / 11 / 7 / 5 / 15 PASS = 85** |
| SQL 001–012 desde cero y suites P2–P7 | **474 aserciones PASS suplementarias**: 67/36/61/27/85/53/68/77 |
| Responsive/axe/teclado/impresión | PASS; P7 a 320/390/768/1440 px; capturas revisadas |
| Deno check index/engine/embeddings | PASS con config/lock existentes |
| Benchmark optimizador | 400 estudiantes, 120 plazas, 48.000 aristas, 400 asignados, suma 39600,99; 1107,9 ms bajo carga de pruebas |
| Supabase real/RLS/PostgREST/Auth/Storage/concurrencia | **SKIPPED: 24 pruebas** sin runtime/fixtures |
| Advisors/lint SQL Supabase y tipos oficiales | **SKIPPED** sin CLI/instancia |

E2E utiliza SDK y navegador reales con HTTP aislado. SQL utiliza PostgreSQL WASM/PGlite con una sesión y stubs Auth/Storage/pgTAP; **no equivale a Supabase real ni certifica concurrencia**. P7 SQL cubre A–H, incluida independencia de asesor, rollback, capacidad, reportes, permisos ajenos y avisos solo destinatario. No se insertaron ejemplos o fixtures en producción.

Incidencia de validación: una primera ejecución P7 sufrió ENOENT al guardar una traza porque la suite base limpiaba la carpeta padre. Se separó outputDir de la suite base y se repitió P7 completo: 15 PASS. No se cuenta el fallo inicial como aprobación. Los logs adicionales permanecen en `work/validation/`; los artefactos Playwright en `test-results/` y `playwright-report/`. Los warnings históricos de React Router sobre HydrateFallback/POP siguen visibles; no bloquean las comprobaciones efectuadas.

## Arranque y reproducción

Desde el worktree final, con Node 22.12+ y Microsoft Edge:

```powershell
npm ci # solo si faltan dependencias; aquí se reutilizaron las existentes
Copy-Item .env.example .env.local # solo si aún no existe
# Configurar URL Supabase y clave pública; nunca service_role/secret en VITE_
npm run dev
npm run typecheck
npm run lint
npm test -- --maxWorkers=2
npm run build
npm run test:e2e
node tests/run-p4-e2e.mjs --project=auth --grep P4
node tests/matching/run-e2e.mjs
node tests/advisors/run-e2e.mjs
node tests/p6b/run-e2e.mjs
node tests/assignments/run-e2e.mjs
node tests/p7/run-e2e.mjs
node tests/assignments/benchmark.mjs
git diff --check
```

SQL suplementario: definir `PYR_PGLITE_MODULE` con URL file de un módulo PGlite instalado externamente y ejecutar `node tests/sql/run-integrated-wasm.mjs`. Deno: `deno check --config supabase/functions/matching-run/deno.json supabase/functions/matching-run/index.ts supabase/functions/_shared/matching/engine.ts supabase/functions/_shared/matching/embeddings.ts`. El script WASM verifica también tipos/relaciones y todas las tablas con RLS.

## Validación real pendiente y bloqueo del piloto

Docker Desktop, Supabase CLI y psql no están disponibles en PATH/ubicaciones comprobadas; no hay variables de conexión reales y el conector Supabase devuelve `projects: []`. **Nada fue aplicado o validado contra Supabase local/remoto.** No se crearon cuentas, proyectos remotos ni despliegues.

En una instancia LOCAL desechable, con Docker/CLI instalados, ejecutar `scripts/validate-supabase-local.ps1 -ResetDisposableLocal`. Ese opt-in reinicia solo la BD local del repositorio, aplica 001–012/seed, ejecuta pgTAP (incluido P6-B), lint y genera tipos oficiales en `work/database.official.types.ts` para comparar. No ejecutar sobre datos locales útiles. El script está preparado y analizado sintácticamente, **no ejecutado contra CLI**. Descubrir `supabase db advisors --help` según versión y ejecutar advisors; reparar hallazgos sin ampliar permisos. Revisar compatibilidad del config.toml con la CLI instalada.

Para P7 PostgreSQL real: establecer `P7_PG_MODULE` (URL file de driver pg), `P7_POSTGRES_URL` (conexión desechable), `P7_ALLOW_DISPOSABLE_TESTS=yes`; ejecutar `node --test tests/p7/runtime.test.mjs`. Para carreras de confirmación: mismas variables con prefijo `P6C_`, ejecutar `node --test tests/assignments/concurrency.test.mjs`. Las pruebas de dos sesiones conservan fixtures/historia; usar exclusivamente datos desechables. Las carreras de asesor y matching conservan contratos `P6A_*` y `P5_*` documentados en sus archivos runtime/concurrency.

Para HTTP/Auth/Storage reales, provisionar cuentas de prueba aisladas fuera del frontend; obtener JWT mediante Auth y configurar `P7_SUPABASE_URL`, `P7_PUBLIC_KEY`, `P7_STUDENT_JWT`, `P7_OTHER_STUDENT_JWT`, `P7_ORGANIZATION_JWT`, `P7_ADVISOR_JWT`, `P7_ADMIN_JWT`, `P7_PERIOD_ID`, `P7_FOREIGN_PROJECT_ID`, `P7_NOTIFICATION_ID`, `P7_PRIVATE_BUCKET`, `P7_PRIVATE_OBJECT_PATH` y opt-in anterior. Notificación/objeto deben pertenecer al primer estudiante; el proyecto debe ser ajeno a organización/asesor. Ejecutar `node --test tests/p7/postgrest.test.mjs`. No guardar JWT ni claves privadas en el repositorio. Esta suite valida identidad con Auth, roles persistidos, denegación de reportes a otros roles, separación de notificaciones/proyectos y firma privada con rechazo al otro estudiante.

Para ejecutar las suites runtime previas: `node --test tests/advisors/runtime.test.mjs tests/matching/runtime.test.mjs tests/matching/concurrency.test.mjs tests/assignments/runtime.test.mjs tests/assignments/concurrency.test.mjs tests/p6b/remote.test.mjs tests/p7/runtime.test.mjs tests/p7/postgrest.test.mjs`. Variables detalladas en esos archivos; sin fixtures se omiten explícitamente.

Antes del piloto faltan: validación real anterior (especialmente locks multisesión), tipos oficiales y advisors, configuración pública/redirects/signup/primer ADMIN y validación institucional de estados/motivos provisionales. La respuesta incierta de confirmación exige recargar antes de reintentar; no se añadió idempotencia persistida. No abrir permisos para sortear un fallo. Guías oficiales consultadas: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [pruebas/lint local](https://supabase.com/docs/guides/local-development/cli/testing-and-linting), [tipos](https://supabase.com/docs/guides/api/rest/generating-types).
