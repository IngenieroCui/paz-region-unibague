# Puesta en marcha Supabase

## Proyecto hospedado
Crear proyecto Supabase y guardar credenciales administrativas fuera del frontend. Auth es email/password; deshabilitar nuevas altas públicas mientras se define onboarding/SSO. Configurar mínimo de contraseña 8. Elegir Site URL HTTPS del despliegue y añadir redirect exacto `https://<host>/auth/callback`; para desarrollo añadir `http://localhost:5173/auth/callback`. Sin wildcards productivos. SMTP/correos de recuperación del proyecto deben configurarse y probarse con una cuenta real antes de lanzamiento.

Copiar .env.example a .env.local y definir VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (anon/publishable pública). No service_role, secret key, password de BD ni tokens administrativos en variables VITE_*. No se incluyen credenciales reales en el repositorio.

## CLI y migraciones
Instalar CLI oficial Supabase y Docker Desktop operativo para local. Desde raíz:
~~~sh
supabase start
supabase db reset
supabase db lint --local --level warning
supabase test db
supabase gen types typescript --local --schema public > src/lib/supabase/database.types.ts
~~~
db reset aplica las cinco migraciones (P2+P3) en orden y seed.sql (roles idempotentes). No editar migraciones aplicadas. Puerto API local 54321, BD 54322, Studio 54323, bandeja de correos 54324. Usar URL/clave pública mostradas por supabase status para .env.local. Requisitos: Docker disponible, puertos libres y descarga de imágenes. Si db lint señala policies/plpgsql inválidos, corregir antes de aplicar remotamente mediante nueva migración si la anterior ya fue aplicada.

Para proyecto hospedado, con acceso CLI autorizado:
~~~sh
supabase login
supabase link --project-ref <project-ref>
supabase db push
supabase gen types typescript --linked --schema public > src/lib/supabase/database.types.ts
~~~
La migración reference instala los roles también en hospedado; seed.sql solo repite esos datos seguros. Antes de db push validar en local y revisar migraciones pendientes. Usar PowerShell 7+ para redirección UTF-8 o `supabase gen types typescript --linked --schema public | Set-Content -Encoding utf8 src/lib/supabase/database.types.ts`. Ejecutar typecheck tras generar.

## Primer ADMIN (sin backdoor)
Crear un usuario desde Dashboard → Authentication → Users → Add user (no signup público), con correo real y contraseña elegida por el responsable. Copiar su UUID. En SQL Editor con privilegios de administración:
~~~sql
insert into public."PYRUnibague_UserRoles" (user_id, role_id, assigned_by)
select '<UUID-del-usuario>'::uuid, id, null
from public."PYRUnibague_Roles" where code = 'ADMIN'
on conflict (user_id, role_id) do nothing;
~~~
No existe contraseña default, usuario semilla ni RPC pública de elevación. El trigger crea UserProfiles al alta; usuarios previos son backfilled por migración. Primer actor SQL queda null en auditoría. Después, ADMIN autenticado puede gestionar UserRoles mediante políticas autorizadas; no implementar aún la UI administrativa completa.

## Storage
Migraciones crean dos buckets privados, con policies por propietario/manager/ADMIN. Verificar en Dashboard que public=false para ambos. Nombres exactos y paths en DATABASE_CONTRACT. Servicios firmarán URLs de 60 segundos después de comprobar RLS; no usar getPublicUrl ni cachear objetos privados. El módulo documental debe coordinar upload, metadata y limpieza de objetos huérfanos usando API Storage, sin borrar archivos directamente mediante SQL.

## Producción
Ejecutar typecheck/lint/unit/build/E2E; migrar y generar tipos contra esquema aprobado. Aplicar redirects HTTPS exactos y signup deshabilitado, probar login/recovery/logout con cuentas reales y probar RLS antes de habilitar módulos. Hosting SPA resuelve rutas a index.html, excluyendo assets/API; SW excluye auth/callback y reset-password de navegación offline. No hay despliegue ni proyecto remoto configurado en esta entrega.

## Evidencia y límites de este entorno
Docker, supabase y psql no aparecen instalados en PATH ni Docker Desktop en Program Files. No se pudo iniciar Supabase local ni aplicar migraciones a una instancia Supabase, ejecutar lint DB/pruebas RLS allí o generar tipos oficialmente. database.types.ts es fallback estricto sincronizado con las 33 tablas/RPC del esquema, sin any. No se afirma que sea CLI-generated. Las pruebas SQL están preparadas, no certificadas contra Supabase runtime. La validación suplementaria PostgreSQL WASM usa stubs de auth/storage y no sustituye esas comprobaciones.

Documentación oficial usada: [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [eventos Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage policies](https://supabase.com/docs/guides/storage/security/access-control).

## Activación P3

Aplicar 202610010005_student_organization_p3.sql después de P2, ejecutar supabase test db (incluye p3.test.sql) y regenerar tipos oficialmente. Configurar VITE_SUPABASE_URL y clave pública, cargar catálogos/periodo reales y provisionar usuarios/roles con el proceso administrativo P2. Comprobar registro como Organization, lectura read-only de reviews, separación A/B y carga/firma/descarga/eliminación en ambos buckets privados. La RPC no acepta ni establece verificación. No se ha aplicado a un proyecto remoto en esta entrega.
