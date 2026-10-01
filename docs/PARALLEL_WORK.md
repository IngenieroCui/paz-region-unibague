# Trabajo paralelo

Preparado para tres agentes Sol 6.1 High en fases posteriores.

| Equipo | Ownership |
| --- | --- |
| 1 | features/students, features/organizations |
| 2 | features/projects, features/admin |
| 3 | features/matching y futuras RPC/Edge Functions del motor |

Asignar dueño explícito a assignments y process. Auth, esquema y RLS están implementados en Core Schema v0; un responsable común coordina cualquier modificación imprescindible. P3/P4/P5 parten de DATABASE_CONTRACT, AUTH_RBAC y RLS_MATRIX sin rediseñar identidad ni tablas.

## Archivos sensibles

Coordinar antes de modificar router/providers, config/app/navigation, layouts, componentes compartidos, tokens, lib/supabase, package.json/lockfile, tooling o migraciones. Un responsable integra interfaces compartidas. No duplicar clientes, routers, shells ni tokens.

Buscar con rg antes de crear componentes/helpers. Ampliar primitivas cuando haya usos reales. Evitar ciclos, barrels indiscriminados e imports internos entre features. Fixtures no son fuente productiva.

## Migraciones

- No rediseñar tablas unilateralmente ni persistir estados de ejemplos UI.
- Core Schema v0 es el contrato base obligatorio para P3/P4/P5. Añadir migraciones solo si son imprescindibles; no renombrar ni rediseñar tablas unilateralmente.
- Prefijo literal PYRUnibague_ y quoted identifiers obligatorios.
- Cambio coherente por migración, timestamp único coordinado, orden de dependencias.
- No editar migraciones aplicadas.
- Revisar constraints, RLS, RPC y rollback antes de integrar.
- Tipos generados por responsable único desde esquema aprobado.
- Tests de RLS: denegación y aislamiento entre usuarios/organizaciones.
- No introducir otro backend.

## Integrar una feature

1. Delimitar ownership, casos de uso, contratos y pendientes.
2. Implementar páginas/servicios/hooks/tipos dentro de la feature.
3. Loading/error/empty/no permission; invariantes en servidor.
4. Responsable registra ruta y navegación.
5. Tests de comportamiento/denegación relevantes.
6. Typecheck, lint, tests, build, diff --check y recorrido responsive.
7. Revisar diff y documentación; integrar sin pisar cambios ajenos.

Usar branches/worktrees aislados y base acordada. No reformatear globalmente, cambiar lockfiles simultáneamente ni revertir trabajo ajeno sin revisar.

## Integración P4 · Projects + Admin

P4 registra router/navigation centrales y conserva las superficies P3. `/app/admin/matching` permanece con «Motor de matching pendiente de integración P5»; no importa features/matching ni toca sus funciones. El integrador reemplazará el placeholder por el workspace P5 y conservará las firmas RPC P4 al combinar el fallback. Assignments continúa pendiente P6. Migración P4 exclusiva: 202610010006_projects_admin_p4.sql. Los runners E2E P4 usan puertos 5383/4383/5384 para evitar interferir con P5. Handoff: [PROJECTS_ADMIN_P4.md](PROJECTS_ADMIN_P4.md).
