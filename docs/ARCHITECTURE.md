# Arquitectura · Core Schema v0

## Stack y alcance

React 19, TypeScript estricto/noUncheckedIndexedAccess, Vite, React Router, CSS nativo con tokens, Lucide y Supabase JS oficial. Oxlint, Vitest/Testing Library/jsdom, Playwright/axe. Supabase es el único backend: PostgreSQL, Auth, Storage, RLS, RPC y Edge Functions; Realtime y pgvector cuando estén justificados. No incorporar otro backend, ORM ni autenticación alternativa.

## Fronteras

| Área | Responsabilidad |
| --- | --- |
| app | Rutas, providers, carga y errores globales |
| layouts | Estructura pública/del espacio, sin reglas de negocio |
| components/ui | Primitivas tipadas, ignoran roles y Supabase |
| components/navigation | Catálogo central de navegación |
| components/feedback | Loading, empty, error, alerts y PWA |
| config | Metadata, roles RBAC y flags |
| features/<feature> | Casos de uso, páginas y repositorios del dominio |
| lib/supabase | Cliente/configuración; cliente Database tipado y fallback de tipos |
| utils | Helpers y preferencias UI, sin permisos |
| styles | Tokens y superficies |
| test, tests/e2e | Pruebas de contratos y experiencia |

Una feature puede crecer con pages/, components/, services/, hooks/ y types/ internos. No crear directorios vacíos. Consultas en servicios de feature; mapeos separan filas y modelos de presentación. No llamar Supabase desde UI compartida ni importar internos de otra feature. Compartir solo contratos con uso real.

Router con carga diferida por superficie, Suspense y errorElement. Layouts aportan landmarks; efectos actualizan título, enfocan contenido y respetan anclas. AppShell utiliza sidebar en desktop y dialog modal nativo en tablet/móvil.

## Datos, Auth y permisos

Configuración ausente/incorrecta produce cliente null. Auth productivo usa PKCE, servicios de feature y sesión del SDK. AuthProvider resuelve UserRoles mediante pyr_unibague_current_roles después de cada evento de sesión, descarta respuestas obsoletas y limpia roles al logout. Error de verificación falla cerrado. 0/1/multirrol navega a unauthorized/workspace/select-role. No inferir permisos de metadata editable, localStorage, query strings ni rol elegido.

PostgreSQL/RLS/grants y triggers validan identidad, propietario y campos institucionales. Helpers SECURITY DEFINER con search_path vacío y permisos mínimos. Guard solo aporta UX. Flags no son seguridad. Nunca service_role en bundles. Core Schema v0 implementa 33 tablas, auditoría sin snapshots y dos buckets privados; ver DATABASE_CONTRACT, AUTH_RBAC y RLS_MATRIX.

Preview se importa dinámicamente detrás de import.meta.env.DEV, sin sesión/roles. Fixtures permanecen en features/preview. /app/student y /app/organization implementan servicios/hooks productivos P3; Admin conserva placeholders hasta P4. Tipos estrictos sincronizados con SQL como fallback, aún no generados por CLI; ejecutar el comando documentado al disponer de Supabase local/remoto.

## Flexibilidad

Metadata, roles y navegación centralizados. Catálogos, periodos, configuraciones, estados y reglas futuras requieren contratos aprobados. Los estados de demo-data no son enums institucionales. No construir CMS/workflow genérico ni reglas de matching. Frontend organiza inputs/estados; backend valida invariantes y permisos.

## Datos sensibles

No se implementan campos médicos ni discapacidad en este esquema. No incluirlos indiscriminadamente en perfiles enviados a organizaciones, búsquedas, logs o fixtures. Definir consentimiento, finalidad, acceso mínimo, retención y RLS específico con la Universidad antes de implementar campos. No asumir diagnósticos/categorías. PWA no cachea respuestas Auth/DB/Storage.

## Errores

Primitivas contemplan loading, empty, error, disabled y success. Servicios futuros devolverán errores tipados; páginas decidirán copy/reintento sin detalles sensibles. errorElement cubre fallos de ruta/chunk. Cancelar lecturas al desmontar, mantener providers estables y verificar recorridos completos.

P3 comparte únicamente componentes de formularios/recurso, traducción de errores y servicios documentales con uso real. Registro de organización y orden de preferencias/intereses se resuelven por RPC; la autorización permanece en PostgreSQL. Ver STUDENT_ORGANIZATION_MODULES.md.

## Integración P4 · Projects + Admin

ProjectsWorkspace y AdminWorkspace son módulos productivos con carga diferida, servicios separados y autorización persistida P2/P3. PagedData/usePaged proporcionan tablas, búsqueda, filtros y paginación reutilizables; una recarga conserva formularios abiertos y sus cambios. DocumentsPanel y el servicio privado P3 se reutilizan. El dashboard y la búsqueda de estudiantes usan RPC de agregación/paginación; relaciones de listas se consultan por lotes. Contrato e integración: [PROJECTS_ADMIN_P4.md](PROJECTS_ADMIN_P4.md).
