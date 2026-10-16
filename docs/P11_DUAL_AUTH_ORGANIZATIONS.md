# P11 — Acceso universitario y de organizaciones

16 de octubre de 2026 · America/Bogota · modelo maestro v0.4.

**Entrega de código preparado, con registro público y Google desactivados.** Durante P11 el usuario confirmó que no dispone de acceso administrativo ni SMTP y pidió no crear cuentas hasta recibir la información de la Universidad. No se crearon cuentas hospedadas, no se enviaron correos, no se aplicaron migraciones remotas y no se desplegó producción.

## Proyecto y alcance comprobado

La copia de implementación nació de `origin/dev` (`ca2ac43`), conservando los commits P9/P10 y los cinco commits posteriores que faltaban en `dev` local. Rama: `feat/p11-dual-auth-organizations`.

La URL de `.env` y `.env.local` del repositorio principal corresponde a **`https://unxiuzkhxlzneywtnuvf.supabase.co`**. El preflight del worktree usa la configuración pública copiada, rechaza cualquier otro proyecto antes de hacer una petición y no imprime claves. `node scripts/verificar-p11-entorno.mjs` reproduce la lectura. Evidencia: [p11/environment.json](p11/environment.json).

El endpoint público de Auth respondió HTTP 200: Google **false**, email **true**, `disable_signup=false`, `mailer_autoconfirm=true`. Por eso la interfaz bloquea el registro aunque se cambie solamente su flag. **El cierre de la interfaz no cierra el endpoint remoto de signup.** La configuración remota existente debe revisarse con TI antes de abrir el servicio a participantes reales.

El conector administrativo rechazó acceso al proyecto actual. La conexión administrativa local histórica también devolvió HTTP 403 consultando exclusivamente el proyecto actual. Nunca se consultó ni modificó el proyecto anterior. No es posible certificar aquí el esquema, roles, identidades, SMTP, redirects, migraciones ni RLS hospedados actuales. Los resultados P8–P10 sobre el proyecto anterior son históricos y no se trasladan a este proyecto.

## Qué funciona en el código

| Ruta | Experiencia |
| --- | --- |
| `/login` | Selección de comunidad universitaria u organizaciones |
| `/login/institucional` | Cuentas autorizadas por correo/contraseña; Google identificado como pendiente |
| `/login/organizaciones` | Correo externo, contraseña, recuperación y acceso al registro |
| `/registro/organizacion` | Etapas explicadas; formulario bloqueado mientras no se autorice registro |
| `/forgot-password` | Ruta histórica de recuperación conservada |
| `/auth/callback` | PKCE de OAuth, confirmación externa y recuperación; sin redirects arbitrarios |
| `/reset-password`, `/select-role` | Recuperación y selección multirrol conservadas |

Se reutilizan el cliente Supabase, AuthProvider, UserRoles y las membresías. Una ruta de ingreso nunca concede permisos. Sin roles, se muestra «Tu acceso a Paz y Región todavía no ha sido habilitado». El usuario externo sin roles puede retomar su solicitud desde esa pantalla cuando la Universidad habilite el flujo.

Azul `#003D7C`, amarillo `#FFCC00`, logo existente, Roboto local, foco por teclado y diseño adaptable. [Capturas](p11/screens/) obtenidas con fixtures HTTP aislados; no representan cuentas ni aprobación institucional reales.

## Organizaciones y revisión

Con una cuenta ORGANIZATION ya autorizada se conserva el registro P3: identidad, tipo, municipio, descripción, identificación tributaria y sitio web. La RPC existente crea únicamente la organización pendiente y su membresía propietaria. Contactos mediante `OrganizationContacts` y su RPC P6; documentos mediante `OrganizationDocuments`, los buckets privados y las restricciones existentes de 10 MB/PDF/Word/PNG/JPEG.

La documentación no se inventa. Sin lista aprobada se permiten categorías libres con evaluación pendiente. Coordinación puede publicar indicaciones como un array JSON de textos en `SystemConfigurations`, clave `organization_document_requirements`, `is_public=true`, usando el ADMIN existente.

La migración P11 agrega `pyr_unibague_submit_organization`: exige responsable con gestión, tipo, municipio, descripción y contacto principal; pasa `pending_review` o `changes_required` a `submitted`. También admite el valor histórico `changes_requested`. Reintentar `submitted` es idempotente. La fecha de cada envío se registra en AuditLogs sin fabricar decisiones administrativas. No se borra historial. `approved` y `rejected` no pueden reiniciarse por el solicitante.

**Mientras P11 no esté aplicado en el servidor, el botón de envío se muestra deshabilitado y explica el pendiente.** El guardado P3 y la revisión P4 de cuentas existentes conservan sus contratos.

ADMIN reutiliza `pyr_unibague_review_organization` para aprobar, rechazar o solicitar cambios. El expediente muestra registro, último envío, responsable, contactos reales, documentos privados, verificación, observaciones y revisiones con fecha/revisor. La aprobación conserva el control exclusivo de ADMIN.

Una organización pendiente puede preparar sus borradores y corregir perfil, contactos y documentos. P5/P6 siguen excluyéndola de matching y asignaciones mientras no esté aprobada y verificada. P11 añade una protección PostgreSQL para impedir publicar una convocatoria antes de esa validación, y deshabilita el botón correspondiente. No se cambiaron el algoritmo, cupos, RPC administrativas de asignación ni las asignaciones existentes.

## Registro externo preparado, cerrado

El flujo implementado, probado exclusivamente con fixtures, es:

1. Responsable: nombre, apellidos, correo externo, contraseña/confirmación, aceptación de textos autorizados y CAPTCHA.
2. Supabase `signUp` solicita confirmación de correo, sin incluir roles en metadata. Mensaje común para solicitudes nuevas y cuentas existentes.
3. Callback PKCE en el mismo navegador. La confirmación de correo no aprueba una organización.
4. `pyr_unibague_start_external_onboarding` verifica la identidad en `auth.users`/`auth.identities` y otorga como máximo ORGANIZATION. No admite cuentas institucionales, anónimas, no confirmadas, con roles universitarios ni identidades anteriores a la activación segura.
5. El AuthProvider recarga roles persistidos. Se continúa por los formularios P3/P6 y la revisión P4.

La migración no añade tablas de negocio ni columnas: siguen **45 tablas/381 columnas** en el catálogo local. Los tres contratos RPC nuevos están declarados como extensiones pendientes en `database.types.ts`; se conserva intacto el archivo generado oficial hasta poder regenerarlo contra el proyecto correcto.

La configuración privada `p11_external_registration` nace desactivada. Su apertura exige simultáneamente `enabled`, `smtp_verified`, `captcha_enabled`, `hook_installed`, `terms_approved` y una fecha válida `activated_at` no futura. El Before User Created Hook vive en `pyr_unibague_private.before_external_user_created`, solo es ejecutable por `supabase_auth_admin` y rechaza nuevas identidades institucionales o de otros proveedores. El hook valida email/nombre; no concede roles por metadata. Las nuevas identidades Google se rechazan: TI deberá preautorizar identidades institucionales existentes.

Se conserva la autorización por UUID; no se vinculan perfiles ni cuentas por consultas de coincidencia de correo en la aplicación. La vinculación automática de identidades corresponde a [Supabase Auth](https://supabase.com/docs/guides/auth/auth-identity-linking). Antes de activar Google, TI debe revisar las identidades existentes y reemplazar las cuentas ficticias TEST: su confirmación técnica no acredita propiedad del buzón. El callback Google rechaza estas direcciones.

La limitación de un minuto en el cliente evita reenvíos rápidos; **no sustituye** rate limits y CAPTCHA de Auth. PostgreSQL limita a tres organizaciones nuevas por responsable/hora, conserva reintentos idempotentes y bloquea duplicados de nombre legal/NIT normalizado entre solicitantes con locks transaccionales. Los índices no exigen limpiar ni borrar duplicados históricos. La concurrencia entre sesiones independientes queda pendiente de un entorno seguro real.

## Variables y activación futura

| Variable pública | Valor de esta entrega |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Configuración local ignorada; proyecto actual verificado |
| `VITE_PYR_DEMO` | Indicación del piloto existente |
| `VITE_INSTITUTIONAL_GOOGLE_ENABLED` | Ausente/false |
| `VITE_EXTERNAL_REGISTRATION_ENABLED` | Ausente/false |
| `VITE_TURNSTILE_SITE_KEY` | Vacío; pendiente de configuración |
| `VITE_REGISTRATION_TERMS_URL`, `VITE_REGISTRATION_PRIVACY_URL` | Vacías; requieren textos HTTPS aprobados |

No hay Client Secret, claves administrativas ni contraseñas en variables VITE. El servidor debe configurar los secretos de Google/SMTP/CAPTCHA fuera del frontend.

**Google Workspace:** proveedor Supabase Google OAuth, PKCE. TI debe proporcionar/autorizar proyecto Google Cloud, OAuth Client ID web, Client Secret, consentimiento, dominios y las identidades ya autorizadas. Dominios preparados: `unibague.edu.co` y `estudiantesunibague.edu.co`; confirmar con TI. No conceden roles automáticamente.

Callback de Google: `https://unxiuzkhxlzneywtnuvf.supabase.co/auth/v1/callback`. La URL pública definitiva del frontend **no está confirmada**. El desarrollo usa `http://localhost:5173`; no se presupone el Site URL remoto. TI debe registrar el origen HTTPS final y los callbacks exactos de la aplicación, incluidos `/auth/callback?flow=institutional`, `/auth/callback?flow=organization` y `/auth/callback` para recuperación, además de las variantes locales necesarias.

Procedimiento pendiente, no ejecutado:

1. Obtener acceso administrativo al proyecto actual y verificar que frontend, conexión administrativa y destino SQL sean el mismo ref. Comparar su historial y catálogo con P1–P10. No aplicar la cadena histórica a ciegas ni usar RESET.
2. Validar/aplicar la migración P11 en staging seguro, ejecutar pgTAP real, revisar Advisors y regenerar tipos oficiales. Confirmar que no se altera ninguna asignación existente.
3. Para registro externo: SMTP con buzón/remitente autorizados y entrega comprobada, confirmación email obligatoria (`mailer_autoconfirm=false`), contraseña mínima 12, CAPTCHA Turnstile y rate limits de Auth. Instalar el Before User Created Hook y verificar que rechaza signup mientras el gate está cerrado. Publicar textos autorizados y probar confirmación/recuperación/expiración con buzones controlados.
4. Solo después, coordinación configura el gate privado y `activated_at`; habilitar los flags/URLs públicos correspondientes y reconstruir el frontend. Nunca marcar los prerrequisitos como cumplidos para simular funcionamiento.
5. Para Google: configurar el proveedor con TI, probar identidad verificada existente, cuenta sin rol, identidad externa, multirrol y UUID/perfil único. Habilitar el flag público solo cuando el proveedor real esté comprobado. El botón verifica además `/auth/v1/settings` antes de redirigir.
6. Para cerrar registro: primero `enabled=false` en el gate del servidor y desactivar su flag público. Para cerrar Google: desactivar proveedor y flag con TI. Las organizaciones no dependen de Google. Revisar sesiones existentes según el procedimiento institucional.

Referencias oficiales: [Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha). Se revisó el changelog vigente; no se introdujo SAML, scraping, infraestructura de otro IdP ni acceso a aplicaciones privadas universitarias.

## Validación

| Comprobación | Resultado |
| --- | --- |
| Typecheck, lint, build, `git diff --check`, escaneo de secretos | PASS; comandos finales en evidencia |
| Unitarias P1–P11 | 302 PASS, 35 archivos |
| E2E base P1–P3 y PWA | 30 PASS |
| E2E P4 / P5 / P6A / P6B / P6C / P7 | 15 / 2 / 11 / 7 / 5 / 15 PASS |
| E2E nuevos P11 | 8 PASS; 93 pruebas E2E distintas en total |
| SQL PostgreSQL WASM P2–P7 | 474 aserciones complementarias PASS |
| SQL PostgreSQL WASM P11 | 55 aserciones complementarias PASS |
| Catálogo local integrado | 45 tablas, 381 columnas, 60 FK públicas, 32 RPC; todas las tablas de negocio con RLS |
| Configuración pública del proyecto actual | PASS, solo lectura |
| Schema/RLS/pgTAP/Advisors reales del proyecto actual | SKIPPED: sin acceso administrativo seguro |
| Signup, entrega SMTP, recuperación por buzón y Google reales | SKIPPED: cerrados por solicitud del usuario; pendientes de la Universidad |
| Despliegue a producción | NO EJECUTADO |

Las pruebas WASM ejecutan SQL y RLS en un PostgreSQL aislado, con Auth/Storage simulados y funciones auxiliares de aserción. **No son pgTAP hospedado, correo real ni concurrencia entre conexiones.** Las pruebas E2E utilizan el SDK real contra fixtures HTTP; nunca crean cuentas en el proyecto actual. Se cubren selección de acceso, login TEST/externo, multirrol, metadata sin privilegios, signup cerrado/aislado, confirmación PKCE, callback expirado, recuperación, corrección documental, revisión ADMIN, aprobación/rechazo/cambios, no autoaprobación, no acceso cruzado, restricciones institucionales y ausencia de duplicación de perfiles.

Se corrigió un selector P6B obsoleto para que compruebe las capacidades activa/total incorporadas en P10. No se cambió la ficha ni la lógica de capacidad. Evidencia resumida sin secretos: [p11/validation.json](p11/validation.json).

## Git y límites de entrega

Commit de implementación en `feat/p11-dual-auth-organizations`, integración conservando la historia de `dev` y push normal a `origin/dev`. El SHA final y la comprobación remota se entregan en el mensaje de cierre. No se publica en `main`, no hay force push ni despliegue solicitado.

La preparación funcional y sus pruebas están entregadas; **la activación hospedada sigue pendiente**. No debe anunciarse registro autónomo público, SMTP operativo o acceso Google habilitado hasta completar los pasos institucionales anteriores.
