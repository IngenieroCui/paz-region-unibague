# P11 — Doble acceso y organizaciones

Actualizado el 20 de octubre de 2026 · America/Bogota.

## Estado de entrega

El doble acceso está implementado y verificado con las nueve cuentas TEST del proyecto **`unxiuzkhxlzneywtnuvf`**. Se verificaron en Supabase real Auth, perfiles, roles persistidos, asesores, creación de organizaciones, contactos, documentos privados, aislamiento y revisión ADMIN. El recorrido en navegador incluye corrección y aprobación con datos reales TEST.

**El registro público y Google permanecen desactivados en la aplicación. El envío formal P11 todavía requiere una migración remota.** No se declara completada la activación hospedada de P11.

## Entorno administrativo y seguridad de claves

- `.env.local`: URL y clave pública del proyecto actual.
- `.env`: `VITE_SUPABASE_SECRET_KEY`, leída únicamente por Node en `scripts/supabase-admin.mjs`. No se importa ese módulo desde React.
- `adminClient()` usa `@supabase/supabase-js`, con persistencia, renovación y detección de sesión desactivadas. No necesita un Personal Access Token para Auth Admin o Data API.
- `p10-context.mjs` reutiliza este cliente y el registro nuevo. La función separada `management()` solo se utiliza para operaciones de Management/SQL: una Secret API Key no sustituye las credenciales de esa API.
- Vite tiene una lista explícita de variables públicas. El nombre administrativo heredado con prefijo `VITE_` queda excluido tanto en desarrollo como en build. `verificar-p11-frontend.mjs` comprobó la configuración resuelta y 108 archivos de build sin encontrar la clave.
- Los clientes de Node rechazan cualquier URL distinta del proyecto autorizado antes de hacer peticiones. El frontend rechaza otros proyectos hospedados `*.supabase.co`; conserva dominios ficticios `.test` y localhost para pruebas aisladas.
- No quedan referencias ejecutables al proyecto anterior en código/configuración/scripts. Los registros históricos locales y documentos P8–P10 son evidencia histórica, no destinos de conexión.
- `.env`, `.env.local`, `work/` y `*.local.json` siguen ignorados. El escaneo de Git compara también las claves y contraseñas locales reales sin imprimir coincidencias.

Referencias oficiales: [Auth Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [API keys](https://supabase.com/docs/guides/getting-started/api-keys). Se revisó el changelog vigente; el cambio anunciado de TLS para noviembre no afecta a los clientes modernos usados en estas pruebas.

## Nueve cuentas TEST

Se contrastaron los correos y roles con el registro P9 histórico del repositorio principal. Ninguna de las nueve direcciones existía en el proyecto nuevo. Se crearon nueve identidades con contraseñas nuevas e independientes mediante `auth.admin.createUser()`, sin invitaciones ni correo.

| Rol persistido | Cantidad | Resultado real |
| --- | ---: | --- |
| STUDENT | 4 | Login, UserProfile y UserRoles verificados |
| ADVISOR | 2 | Login, UserProfile, UserRoles y StaffProfile activo verificados |
| ORGANIZATION | 2 | Login, UserProfile y UserRoles verificados |
| ADMIN | 1 | Login, UserProfile y UserRoles verificados |

Credenciales exclusivamente locales: **`work/p11/cuentas-test.local.json`**, ignorado por Git. El archivo se entrega en esa ruta dentro del repositorio principal solicitado. El registro P9 anterior no se sobrescribe ni se reutilizan sus UUID/contraseñas. No se publican credenciales en documentación, capturas, informes o consola.

El script acota el inventario al prefijo autorizado, comprueba colisiones y exige coincidencia entre email/UUID/rol del registro privado antes de modificar una cuenta existente. Repara de forma reintentable perfiles/roles/StaffProfiles que falten. El informe es [accounts.json](p11/accounts.json).

El listado general `auth.admin.listUsers()` devolvió HTTP 500, `Database error finding users`, al incluir un registro preexistente ajeno. La consulta filtrada por `pyrprueba.` funciona. No se modificó ese registro, no se ejecutó SQL sobre `auth.users` y no se atribuye el fallo a una causa no comprobada. El administrador del proyecto puede diagnosticarlo con los logs de Auth/PostgreSQL. La API admite el [filtro del inventario](https://github.com/supabase/auth/blob/master/internal/api/admin.go).

## Doble acceso y callback

| Ruta | Comportamiento |
| --- | --- |
| `/login` | Selección del tipo de acceso |
| `/login/institucional` | Email/contraseña para cuentas autorizadas; Google pendiente y deshabilitado |
| `/login/organizaciones` | Email/contraseña, incluidos correos externos |
| `/registro/organizacion` | Solicitud del responsable preparada; registro público cerrado |
| `/auth/callback` | Callback PKCE común para confirmación/OAuth/recuperación |
| `/forgot-password`, `/reset-password`, `/select-role` | Compatibilidad y selección multirrol conservadas |

Se mantiene un único cliente frontend, AuthProvider y sistema de usuarios. La autorización procede de `UserRoles`, nunca de metadata editable ni del dominio. Las rutas de login no añaden roles. Sin rol persistido se rechaza el acceso a los espacios protegidos.

El callback retira el código del historial, evita consumirlo dos veces bajo StrictMode, rechaza errores/códigos ausentes y no usa parámetros de redirección arbitraria. El flujo institucional exige identidad Google verificada y dominio autorizado; las direcciones TEST no pueden acreditarse mediante Google. No se redirige a una página externa de Unibagué.

## Organizaciones y revisión

Se reutilizan `PYRUnibague_Organizations`, `OrganizationMembers`, `OrganizationContacts`, `OrganizationDocuments`, `OrganizationReviews`, proyectos y las RPC P3/P4/P6 existentes.

Validación real ejecutada:

1. Creación de dos solicitudes TEST pendientes y membresías propietarias mediante la RPC de registro. Repetir la misma solicitud no crea otra organización.
2. Perfil, municipio y tipo TEST; contacto principal guardado por la RPC existente. Los catálogos estaban vacíos: se añadieron exclusivamente un tipo y un municipio claramente ficticios `TEST-P11`, sin sustituir datos institucionales.
3. Documentos PDF TEST subidos a los buckets privados. Propietario y ADMIN pueden obtener acceso temporal; la otra organización y el acceso público reciben denegación.
4. Aislamiento de organizaciones, contactos, documentos y revisiones. Escrituras cruzadas y autoaprobación por ORGANIZATION rechazadas.
5. ADMIN independiente solicita correcciones, aprueba y rechaza; la organización consulta estado e historial. El segundo expediente queda aprobado tras el recorrido de navegador; el primero conserva las decisiones de prueba, terminando rechazado.
6. Desde navegador móvil se guardaron perfil/contacto/documento; ADMIN publicó cambios y aprobación y la organización consultó ambos resultados.

No se inventaron documentos obligatorios. `organization_document_requirements` conserva el mecanismo de indicaciones autorizadas en SystemConfigurations; sin configuración no se presentan requisitos institucionales supuestos. No se enviaron proyectos a matching ni se cambiaron asignaciones reales.

La migración original P11 (`20261016154045`) prepara gate privado, hook, onboarding externo, envío `submitted`, auditoría de envíos, protección de duplicados y publicación condicionada a organización verificada. **No está aplicada en el servidor**: sus tres RPC están ausentes. La UI deshabilita el envío y lo explica. Se probaron las revisiones existentes P4; no se simuló ni se anunció un envío P11 hospedado.

Se añadió `20261020122421_p11_review_safety.sql`: impide que un ADMIN cree revisiones o cambie la verificación de una organización propia o con membresía. Incluye pruebas de denegación y rollback del historial. Esta protección adicional de conflicto de interés está validada en SQL aislado y **pendiente de aplicar en remoto**. Las pruebas reales usaron un ADMIN sin membresías; no certifican aún este caso multirrol en remoto.

## Esquema real y bloqueo de migración

El catálogo REST administrativo del proyecto actual expone **45 tablas PYR, 381 columnas y 29 RPC PYR**. Faltan:

- `pyr_unibague_external_registration_ready`
- `pyr_unibague_start_external_onboarding`
- `pyr_unibague_submit_organization`

Evidencia: [hosted-schema.json](p11/hosted-schema.json). No se consultaron datos de otras aplicaciones del proyecto.

El conector SQL respondió **`You do not have permission to perform this action`** para el proyecto actual. No se proporcionó una conexión PostgreSQL autorizada. La Secret API Key funciona para Auth Admin/Data/Storage, pero no ofrece un endpoint general para ejecutar DDL ni configurar el Dashboard. No se intentó eludir permisos con RPC de otras aplicaciones ni se exigió un PAT para crear cuentas.

Para cerrar el bloqueo basta disponer de un canal SQL autorizado al proyecto actual: acceso al SQL Editor del Dashboard, una conexión PostgreSQL válida o autorización del conector. Tras revisar el historial remoto, aplicar solo las migraciones pendientes P11, sin RESET ni reaplicar a ciegas P1–P10. Verificar pgTAP y Advisors y regenerar tipos oficiales. No se redujo RLS y no se aplicó ninguna política nueva en el proyecto hospedado.

## Registro público y Google: requisitos pendientes

La lectura real de Auth devuelve `google=false`, `disable_signup=false` y **`mailer_autoconfirm=true`**. Por tanto, el registro de la aplicación permanece cerrado. **El cierre de la UI no deshabilita el endpoint remoto de signup preexistente**; TI debe configurar Auth antes de un lanzamiento público. No se cambiaron esas políticas con una clave que no tiene permisos de gestión.

Antes de habilitar registro público:

1. SMTP autorizado y entrega/confirmación/recuperación probadas con buzones controlados; `mailer_autoconfirm=false` y contraseña mínima 12.
2. CAPTCHA real, rate limits y Before User Created Hook instalados y comprobados con el gate cerrado.
3. Textos aprobados de condiciones/privacidad y configuración documental autorizada.
4. Migraciones P11 aplicadas y pruebas hospedadas de aislamiento, envío, correcciones, concurrencia y conflicto de interés.
5. Activar el gate privado y `activated_at` únicamente después de verificar todo lo anterior; habilitar los flags públicos y reconstruir.

Google Workspace sigue preparado, no activo. TI debe autorizar proyecto Google Cloud, OAuth Client ID/Secret, consentimiento, dominios e identidades existentes. Dominios preparados: `unibague.edu.co` y `estudiantesunibague.edu.co`, pendientes de validación institucional; nunca conceden privilegios.

Callback del proveedor: `https://unxiuzkhxlzneywtnuvf.supabase.co/auth/v1/callback`. Confirmar la URL HTTPS definitiva del frontend y sus callbacks exactos `/auth/callback?flow=institutional`, `/auth/callback?flow=organization` y recuperación `/auth/callback`. No se inventaron credenciales, no se configuró SAML/SSO externo y no se habilitó Google por un simple flag.

Referencias: [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [Auth hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha).

## Pruebas ejecutadas el 20 de octubre

| Comprobación | Resultado |
| --- | --- |
| Typecheck, lint y build | PASS |
| Vitest | 303 PASS, 35 archivos |
| E2E aislados base/P4/P5/P6A/P6B/P6C/P7/P11 | 30/15/2/11/7/5/15/8 PASS: 93 distintos |
| PostgreSQL WASM P2–P7/P11 | 474/58 PASS: 532 aserciones |
| Catálogo local integrado | 45 tablas, 381 columnas, 60 FK, 32 RPC; RLS habilitado |
| Auth Admin y login real de las nueve cuentas | 9/9 PASS |
| Auth/Data/Storage reales | 19 PASS; 3 grupos SKIPPED explícitos |
| Navegación real | 9 cuentas, 43 rutas públicas/por rol, responsive 320/390/768/1440, axe, guards, persistencia y logout PASS |
| Recorrido de perfil/contacto/documento/revisión en UI real | 4 PASS; envío formal P11 SKIPPED |
| Exposición de clave en Vite/desarrollo/build | PASS; 108 archivos de build inspeccionados, 0 hallazgos |
| SQL/migraciones/pgTAP/Advisors hospedados | SKIPPED por permisos SQL |
| SMTP, recuperación por buzón, CAPTCHA y Google reales | SKIPPED: prerrequisitos no configurados; no se envían correos ficticios |

Las pruebas WASM usan PostgreSQL aislado y stubs de Auth/Storage; no son pgTAP hospedado ni certificación de concurrencia entre conexiones. Los 93 E2E aislados usan fixtures HTTP. Se distinguen de las pruebas del SDK y navegador conectadas al Supabase real.

Se comprobaron metadata sin privilegios, usuario TEST temporalmente sin rol (restaurado en `finally`), denegación de roles administrativos a STUDENT/ADVISOR y revocación de refresh token tras logout. Expiración/callback/recuperación se cubren con pruebas aisladas; no se declara recuperación por correo real. La huella de los perfiles ajenos a los nueve TEST permaneció igual durante la validación.

Evidencias: [real-validation.json](p11/real-validation.json), [real-browser-journey.json](p11/real-browser-journey.json), [real-browser-validation.json](p11/real-browser-validation.json), [validation.json](p11/validation.json), [environment.json](p11/environment.json). Capturas y registro detallado de navegación real se conservan localmente en `work/p11/browser/` sin sesiones ni contraseñas.

## Reproducción y Git

```text
node scripts/crear-cuentas-piloto.mjs                     # inventario, sin mutaciones
node scripts/crear-cuentas-piloto.mjs --apply             # solo TEST reconocidos, sin PAT
node scripts/verificar-p11-real.mjs                      # modifica solo fixtures TEST
node scripts/verificar-p11-browser.mjs                   # nueve logins/navegación reales
node scripts/verificar-p11-browser.mjs --journey          # perfil/documento/revisión TEST reales
node scripts/verificar-p11-entorno.mjs
node scripts/verificar-p11-frontend.mjs                   # después de build
node scripts/verificar-secretos-p11.mjs                   # index e historial nuevo
```

Se reutilizó la rama limpia `feat/p11-dual-auth-organizations`, inicialmente igual a `dev` y `origin/dev` (`3b8de43`). La integración solicitada conserva P1–P11 y se realiza sobre `dev` mediante avance normal, seguida de push sin force y comprobación del SHA en `origin/dev`. `main` no se modifica. El push puede reconstruir el frontend; no aplica migraciones ni activa flags de registro/Google. El SHA final se entrega con la comprobación remota.
