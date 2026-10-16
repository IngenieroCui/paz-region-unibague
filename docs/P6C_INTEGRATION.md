# P6-C · Optimización global y asignaciones definitivas

Base: `dev` / `b7502fe`, P4+P5. Rama exclusiva `feat/p6c-assignments`. Implementación aditiva sobre Assignments y AssignmentEvents existentes. No hay tablas de propuestas ni cambios en las fórmulas `hybrid-v0.1`, rutas, navegación, Auth, tipos globales, package/lock o módulos de A/B.

## Flujo y superficies exportadas

`MatchingRun completed → snapshot administrativo → propuesta local → revisión → RPC transaccional → Assignment + eventos`.

- `AssignmentsWorkspace`, named y default: `src/features/assignments/AssignmentsWorkspace.tsx`.
- `AssignmentReadList`: componente de lectura reutilizable para Student/Organization, paginado de 25, bajo RLS. Props: `periodId`, `studentId?`, `positionIds?`, `activeOnly?`, resolutores opcionales `studentLabel`/`positionLabel`. No concede acceso adicional; pasar únicamente labels que el consumidor ya pueda consultar. El filtro no reemplaza RLS. Remontar con `key` al cambiar los filtros para reiniciar su página.
- `AssignmentEventHistory`: lectura administrativa paginada; eventos y justificaciones conservan RLS ADMIN-only.
- `AssignmentIntegrationContext` y `AssignmentIntegrationBoundary`: contratos TypeScript para coordinación, sin implementación de escrituras cliente a tablas futuras.

Integración prevista por el responsable de router/navigation, **no realizada por C**:

```tsx
const AssignmentsWorkspace = lazy(() => import('../features/assignments/AssignmentsWorkspace'))
// Dentro de /app/admin con RequireRole ADMIN, AppShell y Suspense existentes:
{ path: 'assignments', element: <AssignmentsWorkspace /> }
```

El workspace no requiere props ni providers nuevos. Reutiliza el cliente Supabase, componentes y tokens existentes. Incluye Resumen, Optimizar y revisar, Intervención manual e Historial; tablas de propuestas/cupos/no asignados/historial/eventos paginadas, búsqueda, filtros por proyecto/estudiante, agrupación ordenada por organización/proyecto, diálogos nativos, carga/error/vacío, cancelación del worker y responsive con tablas desplazables por teclado. La compatibilidad aparece antes de la confirmación y no equivale a una asignación. Cambiar periodo o run descarta el borrador; no se guarda en localStorage.

## Solver y modelo del borrador

Función pura `solveAssignments(snapshot, excludedCandidateIds?)` en `src/features/optimizer/solveAssignments.ts`. Sin imports de Supabase ni del motor de matching; no muta inputs. La UI ejecuta la misma función en `optimizer.worker.ts` para no bloquear el hilo principal. Termina el worker al cambiar contexto/desmontar/actualizar y descarta resultados anteriores.

Red bipartita con capacidades: fuente→estudiante (1), estudiante→plaza (1), plaza→sumidero (capacidad restante). Flujo de coste mínimo mediante caminos aumentantes, potenciales, Dijkstra y heap binario. Aumenta hasta agotar caminos: primero maximiza cardinalidad, después minimiza `10000 - score_en_centésimas`, equivalente a maximizar la suma de scores para esa cardinalidad. Nodos/aristas/heap se ordenan por identificadores y las relajaciones de coste igual conservan el primer camino estable. Los scores P5 se almacenan con dos decimales; valores no finitos/fuera de 0–100 o con precisión ajena a P5 se excluyen, sin modificar las fórmulas de P5.

Complejidad `O(F E log V)`, memoria `O(V+E)`. Benchmark local: 400 estudiantes, 120 plazas de capacidad 4 y 48.000 candidatos; 400 asignados, suma 39600,99, aproximadamente 652–994 ms en ejecuciones locales. No es una garantía de latencia de red/Supabase. El caso Juan/Carlos produce Juan→B=92 y Carlos→A=94, suma 186.

`AssignmentSnapshot` lleva periodo, run, snapshot de configuración y umbral histórico, estudiantes/participaciones actuales, plazas/proyecto/organización, candidatos históricos, ocupación confirmada y `revision`. El servidor añade versiones de registros y relaciones de programas/habilidades al estado cuya revisión calcula. `currentEligible` añade una comprobación conservadora de restricciones actuales a cada candidato, sin sobrescribir `is_eligible`, blockers ni scores históricos.

`Proposal` contiene `rows[{studentId,positionId,candidateId,score}]`, `unassigned[{studentId,reasons}]`, `occupied`, `available`, `totalScore` y `eligibleStudents`. Las exclusiones son IDs de candidato locales, se aplican antes del solver y recalculan globalmente. Confirmar individualmente/manual/lote invalida todo el borrador restante y recarga cupos; debe recalcularse para seguir confirmando.

Solo se usan runs completed del periodo, estudiantes activos con participación elegible, candidatos elegibles sin blockers con score válido ≥ umbral histórico, plazas activas/capacidad positiva y proyectos del mismo periodo. Se conserva toda ocupación activa: ningún estudiante asignado vuelve al pool libre ni se mueve por optimización. Posiciones no habilitadas no ofrecen cupos automáticos.

Política conservadora provisional: `Project.status='approved'`, `Organization.status='approved'` y `verified_at IS NOT NULL`, coherentes con la revisión P4. Se aplica también a intervenciones manuales para evitar excepciones institucionales silenciosas. No es normativa oficial. Se debe validar con la Universidad antes de habilitar producción. Si falta el umbral del snapshot, la optimización/confirmación basada en candidato falla cerrada; no se inventa uno.

## Migración 010 y RPC

Aplicar `supabase/migrations/202610010010_assignments_p6c.sql` después de 001–007 y coordinar 008/009 de A/B. No depende de tablas A/B. No se aplicó a un proyecto remoto. El CLI/Docker no estaba instalado: se utilizó el nombre reservado 010 y el formato del repositorio; el integrador debe verificar la lista de migraciones con su CLI antes de aplicar. No editar migraciones ya aplicadas.

| RPC pública | Argumentos | Resultado |
| --- | --- | --- |
| `pyr_unibague_assignment_snapshot` | `p_period_id uuid`, `p_run_id uuid DEFAULT NULL` | JSON del estado y `revision` |
| `pyr_unibague_confirm_assignment` | `p_period_id uuid`, `p_run_id uuid`, `p_revision text`, `p_action jsonb` | Array JSON con assignment_id e integraciones pendientes |
| `pyr_unibague_confirm_assignment_batch` | los tres primeros anteriores, `p_actions jsonb` | Array JSON; todo o rechazo total |
| `pyr_unibague_reassign_assignment` | como singleton | Nueva asignación e historial anterior cerrado |
| `pyr_unibague_unassign_assignment` | como singleton | Array JSON con closed_id |

`p_run_id` puede ser null para intervención manual sin evaluación histórica. `services.ts` amplía localmente los tipos RPC sin editar `database.types.ts`; regenerar los globales durante la integración coordinada.

Acción de confirmación automática:

```json
{
  "kind": "confirm",
  "student_id": "UUID",
  "position_id": "UUID",
  "candidate_id": "UUID",
  "source": "MATCHING"
}
```

Acción manual añade `source:"MANUAL"`, `reason_code`, `reason_text` (obligatorio, hasta 2000 caracteres). Reasignar/retirar añade `assignment_id` vigente; retirar no requiere destino/candidato. Las RPC singleton fijan su kind, sin confiar en el kind recibido. Lote público admite únicamente confirmaciones, 1–500 acciones y estudiantes distintos. La reasignación y el retiro se revisan individualmente en la UI.

Motivos provisionales: `INSTITUTIONAL_NEED`, `AUTHORIZED_SPECIAL_CASE`, `CONFLICT_OF_INTEREST`, `COORDINATION_REQUEST`, `DATA_CORRECTION`, `OTHER`. No son normas oficiales. Todos requieren justificación.

Manual debajo del umbral requiere candidato válido, run completed, motivo y `allow_below_threshold:true`, mediante checkbox y diálogo final. Sin candidato requiere motivo y `allow_unscored:true`, también con confirmación explícita. Si hay candidato en el run seleccionado no se puede ocultar su ID para evadir su revisión. Sin run se permite intervención manual explícitamente sin score histórico, manteniendo elegibilidad, aprobaciones, capacidad, periodo y requisitos actuales; no se fabrican compatibilidades ni umbrales. Un candidato bloqueado no se confirma mediante flags. Las excepciones a restricciones institucionales quedan pendientes de validación externa, sin bypass.

En todos los caminos se verifican programas obligatorios actuales. Se verifican habilidades obligatorias según la regla histórica del run; sin candidato se usa la opción conservadora de exigirlas. Esto comprueba restricciones, no recalcula componentes ni altera el score histórico.

## Seguridad, integridad y auditoría

- RPC con ADMIN persistido y `auth.uid()`; `SECURITY DEFINER` acotado, search_path vacío, nombres cualificados, EXECUTE PUBLIC/anon revocado y authenticated solo para entradas públicas. Helpers privados sin EXECUTE para authenticated.
- Se revocan INSERT/UPDATE/DELETE directos de Assignments y AssignmentEvents para authenticated, **también ADMIN**. Los consumidores administrativos deben utilizar RPC; conservar esta revocación al integrar otras migraciones. Las policies SELECT existentes siguen permitiendo lectura propia/de organización. Eventos y motivos permanecen ADMIN-only; la justificación privada no se copia a `Assignments.notes`.
- Se bloquea la fila del periodo como punto común de serialización de confirmar/reasignar/retirar; se bloquean posiciones y registros de elegibilidad/proyecto/organización/candidatos hasta commit. Las relaciones de programas/habilidades usan SHARE de tabla durante la transacción corta para cubrir inserciones/ediciones de hijos. Esto también serializa modificaciones de dichas relaciones durante confirmación y puede afectar brevemente otros periodos.
- Después de adquirir locks se recalcula la revisión MD5 del estado autoritativo y se compara con el borrador. Es control de obsolescencia, **no autorización ni firma de confianza**. Cada acción vuelve a comprobar en servidor identidad/relaciones/estado/elegibilidad/ocupación. La propuesta cliente no proporciona scores autoritativos ni capacidad.
- `P0001` indica estado/cupo desactualizado; mensaje seguro exige actualizar y recalcular. `23514` señala restricciones actuales; `42501` denegación; `22023` entrada/motivo inválido. Deadlock/serialización se presentan como cambio concurrente, sin reintento automático de writes. Errores de red requieren actualizar historial/cupos antes de reintentar: una respuesta perdida no prueba que el commit no ocurrió.
- El índice parcial original mantiene una asignación activa por estudiante/periodo. Los conteos de capacidad se hacen dentro de la transacción bajo los mismos locks; un lote inválido revierte todas las inserciones, cierres y eventos. Nunca hay confirmaciones parciales reportadas como éxito.
- Reasignar cierra la anterior y crea una nueva; retirar solo marca inactiva con unassigned_at. Actor/assigned_at/candidate/source se fijan en servidor. Eventos `ASSIGNED`, `UNASSIGNED`, `REASSIGNED_FROM`, `REASSIGNED_TO` conservan actor, motivo y referencias, además de la auditoría técnica existente.
- Triggers prohíben borrar/reabrir/reescribir historial; solo permiten cierre y anonimización por FK de actor eliminado. Capacidad no puede bajarse por debajo de la ocupación. Proyectos/plazas con histórico no pueden trasladarse de periodo/organización/proyecto. La migración rechaza ocupación activa preexistente incoherente o sobrecapacidad, sin modificar histórico: requiere reconciliación administrativa explícita.
- No se usan service_role, secrets de IA ni datos médicos. No se mutan runs completados. Las credenciales privilegiadas de mantenimiento deben tratarse como parte de la base de confianza; no otorgar grants directos que reabran un camino alternativo de escritura.

## Contrato transaccional para A/B

Hook privado existente en 010:

```sql
pyr_unibague_private.assignment_integrations(
  p_operation text, -- confirm | reassign | unassign
  p_assignment_id uuid,
  p_previous_assignment_id uuid,
  p_actor_id uuid
) returns jsonb
```

Hoy devuelve `{ "advisor":"pending_integration", "group":"pending_integration" }`, sin escribir ni suponer tablas A/B. Es invocado dentro de la misma transacción después de insertar la nueva asignación; en retiro recibe la asignación cerrada. En reasignación recibe nueva y anterior. Sus estados pendientes aparecen en metadata de eventos de alta. No publica una API adicional a usuarios.

Durante la integración, A/B y el responsable SQL deben reemplazar este helper en **otra migración**, conservando firma y permisos, para:

1. Leer y bloquear el asesor vigente de la organización al confirmar (no usar un asesor enviado por el cliente ni inferirlo del login).
2. Crear la responsabilidad histórica del estudiante con asignación, periodo, asesor, fechas y actor; cerrar la anterior al reasignar/retirar. Si falla, revertir toda la transacción.
3. Mantener una operación administrativa independiente y auditada para cambiar la responsabilidad de un estudiante, sin modificar retrospectivamente el vínculo original.
4. Validar grupo activo del mismo proyecto/periodo, límites y membresía única antes de insertar/retirar GroupMembers. Si la selección de grupo no forma parte aún de la decisión, devolver pendiente explícito; no elegir grupos arbitrariamente.

El helper obtiene contexto autoritativo uniendo Assignment→Position→Project→Organization. `AssignmentIntegrationContext` documenta el equivalente para componentes/adaptadores, pero ninguna implementación cliente debe escribir responsabilidad histórica después del commit. AdvisorStudentAssignments, AdvisorOrganizationAssignments, Groups y GroupMembers no se leen ni se escriben en esta rama. Coordinar orden de locks con A/B y ampliar pruebas de carreras antes de activar esos enlaces.

## Pruebas y comandos

```text
npm run typecheck
npm run lint
npm test
npm run build
node tests/assignments/run-e2e.mjs
node node_modules/vite/bin/vite.js build --config tests/assignments/vite.config.ts
node --experimental-strip-types tests/assignments/benchmark.mjs
git diff --check
supabase test db
node --test tests/assignments/runtime.test.mjs tests/assignments/concurrency.test.mjs
```

El runner E2E usa puerto exclusivo 5416, SDK real y HTTP simulado; cubre flujo global, revisión sin writes anticipados, lote desactualizado, intervención/reasignación/retiro, historial, teclado, paginación, móvil sin overflow de página y axe. Harness solo DEV, sin ruta productiva. El build adicional compila el componente exportado y su worker aunque la ruta aún no esté conectada. No sustituye el build normal.

Unitarias: caso global 186, cardinalidad prioritaria, capacidades 1/múltiple, sin candidatos, threshold, blockers, restricciones actuales, empates estables, ocupación/estudiantes previos, periodos, exclusiones, reapertura de cupo, input inmutable, oracle exhaustivo independiente de 120 grafos pequeños y benchmark. Servicios/UI prueban RPC, revisión final, errores, no ADMIN, exclusión, intervención sin score e historial.

`supabase/tests/p6c_assignments.test.sql`: 68 aserciones pgTAP con fixtures transaccionales revertidas. Seguridad/RLS, umbral/snapshot/blockers, identidad, elegibilidad/estados actuales, capacidad, batch exitoso/atómico fallido, retiros/reasignaciones/historial y boundary A/B. El runtime ejecuta el mismo archivo contra PostgreSQL real y falla ante cualquier `not ok`.

Suplemento WASM: instalar PGlite fuera del package/lock del proyecto y definir `P6C_PGLITE_MODULE` con URL file:// de su módulo; ejecutar `node tests/assignments/wasm.mjs`. Aplica 001–007 y 010 con stubs de Auth/Storage. PASS suplementario no certifica Supabase ni carreras entre conexiones.

Concurrencia real: definir `P6C_PG_MODULE` (URL file:// del módulo pg externo), `P6C_POSTGRES_URL` (base Supabase **desechable**, migraciones aplicadas) y `P6C_ALLOW_DISPOSABLE_TESTS=yes`. Se crean fixtures únicas y se abren dos sesiones autenticadas más un observador. La segunda debe esperar un lock real y rechazar P0001 después del commit de la primera; se verifica ocupación final=1 y ninguna sobrecapacidad. Prueba tanto estudiantes diferentes sobre el mismo cupo como el mismo estudiante sobre plazas diferentes. Estas fixtures permanecen, pues el histórico no se borra; destruir la base desechable al terminar, no ejecutar sobre producción.

HTTP runtime de denegación: `P6C_SUPABASE_URL`, `P6C_PUBLIC_KEY`, `P6C_STUDENT_JWT`, `P6C_ORGANIZATION_JWT`, `P6C_PERIOD_ID` de cuentas/periodo de prueba. Comprueba PostgREST 403/42501 para confirmaciones no administrativas. Nunca imprimir estos valores.

## Validación realizada y pendientes

- Typecheck y lint: PASS.
- Unitarias del repositorio: 192 PASS, incluyendo 36 nuevas.
- E2E P6-C: 5 PASS; axe sin violaciones en historial y propuesta móvil; capturas desktop/móvil inspeccionadas.
- Build general y build independiente del componente/worker: PASS.
- SQL WASM: migraciones 001–007/010 aplicadas, 68 aserciones PASS; únicamente comprobación suplementaria.
- Benchmark: 400 estudiantes/120 plazas/48.000 parejas, 400 asignados; aproximadamente 0,65–0,99 s local.
- Runtime real: 5 SKIPPED por falta de proyecto Supabase conectado, CLI/Docker, driver/conexión PostgreSQL y JWTs de prueba. **Concurrencia real y RLS/PostgREST/Supabase no certificados en este entorno.**

Pendientes operativos: integrar ruta/navigation y componentes de lectura mediante sus responsables; aplicar migración y regenerar tipos globales; ejecutar pgTAP, RLS/HTTP y concurrencia real en Supabase desechable; validar institucionalmente aprobaciones/requisitos/motivos; integrar A/B mediante el helper transaccional. Sin despliegue ni cambios en producción.

Se cotejó `docs/Modelo_Datos_Paz_Region_v04.md`, disponible en el checkout principal durante el trabajo. Se respetan su separación matching/asignación, cupos por plaza, asesores manuales con responsabilidad histórica independiente, equipos derivados de asignaciones reales y límites académicos fuera de alcance. El documento distingue tablas existentes de propuestas; esta rama solo opera sobre las existentes y mantiene A/B pendientes. No se copia ni modifica ese archivo ajeno a C.

Límites: snapshot JSON completo del periodo/run y solver local, orientado a cientos; no paginación transaccional del pool, cola ni optimizador distribuido. El tope P5 de parejas sigue vigente; presupuestar respuesta/memoria para pools muy densos antes de ampliar. Los scores históricos no se recalculan al editar perfiles; se revalidan las restricciones actuales y la obsolescencia del borrador. No hay idempotency key persistida ni recuperación automática de una respuesta de commit perdida: recargar historial antes de repetir. Los vínculos asesor/grupo permanecen explícitamente pendientes.
