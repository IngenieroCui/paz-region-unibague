# Integración P4 / P5

Componente: export default y named `MatchingWorkspace` desde `src/features/matching/MatchingWorkspace.tsx`. Ruta exacta esperada **`/app/admin/matching`**, bajo RequireRole ADMIN y el AppShell/UnsavedChanges existentes. No necesita props ni provider nuevo. Importa su CSS propio, reutiliza componentes/tokens, Auth/RLS y cliente Supabase existente. No depende de internos de Projects/Admin/Student/Organization.

Import para el router P4 (desde src/app):

```tsx
const MatchingWorkspace = lazy(() => import('../features/matching/MatchingWorkspace'))
// Child de la ruta /app/admin, protegido por RequireRole ADMIN:
{ path: 'matching', element: <MatchingWorkspace /> }
```

P4 conecta esa ruta y la navegación ADMIN correspondiente, conservando Suspense/errorElement. **P5 no modifica router.tsx, navigation.ts, layouts, database.types.ts, package/lock ni otras features.** No crear Assignments ni botones de asignación al integrar. P6 decide cupos/globalidad/overrides.

## Backend

1. Aplicar P2+P3, P4 cuando corresponda, y la única migración P5 `supabase/migrations/202610010007_matching_p5.sql`. No editar migraciones anteriores. Mantiene tablas/columnas y RLS existentes; los tipos P2/P3 siguen compatibles (solo triggers e índices nuevos).
2. Desplegar `supabase functions deploy matching-run`. La función tiene deno.json propio para fijar Supabase JS 2.117.2. Mantener verificación JWT de gateway cuando el tipo de claves del proyecto sea compatible; el handler siempre verifica JWT con getUser y exige ADMIN persistido. No usar --no-verify-jwt como sustituto de autorización. Consultar compatibilidad del gateway con claves modernas en la instancia antes del despliegue.
3. Secrets Edge: `PYRUNIBAGUE_ALLOWED_ORIGINS` con origins exactos autorizados. SUPABASE_URL y SUPABASE_ANON_KEY son configuración propia del runtime. Para embeddings opcionales añadir PYRUNIBAGUE_AI_BASE_URL, PYRUNIBAGUE_AI_API_KEY y PYRUNIBAGUE_AI_EMBEDDING_MODEL; BASE_URL sin `/embeddings` final, p.ej. un base /v1. Ningún secret IA en VITE_ ni en frontend.
4. ADMIN crea una configuración real en UI. Plantilla UX no seed; siete pesos suman 100, umbral editable, requiredSkillsAreHardConstraint y semanticEnabled explícitos. Semántica desactivada inicialmente hasta opt-in. Configuración utilizada: duplicar para cambiar significado, nombre/is_active siguen gestionables.

## UI e integración de datos

Secciones internas Resumen, Configuraciones, Ejecutar, Resultados. Periodos/configuraciones de BD real, historial paginado y refresh explícito, confirmación antes de run. Ranking de 25 parejas por página con filtros DB y scores/bloqueos/recomendación. Detail en dialog nativo, pesos efectivos, fortalezas, gaps, explanation y modo semántico. No se muestra matriz completa. UI consulta solo resultados completed; failed/running informan estado y no validan batches parciales. Usar el umbral del snapshot del run, no la configuración actualmente seleccionada.

P6 puede leer MatchCandidates del run completed y comprobar is_eligible/total_score/component_scores/blockers/recommendations. Recomendación derivada con summary.configuration_snapshot.minimum_recommended_score; no nueva columna. No considerar candidate ranking una asignación ni aplicar cupos durante P5.

## Verificación reproducible

```text
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
node scripts/run-e2e.mjs --config tests/matching/playwright.config.ts
git diff --check
deno check --config supabase/functions/matching-run/deno.json supabase/functions/matching-run/index.ts
supabase test db
node --test tests/matching/runtime.test.mjs
node --test tests/matching/concurrency.test.mjs
```

WASM suplementario: instalar @electric-sql/pglite fuera del package/lock del proyecto, definir P5_PGLITE_MODULE como URL file:// del módulo instalado y ejecutar `node tests/matching/wasm.mjs`. El script no instala dependencias automáticamente. Auth/Storage son stubs; no certificar Supabase con ese resultado.

Runtime HTTP: configurar P5_SUPABASE_URL, P5_SUPABASE_ANON_KEY, P5_ADMIN_JWT, P5_STUDENT_JWT, P5_ORGANIZATION_JWT, P5_PERIOD_ID y P5_CONFIGURATION_ID en un entorno aislado. Sin ellos los cuatro tests indican SKIPPED real. Concurrencia real: configurar P5_PG_MODULE (URL de módulo pg instalado fuera del package/lock), P5_POSTGRES_URL, P5_ADMIN_USER_ID y los mismos IDs. El test abre dos transacciones, comprueba espera por lock y rechazo 23505 tras commit del primero; conserva su run como failed al terminar. Sin driver/runtime es SKIPPED. Ambos requieren una instancia desechable, no producción.

## Pendientes operativos

Conectar ruta/navigation por P4; aplicar migración/desplegar Edge/configurar origins y secrets; pruebas Supabase/Auth/RLS/pgTAP y concurrencia entre sesiones reales; configuración/catálogos/elegibilidad institucional. Revisión de datos profesionales antes de habilitar envío externo. CV no analizado. Cola/checkpoints/snapshot de inputs para volúmenes mayores o mayor exigencia de reproducibilidad. No se ha desplegado ni ejecutado contra producción.

Los límites y recuperación de runs interrumpidos están documentados en MATCHING_ENGINE.md. Nunca borrar histórico para liberar concurrencia.
