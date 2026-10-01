# Student y Organization · P3

Se implementa P3 sobre el esquema, Auth, RBAC, tokens y componentes P2. Los módulos productivos consultan Supabase; no importan fixtures. Admin y previews originales conservan sus superficies. No se implementan Projects, Matching, Assignments ni datos sensibles.

## Superficies y servicios

Student: `/app/student` (identidad, programa, semestre, completitud, participación actual y elegibilidad administrativa), `/profile`, `/experience`, `/skills` (habilidades e intereses), `/preferences` y `/documents`. Un estudiante sin fila Students crea su perfil desde Mi perfil. El nombre se escribe en UserProfiles y el resto en Students, con whitelist de campos editables. Esas dos operaciones no son atómicas: un fallo del nombre después de guardar el perfil se reporta como parcial y permite recargar/reintentar.

Organization: `/app/organization`, `/profile`, `/documents` y `/reviews`. Sin membresía activa se presenta onboarding. Con membresías existentes se dirige al espacio existente, priorizando una con gestión. Varias organizaciones pueden seleccionarse; el identificador se conserva en el query param `organization` al navegar y recargar. Este parámetro solo selecciona entre membresías persistidas; no concede permisos. Los miembros sin can_manage consultan perfil/revisiones y no editan ni acceden a documentos privados.

Consultas y escrituras tipadas viven en `features/students/services`, `features/organizations/services` y `features/documents/services`. Los hooks de feature usan un recurso con descarte de respuestas obsoletas y reintento. Lecturas independientes se ejecutan en paralelo; los municipios se paginan para superar el límite de respuestas de Supabase. Los catálogos provienen de la BD; los catálogos vacíos requieren configuración de coordinación. Errores se traducen sin revelar diagnósticos internos. Cada update sensible aplica una whitelist explícita incluso si el objeto recibido incluye campos extra.

## RPC y seguridad

`202610010005_student_organization_p3.sql` añade:

- `pyr_unibague_register_organization(p_legal_name, p_display_name?, p_tax_id?, p_description?, p_website?, p_organization_type_id?, p_municipality_id?) → uuid`. SECURITY DEFINER, search_path vacío, auth.uid obligatorio, rol ORGANIZATION persistido, inputs acotados y catálogos activos validados. Crea organización y membresía atómicamente; pending_review, sin verificación, can_manage/is_primary_contact=true, status técnico de membresía active. EXECUTE solo authenticated. Serializa solicitudes por actor y devuelve una organización ya gestionada con el mismo nombre normalizado o tax_id. No introduce una restricción global de una organización por usuario; distintas entidades pueden coexistir.
- `pyr_unibague_set_student_preferences(p_student_id, p_municipality_ids[]) → void`. SECURITY INVOKER, propietario real y RLS, bloqueo por estudiante, elimina/agrega/ordena atómicamente. Máximo técnico de 100 preferencias; municipios sin duplicados, ordinales contiguos desde 1. Rango temporal positivo evita violar la restricción UNIQUE de P2 al intercambiar posiciones. Una preferencia previa en un municipio desactivado puede conservarse o eliminarse.
- `pyr_unibague_order_student_interests(p_student_id, p_ids[]) → void`. SECURITY INVOKER y propietario real; valida que el conjunto completo de IDs pertenece al estudiante y ordena en una transacción. No eleva elegibilidad.
- Policy SELECT de OrganizationReviews para miembros autorizados de la organización. No se conceden writes a Organization. No se abre INSERT directo de Organizations ni modificación de membresías.
- Límite técnico Storage 10 MiB y tipos PDF/Word/PNG/JPEG en ambos buckets. Ambos permanecen privados. No son requisitos institucionales.

No se modifican las cuatro migraciones P2. Tipos `database.types.ts` sincronizados manualmente con las tres RPC nuevas: fallback estricto, **no CLI-generated**. Regenerar oficialmente en Supabase según SUPABASE_SETUP.

## Storage

Bucket estudiante `pyrunibague-student-documents`; organización `pyrunibague-organization-documents`. Path `<owner_uuid>/<document_uuid>/<filename>`, sin subcarpetas en el filename. Se valida tamaño, extensión, MIME y nombre; se reserva UUID, sube sin overwrite y guarda metadata con el mismo UUID/path/uploader. Se normaliza el nombre para URLs seguras. Se muestra progreso por fases y loading; no se inventa un porcentaje de bytes que el SDK no proporciona.

Student ofrece explícitamente `CV / Hoja de vida` (category_code=CV) y otro documento opcional. Organization acepta categoría libre de hasta 80 caracteres. No se inventan otros documentos obligatorios. Las URLs se firman al solicitar cada acceso por 60 segundos, sin persistencia ni cache; descarga se solicita mediante la opción download del SDK. No hay URLs públicas ni binarios PostgreSQL.

Un insert de metadata rechazado consulta primero si se confirmó en la BD; así una respuesta HTTP ambigua no provoca borrar un archivo registrado. Si no existe, compensa retirando el objeto. Si falla la comprobación/limpieza, conserva un handle en memoria y ofrece “Limpiar archivo pendiente”; la limpieza vuelve a comprobar metadata antes de borrar. La navegación se protege mientras hay archivo pendiente. Para eliminar se retira primero el binario y luego metadata: si Storage falla, conserva el registro; si metadata falla, explica que el binario ya fue retirado y permite reintentar la eliminación. Las eliminaciones requieren confirmación modal.

El cierre abrupto del navegador/interrupción del proceso no puede hacer atómica la coordinación de dos servicios. Un administrador debe reconciliar objetos huérfanos mediante la API Storage si la sesión se pierde antes de compensar; no borrar objetos Storage por SQL. No se crea un servicio de limpieza automática ajeno al alcance.

## Completitud y decisiones provisionales

Completitud centralizada en servicios puros y testeados. Student pondera por igual identidad/programa, presentación, municipios, habilidades/intereses, preferencias y CV. Experiencia/enlaces son opcionales. Organization usa nombre legal, tipo, descripción y municipio. Son indicadores UX de preparación; no deciden requisitos institucionales ni escriben participación/elegibilidad, aprobación, verificación o matching.

Labels de revisión centralizados: pendiente, cambios solicitados, aprobado y rechazado; estados desconocidos se muestran sin reinterpretarlos. Son labels provisionales sobre text, no enums PostgreSQL. Fechas de experiencias coherentes, experiencia actual sin fecha final, habilidades y municipios sin duplicados, enlaces opcionales solo HTTP/HTTPS sin credenciales. Diálogos nativos con Escape, foco y retorno al disparador; formularios guardan con loading/error/success y bloquean navegación/reload ante cambios pendientes. No se crean skills globales desde Student.

## Verificación y puesta en marcha

Tests unitarios cubren carga/creación/edición, completitud separada de elegibilidad, experiencia CRUD/fechas, duplicados, intereses y preferencias, RPC y whitelist de organización, firma nueva, uploads y fallos parciales. E2E en Edge recorre el SDK contra HTTP aislado: onboarding, CRUD, documentos, selección entre organizaciones, lectura de revisiones, cambios sin guardar, responsive/axe/teclado y reintento. Esas fixtures viven solo en tests.

`supabase/tests/p3.test.sql` prepara pruebas pgTAP para anon/STUDENT/ORGANIZATION, registro/idempotencia/membresía, falta de autoverificación, aislamiento A/B, revisiones de solo lectura y orden transaccional. PostgreSQL WASM suplementario aplica P2+P3 desde cero con stubs auth/storage. No sustituye Supabase runtime, Auth/Storage HTTP reales, DB lint, generación CLI ni despliegue.

Pendiente oficial: catálogos, periodos, estados/transiciones y documentos exigidos por Unibagué; instancia/credenciales públicas configuradas, migración P3, regeneración oficial, pruebas de cuentas/RLS/Storage reales y despliegue. Sin ellos se puede verificar el código integrado, pero no afirmar lanzamiento productivo.

Referencia SDK utilizada: [firmar URLs privadas](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl), [Storage y RLS](https://supabase.com/docs/guides/storage/security/access-control).

## Integración P4 · Projects + Admin

Organization añade Projects con la misma membresía seleccionada por ruta. Admin consulta y corrige perfiles mediante whitelist, reutiliza documentos privados P3, revisa organizaciones transaccionalmente y gestiona participación/elegibilidad por periodo con confirmación. Student no controla elegibilidad. Los módulos P3 y sus servicios permanecen separados; la navegación productiva añade P4 sin sustituir previews. Los 27 recorridos E2E previos siguen pasando en la suite conjunta de 42. Ver [PROJECTS_ADMIN_P4.md](PROJECTS_ADMIN_P4.md).
