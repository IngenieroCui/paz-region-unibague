# P6-B · Validación

13 de octubre de 2026. Rama `feat/p6b-calls-projects`, base `b7502fe`. Los resultados corresponden al worktree aislado y no a un despliegue productivo.

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | PASS, proyectos app y node; tipos compartidos conservados |
| `npm run lint` | PASS, cero warnings |
| `npm test` | PASS, 188 pruebas / 24 archivos; 48 de las features de este bloque |
| `npm run build` | PASS, TypeScript + Vite + generación PWA |
| `node tests/p6b/run-e2e.mjs` | PASS, 7 recorridos con Edge/Playwright, SDK real y HTTP aislado |
| `node tests/run-p4-e2e.mjs --project auth` | PASS, 33 recorridos de regresión Auth/P3/P4 |
| `node tests/p6b/wasm.mjs` | PASS, 53 aserciones SQL suplementarias, migraciones 001–007 + 009 |
| `node --test tests/p6b/remote.test.mjs` | **SKIPPED**, no hay `P6B_DATABASE_URL` configurada |
| Concurrencia PostgreSQL/Supabase entre conexiones | **SKIPPED**, no hay runtime real disponible |
| `git diff --check` | PASS |

La suite P4 emite el warning preexistente de React Router `No HydrateFallback element provided`; no impide los 33 PASS y no se modifica router desde P6-B. La CLI Supabase no está disponible. No se aplican migraciones, semillas ni consultas a bases remotas.

## Cobertura del encargo

| Caso | Evidencia |
| --- | --- |
| Convocatoria con varias posiciones | SQL y navegador crean/vinculan dos plazas de distintos proyectos |
| Cupos diferentes por carrera | SQL comprueba Sistemas=2 y Mecánica=1 en posiciones distintas |
| Capacidad única | SQL/unidades comprueban total 3 aunque una plaza figure en dos convocatorias y tenga varios programas compatibles |
| Aislamiento entre organizaciones | SQL/RLS deniega convocatorias, plazas y membresías de otra institución; RPC del roster también deniega |
| Periodo incorrecto | SQL rechaza plaza de otro periodo y cambios posteriores de periodo en padres vinculados |
| Proyecto rural/urbano | Unidades/SQL validan rural, urban y NULL; navegador guarda zona y actualiza ficha |
| Dos proyectos de la misma organización | SQL y navegador vinculan sus plazas a una convocatoria sin mezclar equipos |
| Varios grupos por proyecto | SQL crea dos grupos; índice parcial evita compartir una asignación activa |
| Integrante de otro proyecto rechazado | SQL comprueba otra organización y otro proyecto de la misma organización |
| Historial de integrantes | SQL y navegador retiran sin borrar; SQL reincorpora con otra fila y retira automáticamente al desasignar |
| Ficha sin asesor/interlocutor | Unidades/navegador muestran ausencia e integración pendiente sin consultar tablas de A |
| Prevención de duplicaciones | UNIQUE de CallPositions, nombre normalizado de grupo e índice parcial de membresía activa |

QA de navegador: responsive a 320, 768 y 1440 px sin desbordamiento horizontal; axe WCAG 2A/2AA/2.1AA/2.2AA sin violaciones en páginas probadas. Se verifican empty/error/retry, Enter para reintentar, estados de consulta, formularios sin gestión, impresión y actualización de capacidad/equipo en la ficha después de guardar. Capturas revisadas de la ficha móvil y convocatoria desktop; fixtures únicamente de prueba.

WASM usa una sola base en memoria y stubs de auth/storage/pgTAP. Las pruebas de navegador interceptan HTTP con fixtures. Ninguna de esas pruebas se presenta como PASS de Supabase real, PostgREST o concurrencia. Antes de producción faltan pgTAP/RLS remoto y pruebas con dos conexiones, integración de rutas y reader institucional de A, alineación del estado confirmed con C y regeneración central de tipos.

El handoff y los comandos están en [P6B_INTEGRATION.md](P6B_INTEGRATION.md).
