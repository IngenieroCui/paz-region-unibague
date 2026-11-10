# Estabilidad preentrega · 10 de noviembre de 2026

Repositorio: IngenieroCui/paz-region-unibague. Rama: `fix/preentrega-estabilidad`.
Base local y remota contrastada: `b9193e871a732610eafbe4266bb1f9ce3ae8142d`.
Destino exclusivo de pruebas reales: `paz-region-demo`, `irykykwhvattrduuqxhj`.

El flujo principal quedó verificado con las nueve cuentas demo y los cuatro roles. Se corrigieron fallos de carreras, esperas, datos obsoletos, reintentos y conservación de borradores. Las comprobaciones reales y las pruebas con respuestas controladas se distinguen a continuación. Este informe pertenece al commit de estabilización de esta rama; no implica que ese commit ya esté desplegado en producción.

## Hallazgos reproducidos y correcciones

P1: puede interrumpir una demostración o inducir una operación repetida. P2: inconsistencia funcional o bloqueo de validación.

| ID | Severidad | Reproducción y evidencia anterior | Causa | Corrección y verificación |
| --- | --- | --- | --- | --- |
| B01 | P1 | Resolver SIGNED_IN y sus roles; rechazar después el getSession inicial. El proveedor cambiaba de authenticated a error. Test de carrera falló antes del cambio. | El catch de inicialización invalidaba eventos más recientes. | El evento Auth tiene precedencia sobre la lectura inicial, también si esa lectura falla. Test de respuesta tardía pasa. |
| B02 | P1 | Dejar pendientes getSession o la RPC de roles: después de 20.001 ms seguía loading. Dos regresiones fallaron antes del cambio. | Esperas del SDK y HTTP sin un límite de aplicación. | Límite de 15 s para inicialización/verificación; fetch abortable de 20 s para Auth/datos y 120 s para funciones/Storage. Fallo cerrado, respuesta tardía descartada y reintento explícito del guard. E2E de RPC detenida y sesión expirada pasan. |
| B03 | P2 | Capturar los renders al cambiar el loader de periodo: el primer frame aún exponía el dato anterior. Test falló antes del cambio. | La limpieza ocurría en el efecto/microtarea, después del render. | Vincular el estado a loader y revisión; ocultar inmediatamente datos anteriores al cambiar filtros, recargar o deshabilitar. Regresión de frames y respuesta tardía pasa. |
| B04 | P1 | Rechazar invoke tras enviar matching: el error de red carecía de clasificación y el botón permitía repetir desde la confirmación. Tests de servicio y pantalla fallaron antes del cambio. | La confirmación ignoraba la incertidumbre de una respuesta perdida; el índice remoto protege ejecuciones simultáneas, pero no impide repetir una ya completada. | Invoke con límite de 120 s; error seguro UNCERTAIN_RUN; cerrar confirmación y exigir actualizar/revisar historial antes de habilitar otra ejecución. Mensajes diferenciados para 401, ADMIN_REQUIRED y ejecución en curso. Sin reintento automático de escrituras. |
| B05 | P2 | Calcular propuesta y pulsar Actualizar ejecuciones con metadata pendiente: desaparecía el borrador. Test falló antes del cambio. | El loading de metadata desmontaba PeriodWorkspace. | Conservar el workspace cuando ya existen metadatos y presentar el refresco/error sin desmontarlo. Test de conservación pasa; comprobado también con propuestas reales. |
| B06 | P2 | Solicitar recuperación con una cuenta pyrdemo.*: el SDK recibía resetPasswordForEmail. El test ampliado falló antes del cambio. | La exclusión de identidades ficticias solo contemplaba pyrprueba.*. | Bloquear las nueve identidades demo actuales y conservar la exclusión anterior. Test comprueba que no se envía ninguna petición de recuperación. |
| B07 | P2 | npm run lint devolvía 1 con 12 warnings: código inalcanzable en el seeder y variable sin uso. | Restos de confirmación automática después de un return y asignación innecesaria. | Retirar únicamente código que nunca se ejecutaba y la variable. Lint devuelve 0. No se ejecutó ningún seed. |

Endurecimiento adicional, comprobado con respuesta controlada: el servicio aceptaba un snapshot del mismo periodo perteneciente a otra ejecución. Ahora exige el run solicitado, completado y del periodo correcto; no se observó que el servidor real devolviera esa respuesta incorrecta.

Se corrigió además el texto obsoleto de Asignaciones que anunciaba la asesoría como pendiente de integración. La confirmación real devolvió advisor=linked y group=selection_required: la asesoría se integra y el equipo se selecciona después.

## Validación ejecutada

| Comando o comprobación | Resultado exacto | Alcance |
| --- | --- | --- |
| npm ci --no-audit --no-fund --prefer-offline --cache ../npm-cache --maxsockets=4 | Salida 0; 443 paquetes | Instalación con lockfile existente. Antes hubo EPERM en la caché global y ECONNRESET; ambos se resolvieron con caché de workspace y reintento. |
| npm run typecheck | Salida 0 | TypeScript estricto. |
| npm run lint | Salida 0, cero warnings de Oxlint | Los 12 warnings iniciales fueron corregidos. |
| npm test | Salida 0; 39 archivos, 330 tests PASS | Incluye 18 tests nuevos y ampliación del caso de recuperación. |
| npm run build | Salida 0 | Vite, worker del optimizador y PWA; 64 entradas de precache. |
| PYR_E2E_PORT_OFFSET=50 npm run test:e2e | Salida 0; 40 tests PASS | Edge real; fixtures HTTP para Auth/CRUD, accesibilidad, responsive, guards, recuperación PKCE y PWA. |
| PYR_E2E_PORT_OFFSET=50 npm run test:e2e -- --project=auth --grep "expired sessions\|stalled role" | Salida 0; 2 tests PASS | Casos nuevos: refresh token inválido y RPC detenida que falla cerrada, descarta el resultado tardío y permite reintento. Total E2E verificado: 42. |
| node --test tests/p12/seed.test.mjs | Salida 0; 5 tests PASS | Idempotencia, intención de escritura, ambigüedad, identidad y restricción de proyecto; sin seed remoto. |
| node tests/sql/run-integrated-wasm.mjs con PYR_PGLITE_MODULE configurado | Salida 0; 540 aserciones PASS | PostgreSQL WASM, catálogo de 45 tablas/381 columnas/60 FK/32 RPC, RLS, matching, capacidad, duplicados y transacciones. Auth/Storage son stubs. No certifica concurrencia entre conexiones Supabase. |
| git diff --check | Salida 0 | Sin errores de whitespace. |

Las siete regresiones iniciales fallaron en seis archivos antes de sus correcciones. Después se reprodujeron dos fallos del servicio de matching y uno de la confirmación incierta; las pruebas finales pasan. Las pruebas no introducen resultados ficticios en Supabase.

## Evidencia real de Supabase y navegador

- Nueve cuentas: login, rol persistido exacto, refreshSession y logout PASS. ADMIN, STUDENT, ORGANIZATION y ADVISOR recorrieron sus espacios, recargaron la página y conservaron sesión. Las cuentas sin ADMIN fueron denegadas al abrir Matching directamente.
- Los ocho usuarios sin ADMIN recibieron HTTP 403 al invocar matching-run y SQLSTATE 42501 al solicitar el snapshot administrativo. Se usaron sesiones de usuario y clave pública; no se utilizó service_role.
- Navegador Edge contra el frontend local corregido y Supabase demo: nueve cuentas, tres rutas por cuenta, retorno desde acceso denegado, cierre de sesión y guard sin sesión. Un recorrido de estudiante agotó inicialmente la espera artificial de networkidle sin errores HTTP/JavaScript; se repitió con condiciones de contenido visible y pasó. No se clasificó como bug de la aplicación.
- El dominio publicado https://paz-region-unibague.vercel.app/login respondió HTTP 200. Desde ese origen autorizado, ADMIN ejecutó matching real: `bbea95a7-94b2-4847-a4fa-9efda962959a`, HTTP 200, 532 ms, 18 candidatos persistidos, seis elegibles/recomendados y doce bloqueados. Se verificaron los filtros y el detalle. Algoritmo hybrid-v0.1, umbral histórico 70, semántica desactivada.
- El optimizador del frontend corregido calculó tres propuestas reales. Actualizar ejecuciones conservó el borrador. La confirmación individual por pyr_unibague_confirm_assignment respondió HTTP 200 y creó `e8eb488f-ec86-4744-a912-dbb88f57d025`; asesoría `linked`, equipo `selection_required`.
- El estudiante principal consultó su asignación confirmada por la proyección autorizada. El asesor2 y entidad2 ven el estudiante/asignación correspondiente; asesor1 y entidad1 no ven ese registro. La consulta de asesoría usa la RPC autorizada, respetando la restricción de acceso directo a participaciones.
- Negativos reales: estudiante ya asignado rechazado con 23514, estudiante repetido en un lote con 22023, revisión obsoleta con P0001 y estudiante no elegible con 23514. Las peticiones rechazadas no cambiaron la revisión del snapshot. No hay duplicados activos ni ocupación superior a capacidad.
- Estado dejado para presentar: una asignación activa del estudiante principal, dos estudiantes elegibles disponibles para nuevas propuestas y estudiante4 deliberadamente no elegible. No se borraron historiales ni se sembraron datos nuevos.
- Inspección remota de solo lectura: las 45 tablas PYR tienen RLS activo; se conservan los índices únicos de estudiante/periodo activo y ejecución running por periodo/configuración.

## Archivos modificados

```text
docs/PREENTREGA_STABILITY_2026_11_10.md
scripts/run-demo-matching.mjs
scripts/seed-pilot-complete.mjs
src/features/assignments/AssignmentsWorkspace.tsx
src/features/assignments/AssignmentsWorkspace.test.tsx
src/features/assignments/services.ts
src/features/assignments/services.test.ts
src/features/auth/AuthProvider.tsx
src/features/auth/AuthProvider.test.tsx
src/features/auth/AuthProvider.deadline.test.tsx
src/features/auth/RequireRole.tsx
src/features/auth/services/auth.ts
src/features/auth/services/auth.test.ts
src/features/matching/MatchingWorkspace.tsx
src/features/matching/MatchingWorkspace.test.tsx
src/features/matching/services.ts
src/features/matching/services.test.ts
src/features/matching/useMatchingResource.ts
src/features/matching/useMatchingResource.test.tsx
src/lib/supabase/client.ts
src/lib/supabase/deadline.ts
src/lib/supabase/request.ts
src/lib/supabase/request.test.ts
tests/e2e/auth.spec.ts
```

No se modificaron estilos, tokens, layouts, navegación, reglas académicas, algoritmo, Edge Function, migraciones aplicadas, RLS ni privilegios. El checkout original se conservó; la implementación se hizo en una copia aislada.

## Pendientes y límites para la demo

1. El commit de esta rama debe integrarse/desplegarse para que las correcciones estén en la URL pública. El recorrido publicado prueba el happy path de la versión existente; las regresiones y la asignación se comprobaron en el frontend local corregido conectado al mismo demo.
2. CORS remoto admite el dominio público autorizado y rechaza localhost con 403 ORIGIN_NOT_ALLOWED. Se mantuvo la restricción. Un preview de otra URL necesita autorización específica de origen; publicar el frontend en otra URL por sí solo no habilita matching.
3. Capacidad y transacciones se verificaron en SQL aislado y el estado real cumple sus invariantes. No se agotó deliberadamente una plaza ni se certificó una carrera de varias conexiones sobre el último cupo en Supabase remoto.
4. Google y registro público continúan desactivados por decisión existente. No se enviaron correos ni se certificó SMTP; la recuperación se probó con fixtures y las cuentas ficticias permanecen bloqueadas para correo.
5. Persisten avisos de React Router sobre HydrateFallback y POP tras un ancla nativa. No bloquearon los 42 E2E ni los recorridos reales. Se dejan como prioridad baja para coordinar cambios en router/layouts.
6. El equipo de proyecto requiere selección posterior; esto se informa expresamente y no invalida la asignación ni el asesor vinculado.

## Recorrido recomendado · presentación 10:30 a. m. Colombia

1. Abrir /login. Mostrar acceso universitario y acceso de organizaciones. Usar las credenciales privadas entregadas; no proyectarlas.
2. STUDENT principal: panel, perfil y Mi asignación. Mostrar destino confirmado y asesor. Cerrar sesión.
3. ORGANIZATION entidad2: proyectos/plazas y la asignación propia. Cerrar sesión. ADVISOR asesor2: estudiantes y organizaciones propios. Cerrar sesión.
4. ADMIN: Matching, periodo `2026B · Paz y Región Demo`, configuración `PYR-DEMO-2026B · TEST · Matching estructurado`. Ejecutar una sola vez y esperar respuesta. Mostrar historial, seis recomendaciones, doce bloqueos y detalle del score; aclarar que el componente semántico está desactivado.
5. Asignaciones: seleccionar esa ejecución completada, Optimizar y revisar, Calcular propuesta. Revisar estudiantes disponibles, cupos y umbral. Confirmar una decisión o lote; consultar Historial. Recordar que el estudiante principal ya tiene una asignación y no debe duplicarse.
6. Mostrar estudiante4 como no elegible y un acceso de STUDENT a /app/admin/matching como denegado. Volver a su espacio y cerrar sesión.

Si una ejecución no confirma respuesta, actualizar y revisar el historial antes de repetir. Ante una revisión obsoleta de asignaciones, actualizar cupos y recalcular. No alterar permisos, elegibilidad ni capacidad para conseguir un resultado de presentación.

Referencias técnicas usadas para contrastar las APIs: [eventos Auth de Supabase](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) y [invocación de Edge Functions](https://supabase.com/docs/reference/javascript/functions-invoke).
