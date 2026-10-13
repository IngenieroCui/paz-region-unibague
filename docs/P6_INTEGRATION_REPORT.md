# Integración P6-A + P6-B + P6-C (P7)

Fecha: 13 de octubre de 2026. Rama `integration/p6-complete`.
Worktree: `C:\Users\SENA\Documents\Codex\2026-10-13\c-users-sena-documents-pyr2026b-paz-4\work\p7-integration`.

## Referencias e historial

Base común verificada: `b7502feb52150592a90aef65cbbb10b5382c7a8e`.

| Implementación | Commit integrado | Merge preservado |
| --- | --- | --- |
| P6-A asesores/contactos | `1d9aebd42e75bdf67714d8459bb23ab9a8e76ecd` | `275bae0` |
| P6-B convocatorias/proyectos/equipos | `9ca13d65165a9e0a8a4491112819f61d1db739a4` | `9efce7d` |
| P6-C optimizador/asignaciones | `a2357b894eeff0ea24ebf67ffc93fee4edcd09f0` | `1f2b290` |

Fusiones A → B → C, sin conflictos textuales. No se reescribieron módulos completos. Los conflictos fueron de contratos funcionales: rutas pendientes, clientes con tipos locales, helper de integración vacío y fixtures anteriores a P5/P6. Se resolvieron de forma aditiva. `main`/`dev` y las tres ramas fuente permanecen intactas. El checkout original tenía dos archivos sin seguimiento (`docs/Modelo_Datos_Paz_Region_v04.md`, `paz_region_unibague.tar.gz`); se conservaron sin copiar el archivo comprimido ni reconstruir código desde él. El modelo fuente conserva SHA256 `7EB33B7B22740A9B54405F7A22E4DF4E17435BE843AA893871CF7C5ADC0CA76A`.

## Esquema y seguridad

001–010 se conservan byte por byte respecto de las ramas fuente. Secuencia final: core 001, domain 002, security 003, reference 004, student/organization 005, projects/admin 006, matching 007, advisors/contacts 008, calls/projects/groups 009, assignments 010, integración 011 (`202610010011_p6_integration.sql`).

011 no agrega tablas ni columnas. Reemplaza el helper privado `assignment_integrations(text,uuid,uuid,uuid)` y agrega:

| RPC | Contrato/autorización |
| --- | --- |
| `pyr_unibague_project_institutional(p_project_id uuid)` | JSON de interlocutores, asesor regional e instituciones colaboradoras; ADMIN, organización titular o asesor autorizado |
| `pyr_unibague_student_assignment(p_period_id uuid)` | JSON/null de asignación confirmada propia, asesor individual y compañeros del mismo grupo; STUDENT persistido |

Las RPC nuevas tienen `SECURITY DEFINER`, `search_path=''`, referencias calificadas, `auth.uid()` y autorización persistida; EXECUTE revocado a PUBLIC/anon. No amplían RLS de Students, UserProfiles, candidatos o documentos. El helper de escritura permanece privado y sin EXECUTE de authenticated. Se conserva la revocación de escrituras directas en Assignments/AssignmentEvents incluso para ADMIN.

Se corrigió el guard privado de padres de 009 a SECURITY DEFINER para que dependencias de convocatorias ocultas por RLS no escapen a la validación. Conserva sus predicados y no publica una RPC. Todos los cambios operativos mantienen triggers de auditoría y eventos inmutables. No hay credenciales service_role en frontend; el único texto de ese nombre en src pertenece a una prueba que rechaza esa clave. Los documentos continúan privados.

Catálogo ejecutado desde cero: **45 tablas**, **381 columnas**, **60 FK entre tablas públicas**, **26 RPC públicas**, todas las tablas con RLS. Se comprobaron constraints/índices/triggers mediante catálogo y pruebas SQL, incluidos cupos, identidad, historias y propietarios. Tipos globales sincronizados desde PostgreSQL WASM: fallback explícito, **no generación oficial Supabase**. Se eliminaron extensiones locales de clientes A/B/C; tablas/funciones/relaciones consumen Database común. Se mantiene package.json/lockfile.

La CLI Supabase/Docker/psql no están disponibles. Se usa el ordinal reservado 011 del repositorio; creación/listado oficial por CLI y generación oficial de tipos quedan SKIPPED. No se ejecutó ninguna migración remota.

## Conexiones y rutas

- ADMIN: dashboard, estudiantes, organizaciones, proyectos/plazas, asesores, casos mínimos/ARL, convocatorias, grupos/equipos, matching, asignaciones, usuarios/roles, configuración/catálogos y auditoría.
- ORGANIZATION: perfil/contactos, proyectos/plazas, convocatorias, equipos y estudiantes confirmados del proyecto, documentos y revisión. Grupos reutiliza la lista y detalle existentes; se conserva `?organization=`.
- ADVISOR: workspace existente con organizaciones, estudiantes y proyectos autorizados por responsabilidades propias.
- STUDENT: inicio incorpora destino confirmado (organización/proyecto/plaza), asesor individual y compañeros vinculados; no consulta matching interno ni candidatos ajenos.
- Rutas nuevas conectadas: `/app/admin/calls`, `/app/admin/calls/:callId`, `/app/admin/groups`, `/app/admin/projects/:projectId/groups` y sus equivalentes organization. `/app/admin/assignments` carga el componente real y su worker. Matching permanece conectado. Ficha y relaciones se integran en los detalles existentes de proyectos.

Confirmar crea asesoría individual desde el asesor vigente de la organización y conserva `source_assignment_id`. No duplica un vínculo vigente. Sin asesor válido, registra `missing_advisor` en el evento/respuesta y permite resolverlo en la pantalla ADMIN existente sin invalidar una asignación válida; si ya había asesor manual, conserva ese vínculo (`retained_manual`). La UI informa la ausencia y enlaza asesorías/equipos.

Retiro finaliza responsabilidad individual vigente y membresías activas. Reasignación cierra ambas historias y vincula al asesor vigente del destino, o deja ausencia explícita. No borra/reinterpreta historiales. Cambiar asesor de organización no propaga cambios a estudiantes ya asignados. Asignación/asesoría/eventos y retiros de membresía se confirman en una transacción; una prueba provoca un fallo de integración y verifica rollback de todas esas operaciones.

El grupo se elige explícitamente después de confirmar; nunca se elige entre varios de forma arbitraria. El servidor valida proyecto, periodo, estado confirmado/activo y unicidad. La ficha obtiene personas e instituciones de relaciones reales y equipo de GroupMembers/Assignments. Incluye edición de vínculos operativos, lectura de confirmados e impresión. Los datos ausentes muestran estados vacíos. No se agregaron módulos excluidos de v0.4, asignación territorial de asesores ni ARL documental.

`usePaged`: solo programa debounce y reinicia página cuando cambia la búsqueda normalizada. Cinco regresiones cubren carga inicial/navegación, búsqueda/debounce, espacios, recarga, filtros y respuestas/errores obsoletos. Se conservó su API.

## Validación efectivamente ejecutada

| Comprobación | Resultado |
| --- | --- |
| Typecheck / lint / build producción / diff-check | PASS |
| Vitest | PASS: 240 pruebas, 30 archivos |
| E2E base P1–P3 | PASS: 30 |
| E2E P4 | PASS: 15 casos distintos (12 iniciales + 3 repetidos tras actualizar contrato) |
| E2E matching P5 | PASS: 2 |
| E2E asesores P6-A | PASS: 11 |
| E2E convocatorias/equipos P6-B | PASS: 7 |
| E2E asignaciones P6-C | PASS: 5 |
| E2E P7 en router/shell productivos | PASS: 8 |
| SQL P2/P3/P4/P5/P6-A/P6-B/P6-C/P7 sobre 001–011 | PASS suplementario: 67/36/61/27/85/53/68/42 = **439** aserciones |
| Seis recorridos P7 | PASS SQL WASM; UI productiva corroborada con HTTP aislado |
| Deno check index/engine/embeddings | PASS con config/lock existente y caché local escribible |
| Responsive / axe / teclado / impresión | PASS en suites; P7 a 320/390/768/1440 px, capturas revisadas |
| Benchmark optimizador | PASS: 400 estudiantes, 120 plazas, 48.000 aristas, 400 asignados, suma 39600,99; ~612 ms local |
| Supabase real, PostgREST/RLS, pgTAP y concurrencia | **SKIPPED: 14 pruebas** por ausencia de proyecto/conexión/fixtures |
| Advisors Supabase y generación oficial de tipos | **SKIPPED** sin entorno Supabase |

Fallos encontrados y resueltos: fixtures P2 con configuración/run inválidos bajo P5; pruebas P6-B con escrituras directas de asignación ahora revocadas por P6-C; expectativas de placeholders P4/P6-C desactualizadas; contratos globales incompletos de B/C; debounce inicial de paginación. Las primeras corridas con estos fallos no se reportan como PASS. La instalación offline encontró un paquete no cacheado; se reutilizaron dependencias existentes y `npm ls --depth=0` pasó. Deno necesitó caché en work/; su verificación final pasó. No se atribuyen resultados históricos de las ramas a esta validación.

WASM usa PostgreSQL real compilado a WASM, **una sesión** y stubs Auth/Storage/aserciones; no es Supabase real ni la extensión pgTAP. E2E usa SDK real con HTTP aislado, no servicios remotos. El conector Supabase devuelve `projects: []`. No se certifican carreras multisesión, PostgREST ni Storage real.

## Reproducción y puesta en marcha pendiente

Desde el worktree: `npm run typecheck`, `npm run lint`, `npm test -- --maxWorkers=2`, `npm run build`, `npm run test:e2e`; runners `tests/run-p4-e2e.mjs --project=auth --grep P4`, `tests/matching/run-e2e.mjs`, `tests/advisors/run-e2e.mjs`, `tests/p6b/run-e2e.mjs`, `tests/assignments/run-e2e.mjs`, `tests/p7/run-e2e.mjs` con Node. Para SQL, configurar `PYR_PGLITE_MODULE` con un módulo PGlite externo y ejecutar `node tests/sql/run-integrated-wasm.mjs`. El flag `--write-types` reconstruye exclusivamente el fallback, no tipos oficiales.

Pendiente antes de producción: provisionar Supabase desechable, aplicar 001–011/seed revisados, ejecutar pgTAP P2–P7 y pruebas reales RLS/PostgREST/Storage y multisesión (cupos, estudiante duplicado, cambios de asesor y membresía frente a retiro); ejecutar advisors; generar tipos oficiales y revisar diferencias; configurar URL/clave pública/redirects y primer ADMIN. Las pruebas runtime P7 requieren `P7_PG_MODULE`, `P7_POSTGRES_URL` y `P7_ALLOW_DISPOSABLE_TESTS=yes`; las demás conservan variables documentadas por A/B/C.

Los locks compartidos de C y los locks de membresía pueden producir rechazo/deadlock ante escrituras concurrentes; se debe actualizar y reintentar tras revisar el estado, nunca abrir permisos para resolverlo. La ausencia de pruebas reales impide certificar ese comportamiento operativo. Permanecen los límites documentados de C: snapshot completo, sin clave de idempotencia persistida, recargar ante respuesta de commit incierta, motivos/aprobaciones provisionales pendientes de validación institucional. No hubo despliegue, push ni cambios de base remota.
