# Auth y RBAC

Supabase Auth es la única identidad. Cliente SupabaseClient<Database>, PKCE, persistSession y autoRefreshToken; detectSessionInUrl=false porque /auth/callback intercambia explícitamente el código una sola vez. El SDK conserva sus tokens; localStorage no constituye prueba de rol. Nunca inferir roles desde metadata, query params o preview.

## Flujo
1. Login usa signInWithPassword con email/password. Sin configuración válida, campos y botón quedan deshabilitados. Mensajes accesibles y genéricos, sin errores internos.
2. AuthProvider lee sesión y suscribe onAuthStateChange. Al cambiar/renovar sesión borra roles anteriores y carga pyr_unibague_current_roles fuera del callback síncrono del SDK para evitar bloqueo. Un contador descarta respuestas obsoletas tras logout/cambio de identidad. Error de RPC => roles vacíos y guard cerrado.
3. Cero roles → /unauthorized. Uno → /app/student|organization|admin. Varios → /select-role. Elegir espacio solo navega; RequireRole consulta roles reales y RLS comprueba cada operación en servidor.
4. Logout real desde AppShell espera signOut, limpia estado mediante el evento del SDK y vuelve a /login. Error visible permite reintentar.

## Recuperación
forgot-password usa resetPasswordForEmail con redirectTo fijo en el mismo origin + /auth/callback. Respuesta de éxito genérica. Callback PKCE exige código válido; ignora next/redirect/from arbitrarios, elimina parámetros de historial y detecta PASSWORD_RECOVERY por el evento SDK, nunca por una bandera de URL. Recuperación → /reset-password; otro callback válido → /select-role (resolver 0/1/multirrol). Código faltante/expirado/error nunca autoriza por una sesión previamente existente.

Reset requiere sesión + evento de recuperación de la sesión actual, mínimo 8 caracteres (config local), confirmación y estados loading/error/success. updateUser cambia contraseña; signOut posterior exige volver a ingresar. La autorización de recuperación no se persiste en almacenamiento editable: recargar la pantalla obliga a solicitar otro enlace. PKCE exige abrir el enlace en el mismo navegador que inició la solicitud. Configurar el proyecto hospedado con mínimo de contraseña 8 y redirects exactos según SUPABASE_SETUP.

## Permisos
UserRoles es la fuente autoritativa multirrol. auth.users trigger solo crea metadata de nombre; ninguna elevación desde metadata. ADMIN asigna/remueve roles; primer ADMIN se provisiona manualmente en SQL Editor. El catálogo trae STUDENT/ORGANIZATION/ADMIN, sin usuario semilla ni contraseña.

Membresía Organization es diferente del rol global. Usuario debe tener ORGANIZATION y una membresía status='active'; can_manage=true otorga gestión. ADMIN controla membresías; P3 permite crear únicamente la membresía propia inicial mediante la RPC de registro de organización autorizada. No crear APIs públicas de elevación ni signup completo. Los flags no protegen datos. RequireRole ofrece UX; RLS/grants/triggers son la frontera de datos.

Previews /dev/* solo import.meta.env.DEV, sin Auth ni permisos ficticios. /app/student y /app/organization muestran módulos productivos P3; Admin conserva estados vacíos hasta P4. PWA cachea solo shell y assets, nunca requests Supabase/Storage; excluye callbacks y reset-password del fallback de navegación.

## Pruebas
Vitest comprueba formularios, servicios SDK, carreras de sesión, recuperación y guards. E2E auth usa servidor local en 5174 con dominio reservado example.test y respuestas HTTP aisladas; recorre llamadas reales del SDK sin contactar un proyecto real. No es una certificación de Auth/SMTP remoto. Previews y producción conservan los tests originales.

## Extensión P4 · Projects + Admin

Las rutas productivas usan RequireRole existente. Projects resuelve únicamente membresías activas persistidas; can_manage controla escritura, complementada por RLS y triggers P4. Admin usa UserProfiles/Roles/UserRoles sin acceder a auth.users desde browser. Asignar/retirar ADMIN exige escribir ADMIN y confirmar; un trigger DB impide retirar el último administrador y otro protege UUID/código de los tres roles del sistema. RPC de revisión/periodo exige auth.uid y ADMIN persistido. No se conceden privilegios mediante flags. Ver [PROJECTS_ADMIN_P4.md](PROJECTS_ADMIN_P4.md).
