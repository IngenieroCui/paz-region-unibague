# P11.1 — Estabilidad, UX y rendimiento

20 de octubre de 2026 · America/Bogota. Base verificada: `origin/dev`, P11 `1ba2854`. Rama: `feat/p11-1-stability-ux-performance`. Se preservan los módulos, los cuatro roles y RLS; no se crea COORDINATOR ni se interviene `main`.

## Estado y límites de seguridad

- **SQL remoto no ejecutado.** El conector denegó consultar el historial y el proyecto con `You do not have permission to perform this action`. P11 informó pendientes `20261016154045` y `20261020122421`; su estado remoto actual no pudo certificarse. P11.1 prepara `20261020134931_p11_1_organization_identity.sql`, sin modificar esos archivos históricos.
- La correctiva cubre INSERT y UPDATE de nombre legal/NIT normalizados. Conserva los límites de registro y usa bloqueos en orden consistente. Los índices únicos reemplazan los dos índices previos; el NIT vacío queda fuera del índice. Así la unicidad no depende exclusivamente de que una consulta vea cambios concurrentes. La migración aborta si encuentra duplicados previos y exige reconciliación institucional.
- El [procedimiento Dashboard](P11_1_DASHBOARD_SQL.md) incluye inspección de historial, duplicados, orden de aplicación, verificación y registro correcto del historial. No se presenta SQL aislado como ejecución remota.
- Auth público verificado: Google `false`, `disable_signup=false`, `mailer_autoconfirm=true`. **El endpoint de signup remoto sigue abierto.** Los flags de registro/Google de la aplicación permanecen cerrados. No se modificó Auth global porque no se pudo verificar si el proyecto es compartido ni disponer de gestión autorizada. Cerrar este riesgo requiere TI y la comprobación descrita en el procedimiento.
- No se deshabilitó RLS ni se concedieron roles desde el portal, el dominio de correo o metadata editable. La aprobación de organizaciones sigue siendo administrativa; el conflicto de interés depende de aplicar la migración P11 de seguridad.

## Credenciales y paquetes

`scripts/supabase-admin.mjs` acepta exclusivamente `SUPABASE_SECRET_KEY`. La clave reside en `work/admin.env`, ignorado y cargado solo por Node. Se elimina la dependencia ejecutable de `VITE_SUPABASE_SECRET_KEY`; su nombre se conserva únicamente en verificaciones de no exposición e historia documental. Vite mantiene su allowlist pública.

Las nueve contraseñas TEST expuestas fueron rotadas mediante Auth Admin, verificadas por login y seguidas de revocación global de sesiones de renovación. No se enviaron correos ni invitaciones. El ledger vigente permanece exclusivamente en `work/p11/cuentas-test.local.json`, ignorado. Los JWT ya emitidos pueden durar hasta expirar.

El TAR local previo se inspeccionó en memoria sin extraerlo: 1.715 archivos, 47 rutas privadas y nueve coincidencias de contraseñas antiguas. No se encontró la clave administrativa en los archivos examinados; un archivo mayor de 16 MB se omitió y no se certifica su contenido. El TAR anterior no se distribuye ni se elimina. La entrega nueva usa `exportar-codigo-seguro.ps1`, exclusivamente desde HEAD limpio, con inspección de rutas, patrones y archivos ZIP anidados. Sus pruebas positivas y negativas pasaron. No se incluyen archivos privados, sesiones, trazas reales ni credenciales en la entrega.

## Doble acceso

Se auditaron `/login`, ambas puertas, registro, callback PKCE, recuperación, restablecimiento y selector multirrol. Google sigue presentado como pendiente; las cuentas autorizadas conservan contraseña. Organizaciones aceptan correos externos y tienen una explicación desplegable de estado de solicitud, documentación y revisión institucional, sin prometer registro público disponible.

Los permisos siguen procediendo de `pyr_unibague_current_roles`/`UserRoles` y RLS. Entrar por otra puerta redirige al espacio autorizado; una cuenta multirrol accede al selector y nunca obtiene permisos nuevos por la navegación. Se verificaron denegaciones entre roles y organizaciones.

Auth duplicaba consultas en la coincidencia de `getSession()` e `INITIAL_SESSION`, además de eventos SIGNED_IN repetidos. Se deduplica el mismo usuario/token durante 30 segundos. TOKEN_REFRESHED y USER_UPDATED verifican roles; un foco posterior vuelve a consultarlos. Una actualización del mismo usuario conserva el contenido hasta responder; error o cambio de identidad descartan los permisos previos. RLS continúa verificando cada operación en servidor.

## Estudiantes y perfil para todas las carreras

El inicio tiene saludo y contexto académico, **Mi perfil**, **Mi experiencia en Paz y Región** y **Lo siguiente para mí**. Muestra hasta tres acciones; la lista completa se agrupa en datos básicos, información recomendable, documentación e información opcional. El porcentaje conserva sus reglas de preparación existentes y se presenta como orientativo, separado de elegibilidad administrativa.

Sin periodo vigente se explica la situación y se orienta a coordinación; no se fabrican participaciones. Se conservan participaciones anteriores y enlaces a su asignación por periodo. La asignación/proyecto actual conserva su componente y consulta protegida.

Bio y descripción de trabajo se presentan como recomendaciones que pueden completarse después. GitHub, LinkedIn, portafolio y otros enlaces están en un desplegable, etiquetados expresamente como opcionales, con explicación aplicable a cualquier programa. No cambian completitud, matching ni elegibilidad y su ausencia no impide guardar. Las regresiones incluyen Derecho sin enlaces, bio ni experiencia laboral. Las experiencias también se describen como opcionales.

## Auditoría UX/UI transversal

Se conservaron `#003D7C`, `#FFCC00`, Roboto, logo, navegación y funcionalidades. Se aumentó la lectura de texto operativo, títulos de listas, detalles y tablas; se compactaron cabeceras, pasos y estados vacíos. Los formularios conservan etiquetas, foco, validación y controles accesibles. Las tablas mantienen desplazamiento contenido en móvil.

| Espacio/superficie | Verificación y resultado |
| --- | --- |
| STUDENT: inicio, perfil, experiencia, habilidades, preferencias, documentos, asignación, notificaciones | Rediseño del inicio; campos opcionales claros; consultas por sección; estados vigentes e históricos y sin periodo |
| ORGANIZATION: inicio, perfil/contactos, documentos, revisión, proyectos/plazas, convocatorias, equipos | Tipografía común y catálogos cacheados; inicio con últimas tres revisiones y enlace al historial íntegro; flujo y aislamiento conservados |
| ADVISOR: inicio, responsabilidades, organizaciones, estudiantes, proyectos, perfil, notificaciones | Lectura y estados vacíos comunes; periodo y responsabilidades reales sin inventar registros; historial de módulos conservado |
| ADMIN: resumen, pendientes/CSV, estudiantes, organizaciones, proyectos/plazas, convocatorias, grupos, asesores, casos, usuarios/roles, matching, asignaciones, catálogos, auditoría | Tablas/detalles legibles y formularios comunes; filtros, paginación, confirmaciones, permisos y estados vacíos cubiertos por suites existentes |

Se verificaron 320, 390, 768, 1024 y 1440 px y se revisaron visualmente capturas reales de los cuatro inicios y móvil estudiantil. Axe y teclado se ejecutaron en las suites. Se comprobó **antes de intervenir** que “Saltar al contenido” está oculto, aparece con Tab y enfoca `#main`; no se cambió su CSS.

La base remota tiene estudiantes TEST sin perfil y sin periodo/catálogos académicos. Sus estados vacíos son resultados reales. Los módulos poblados, periodo vigente y ciertos casos históricos se verifican con fixtures E2E/SQL explícitos, no se presentan como datos institucionales existentes.

## Rendimiento

`loadStudent(userId, section)` conserva la autorización y carga solo los datos utilizados por la sección. Inicio no descarga municipios, catálogo de habilidades ni experiencias. Documentos consulta perfil, estudiante y documentos; perfil omite hijos y periodo; experiencias, habilidades y preferencias cargan sus datos específicos.

Catálogos usan columnas explícitas, paginación territorial existente y caché de memoria por usuario, TTL cinco minutos, single flight, descarte de errores y límite de entradas. La caché se limpia al cambiar/cerrar sesión y en eventos de renovación/actualización. No se persisten registros privados ni catálogos entre usuarios. Organización reutiliza sus tipos y municipios durante la navegación. Los cambios administrativos externos pueden tardar hasta cinco minutos en aparecer; renovar sesión/foco con verificación de roles limpia la caché cuando corresponda.

`useResource` conserva datos válidos al recargar el mismo recurso y expone `refreshing`; un nuevo loader oculta los datos anteriores desde el render, antes del efecto. Se descartan respuestas viejas y se conservan formularios durante actualizaciones pequeñas. Estudiante puede reintentar una actualización fallida sin perder la información válida.

Las rutas ya estaban separadas en chunks; se conservaron. Roboto se convirtió de TTF a WOFF2 sin eliminar glifos ni alterar métricas: **496.204 → 224.696 bytes**. La precaché del build pasó de aproximadamente **1.492 a 1.227 KiB**. Logo ya pesaba 1.858 bytes. No se crearon índices especulativos: no hay autorización para inspeccionar EXPLAIN ni Advisors remotos. Workbox conserva `runtimeCaching: []` y exclusiones de callback/Auth; no cachea consultas privadas, Auth ni documentos.

### Medición y resultados

Recolector reproducible: `scripts/measure-p11-1.mjs`. Edge real headless, 1440×960, sin throttling, SW bloqueado para aislar red; Vite local conectado al mismo Supabase hospedado. P11 se ejecuta en checkout separado `1ba2854`; después se mide P11.1 con las mismas cuentas y recolector. Se guardan únicamente operaciones, tiempos, tipos de petición y bytes, sin JWT, cuerpos ni parámetros privados.

La primera sesión incluye carga fría de módulos. Las cinco recargas completas siguientes reinician la aplicación conservando la caché HTTP del navegador: el nombre interno `cold-document` indica la primera recarga, **no** una caché HTTP totalmente fría. Las navegaciones SPA de perfil/inicio son muestras individuales y se informan como tales. No hay muestras suficientes para un p95 estable de cada operación; se informa mediana y extremos, sin extrapolar porcentajes.

| Espacio | Mediana antes → después (ms, n=5) | Peticiones por recarga | Bytes de respuesta medianos |
| --- | ---: | ---: | ---: |
| STUDENT | 1142 → 771 | 8 → 5 | 7379 → 4584 |
| ORGANIZATION | 827 → 931 | 10 → 9 | 11170 → 10254 |
| ADVISOR | 515 → 582 | 3 → 2 | 2534 → 1711 |
| ADMIN | 565 → 713 | 3 → 2 | 2614 → 1798 |

Los resultados exactos están en [performance-summary.json](p11-1/performance-summary.json) y sus evidencias antes/después. Disminuyeron peticiones y bytes, con mejora del inicio estudiantil en esta muestra; otros tiempos de red no mejoraron consistentemente. No se declara una aceleración global ni un porcentaje garantizado. La variabilidad observada exige medir de nuevo sobre el despliegue final con red controlada.

### Hospedaje

La URL proporcionada, `https://pazregionunibague-sepia.vercel.app`, responde 200 en `/` y 404 de Vercel en `/login` y `/login/institucional`. Entrando desde la raíz se observa un formulario único anterior a P11. No se aplican las cifras locales como si fueran tiempos de esa versión hospedada. La medición de las rutas directas queda bloqueada antes de React.

Se añade `vercel.json` con la [reescritura SPA oficial para Vite](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas). El conector Vercel no encontró el despliegue ni un proyecto coincidente en su cuenta accesible. No se modifica la rama de producción ni se publica `main`. El push a dev no certifica por sí mismo que esa URL esté sirviendo el nuevo commit; comprobar el despliegue conectado, callbacks y URLs de retorno después de desplegar dev mediante el mecanismo autorizado.

## Pruebas y evidencia

| Comprobación | Resultado |
| --- | --- |
| P11 de referencia | 303 Vitest y build PASS |
| Typecheck, lint, build final | PASS |
| Vitest P11.1 | 312 PASS, 36 archivos |
| E2E base con P11.1 | 39 PASS; después se añade y comprueba la regresión de historial compacto de organización |
| P4 | 45 PASS, incluye 30 pruebas base ya contadas |
| Matching / asesores / convocatorias / asignaciones / operaciones / P11 | 2 / 11 / 7 / 5 / 15 / 8 PASS |
| E2E distintos incluyendo nueva regresión de organización | 103 PASS en conjunto |
| PostgreSQL WASM integrado | 540 aserciones PASS; 45 tablas, 381 columnas, 60 FK, 32 RPC y RLS en todas las tablas PYR |
| Auth/Data/Storage reales | 19 PASS; omisiones explícitas de SQL remoto, envío P11 y proveedores no configurados |
| Navegador real por rol | 9 cuentas, 37 rutas internas más páginas públicas, roles ajenos denegados, persistencia/logout y axe PASS |
| Exposición Vite / build / PWA | 108 archivos examinados, 0 hallazgos |
| Empaquetado seguro | Exclusión de ignorados y rechazo de ruta privada/secreto sintético/ZIP anidado PASS |
| Runtime remoto desechable y concurrencia | 25 SKIPPED explícitos por ausencia de conexión/driver/fixtures autorizadas |

Las suites SQL WASM tienen Auth/Storage simulados y una sola sesión; no sustituyen pgTAP hospedado ni concurrencia real. La nueva prueba de concurrencia está preparada para dos conexiones con una base desechable autorizada. Las suites de navegador usan fixtures HTTP salvo la auditoría identificada como real. La auditoría real se ejecutó por rol en navegadores separados tras observar fallos intermitentes en el proceso largo; no se ocultaron fallos como pruebas aprobadas. La carga lenta, cambio de sesión, revocación de roles, puerta equivocada, multirrol, perfil sin enlaces y conservación de historial tienen regresiones específicas.

## Git y reproducción

Commits de implementación: `4fdf502` (seguridad, Auth y migración) y `c4d0535` (UX, consultas y fuentes). Evidencias y procedimiento: `22df396`. Integración por fast-forward en el repositorio original y push normal a `origin/dev` **verificados** en `22df39686211d0015547a3ad9bf83665ea168233`, coincidente con `git ls-remote`. El escaneo previo examinó 455 rutas y 439 blobs sin hallazgos. La rama local `main` conserva `b7502feb52150592a90aef65cbbb10b5382c7a8e`.

Un commit posterior cierra únicamente esta constancia documental. Su SHA final se contrasta de nuevo con `origin/dev` y se entrega en `git-verification.json`, junto al paquete seguro generado desde ese HEAD limpio. El TAR privado previo sigue fuera de Git. La comprobación posterior al push aún encuentra 404 en la ruta hospedada institucional: no se declara desplegado P11.1 en esa URL.

```text
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e -- --reporter=list
node tests/run-p4-e2e.mjs
node tests/matching/run-e2e.mjs
node tests/advisors/run-e2e.mjs
node tests/p6b/run-e2e.mjs
node tests/assignments/run-e2e.mjs
node tests/p7/run-e2e.mjs
node tests/p11/run-e2e.mjs
node tests/sql/run-integrated-wasm.mjs       # PYR_PGLITE_MODULE externo
node scripts/verificar-p11-real.mjs
node scripts/verificar-p11-browser.mjs       # PYR_TEST_ROLE permite aislar un rol
node scripts/verificar-p11-frontend.mjs
node scripts/verificar-secretos-p11.mjs
```

No volver a distribuir credenciales TEST. La rotación es una acción administrativa explícita: `node scripts/rotate-p11-1.mjs --apply`, con ledger privado y clave Node; no es parte de las pruebas habituales.
