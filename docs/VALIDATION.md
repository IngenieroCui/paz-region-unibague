# Validación · Core Schema v0

Ejecutada el 1 de octubre de 2026 en Windows, Node 22.20.0 y Edge headless. Se conservaron todos los tests existentes y los cambios previos del Prompt 1.

| Comprobación solicitada | Resultado |
| --- | --- |
| npm run typecheck | PASS · exit 0 |
| npm run lint | PASS · exit 0, warnings como fallo |
| npm test | PASS · 9 archivos, 45 tests, exit 0 |
| npm run build | PASS · exit 0, PWA generado |
| npm run test:e2e | PASS · 14 tests, exit 0 |
| git diff --check | PASS · exit 0 |
| Aplicar migraciones en Supabase desde cero | SKIPPED · sin Docker/CLI/instancia configurada |
| Supabase DB lint | SKIPPED · sin instancia local |
| pgTAP/RLS en Supabase runtime | SKIPPED · pruebas preparadas, no ejecutadas allí |
| Supabase CLI type generation | SKIPPED · fallback estricto, no CLI-generated |

## Cobertura frontend
Login real mediante SDK, errores accesibles sin diagnóstico interno, loading, recovery y resultado sin enumeración, callback con código válido/expirado/faltante y destinos cerrados, nueva contraseña y confirmación, logout y error, AuthProvider con carga/refresh/error de roles, limpieza y descarte de respuestas después de logout, recuperación sin roles y aislamiento entre identidades. Cero/un/múltiples roles, selector sin persistencia, guard positivo y fail-closed, localStorage y metadata editables no otorgan permisos. Configuración ausente sigue deshabilitando formularios; todos los tests originales siguen pasando.

## Navegador
E2E conserva responsive/axe WCAG 2 A/AA, 2.1 AA y 2.2 AA en seis superficies y cinco tamaños, teclado/drawer, filtros preview, PWA/offline shell y exclusión preview en producción. Añade servidor Auth aislado en 5174 con dominio reservado example.test y respuestas HTTP de fixtures; usa las llamadas reales del SDK sin contactar un proyecto Supabase. Comprueba login, roles, denegación de ADMIN pese a metadata, logout, recovery, callback PKCE usando verifier creado por el SDK y actualización de contraseña. Workspace real vacío probado a 320px sin overflow ni violaciones axe. No se certifican SMTP/entrega de correos ni Auth remoto.

## SQL suplementario (no sustituye Supabase local)
Las cuatro migraciones, más seed idempotente, se aplicaron desde cero a PostgreSQL WASM PGlite 0.5.8 con esquemas mínimos de prueba auth/storage. Las consultas de supabase/tests/security.test.sql se ejecutaron allí con funciones de aserción de prueba: 67 comprobaciones PASS. Incluyen aislamiento Student/Organization/Storage, writes denegados, cambio de UUID, elegibilidad/activación/identidad y verificación de organizaciones, no autoasignación de roles, manager/non-manager, acceso ADMIN, anon, notificaciones, auditoría sin valores, docs/path/uploader y constraints de score/capacidad/fechas/asignación activa única.

Se contrastaron los tipos fallback con el catálogo de ese PostgreSQL: 284 columnas y 38 FKs públicas coinciden, incluyendo nombres de constraints explícitos. Estas verificaciones no son generación CLI ni ejecución pgTAP contra las schemas reales de Supabase. RLS runtime Supabase permanece SKIPPED.

## Revisión de seguridad y entrega
33 tablas con RLS habilitado inmediatamente al crearlas; 75 policies (incluidas cuatro Storage); seis RPC/helpers públicos y nueve funciones privadas, search_path controlado, EXECUTE revocado de PUBLIC/anon. Ambos buckets tienen public=false. Auditoría técnica de siete recursos críticos, sin snapshots/valores; cliente sin permisos de escritura AuditLogs y sin UPDATE genérico Notifications. Sin credencial privilegiada frontend, lectura de metadata/localStorage para roles, login simulado productivo ni fixtures preview en dist/assets. SDK puede persistir tokens de sesión; esa persistencia no concede roles.

No hay variables reales configuradas: solo .env.example. No se desplegó ni migró un proyecto remoto. Docker/supabase/psql no se encontraron en PATH; Docker Desktop tampoco en Program Files. SUPABASE_SETUP deja comandos para migraciones, lint DB, pgTAP, seed y tipos, primer ADMIN manual y redirects exactos. El contrato permite comenzar P3/P4/P5 en paralelo; desplegar Supabase y completar esas validaciones runtime sigue pendiente.

## Validación P3 · 1 de octubre de 2026

Verificación posterior sobre el resultado P2 existente. Se mantienen los 45 tests unitarios y 14 E2E anteriores; las fixtures HTTP se amplían para las nuevas consultas reales del SDK.

| Comprobación | Resultado real |
| --- | --- |
| npm run typecheck | PASS · exit 0 |
| npm run lint | PASS · exit 0 |
| npm test | PASS · 13 archivos, 75 tests |
| npm run build | PASS · producción + PWA |
| npm run test:e2e | PASS · 27 tests en Edge |
| git diff --check | PASS · exit 0; nuevos archivos P3 comprobados además con --no-index |
| PostgreSQL WASM P2+P3 | PASS suplementario · 5 migraciones, 67 aserciones P2 + 36 P3 = 103 |
| Tipos fallback contra catálogo WASM | PASS · 284 columnas y 38 FKs; tres RPC P3 sincronizadas manualmente |
| Supabase runtime Auth/RLS/Storage | SKIPPED · sin instancia ni variables reales |
| Aplicación P3 remota / DB lint / pgTAP real | SKIPPED · sin Docker/CLI/proyecto conectado |
| Generación oficial de tipos | SKIPPED · fallback manual, no CLI-generated |
| Despliegue remoto | SKIPPED · no configurado |

E2E P3 verifica onboarding Student/Organization, edición de perfiles con whitelist, experiencia actual/fechas/CRUD/confirmación, habilidades sin duplicados y evidencia editable, intereses ordenados, preferencias con eliminación y orden, upload/metadata/signed URL nueva/descarga/eliminación en ambos buckets, compensación ante metadata rechazada, estados de error/reintento, bloqueo de cambios sin guardar, selección entre organizaciones persistida por ruta/reload, reviews read-only y membresía non-manager. Son pruebas del SDK con HTTP aislado; no certifican los servicios alojados.

Responsive/axe WCAG 2.2 AA/teclado en las diez superficies P3 a 1440/768/320 px, sin desbordamiento de página; capturas de Student Profile y Organization Home inspeccionadas visualmente en desktop/móvil. Se conserva la verificación P1/P2 a cinco tamaños, drawer/foco, guards, recovery, multirrol y PWA/offline. Axe y estos recorridos no constituyen certificación de accesibilidad integral.

Seguridad SQL suplementaria: anon/PUBLIC sin EXECUTE registro, STUDENT rechazado, ORGANIZATION autorizado, validación de inputs, estado inicial sin verificación, membresía propia correcta, reintento idempotente y posibilidad multiorganización, autoverificación e INSERT directo denegados, revisiones de solo lectura y aislamiento A/B, documentos cruzados denegados, orden transaccional con UNIQUE inmediata y reversión de requests inválidos. Stubs auth/storage en PGlite; no son las schemas reales de Supabase.

Revisión productiva: sin fixtures en el grafo/bundle, sin getPublicUrl ni credenciales privadas, catálogos reales, RLS como frontera de autorización, buckets privados y ningún cache runtime de Auth/DB/Storage. Los archivos y metadata no comparten transacción: recuperación de fallos parciales implementada; una interrupción abrupta antes de compensar requiere reconciliación administrativa mediante Storage API. No se tocaron las migraciones P2 ni se implementaron Projects/Admin operativo/Matching/Assignments.

Limitaciones: catálogos/periodo y reglas/documentos institucionales reales por definir/cargar; aplicar P3 a Supabase, regenerar tipos oficiales, probar con cuentas reales y desplegar antes de afirmar lanzamiento. El repositorio queda integrado para continuar Projects/Admin y Matching sobre el contrato existente.

## Validación P4 · Projects + Admin · 1 de octubre de 2026

| Comprobación | Resultado observado |
| --- | --- |
| npm run typecheck | PASS · exit 0 |
| npm run lint | PASS · exit 0 |
| npm test | PASS · 20 archivos, 156 tests del árbol compartido, incluidos cambios concurrentes P5 |
| npm run build | PASS · producción + PWA |
| node tests/run-p4-e2e.mjs | PASS · 42 E2E: 27 anteriores + 15 P4 |
| git diff --check + nuevos archivos P4 --no-index --check | PASS · sin errores de whitespace |
| PostgreSQL WASM P2+P3+P4 | PASS suplementario · 67 + 36 + 61 = 164 aserciones |
| Fallback contra catálogo WASM | PASS · 284 columnas, 38 FKs |
| Supabase runtime / DB lint / pgTAP real / generación CLI | PENDIENTE · sin instancia real configurada |

E2E P4 usa SDK y backend HTTP aislado: manager/non-manager, creación y edición de proyecto/plazas/perfil, envío, revisión administrativa, dashboard agregado, participación/elegibilidad con confirmación, organizaciones/verificación, usuarios/ADMIN, catálogos/periodo, JSON/flags/auditoría, filtros/paginación de 51 registros, errores/reintento y catálogos faltantes. Todas las nueve rutas Admin y detalles/dialogs tienen comprobaciones responsive, overflow y axe a 1440/768/320 px; keyboard/Escape/focus/descarte de cambios verificados. Se inspeccionaron visualmente capturas desktop/móvil. Los recorridos Auth/P1/P2/P3 se conservan PASS.

SQL P4 comprueba RLS/manager/no-manager/aislamiento, transiciones y congelación de proyectos/plazas/perfil, RPC revisión/periodo, elegibilidad, último ADMIN e identidad de roles, configuraciones, dashboard y conservación de periodos históricos. Stubs auth/storage/pgTAP sobre PGlite: no certifican runtime Supabase ni concurrencia en servidor real. No se ejecuta matching P5 mediante el runner P4.

Implementación, comandos reproducibles y pendientes: [PROJECTS_ADMIN_P4.md](PROJECTS_ADMIN_P4.md). Queda pendiente aplicar migraciones y probar Auth/RLS/Storage/pgTAP/concurrencia en Supabase real, regenerar tipos oficiales, cargar catálogos institucionales y validar workflows. Matching se integra posteriormente en su ruta reservada; Assignments permanece P6.
