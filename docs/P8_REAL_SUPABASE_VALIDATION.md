# P8 — Validación de Supabase real

13 de octubre de 2026 · alcance maestro v0.4.

**Resultado:** aplicación operativa para un piloto local controlado con cuentas administradas y datos TEST. Las operaciones descritas abajo se ejecutaron contra Supabase hospedado. La recuperación por correo/PKCE completo continúa pendiente de un buzón de prueba entregable y configuración de correo; no se declara validada por las pruebas de recuperación administrativa.

## Proyecto y Git

- Proyecto único: `PYRUnibague`, ref `flrdqhemgbrdclgeynpk`, `us-east-1`, `ACTIVE_HEALTHY`.
- URL: `https://flrdqhemgbrdclgeynpk.supabase.co`.
- Worktree: `C:\Users\SENA\Documents\Codex\2026-10-13\c-users-sena-documents-pyr2026b-paz-4\work\p7-integration`.
- Rama: `validation/p8-supabase`, base `36588c2`. El commit de entrega es HEAD de esta rama; la copia exportada del informe incorpora su SHA después del commit. No se modificaron `main` ni `dev`; no hubo push.
- MCP confirmó inicialmente cero tablas públicas, cero migraciones y cero usuarios Auth. No se creó otro proyecto ni se ejecutó RESET remoto.

## Migraciones y contrato

Las doce migraciones originales se ejecutaron individualmente por MCP y en orden. MCP asigna la versión del servidor; los archivos locales se renombraron para coincidir **sin cambiar su SQL**. La CLI 2.81.3 quedó vinculada después y confirmó correspondencia local/remota y `db push --dry-run` sin repeticiones.

| Ordinal P7 | Versión aplicada |
| --- | --- |
| 001 core | 20261013200313 |
| 002 domain | 20261013200324 |
| 003 security | 20261013200328 |
| 004 reference | 20261013200331 |
| 005 estudiante/organización | 20261013200503 |
| 006 proyectos/admin | 20261013200506 |
| 007 matching | 20261013200509 |
| 008 asesores/contactos | 20261013200513 |
| 009 convocatorias/equipos | 20261013200517 |
| 010 asignaciones | 20261013200522 |
| 011 integración | 20261013200525 |
| 012 operaciones P7 | 20261013200530 |
| Correctiva: RLS initplan | 20261013202641 |
| Correctiva: validar constraint Matching | 20261013203922 |

**14 migraciones aplicadas**: las doce solicitadas y dos correctivas creadas/aplicadas por CLI. La primera conserva las mismas reglas de autorización y evalúa `auth.uid()` una vez por sentencia en diez policies. La segunda valida los registros históricos contra `pyr_matching_eligibility_total`, originalmente NOT VALID. Ninguna migración ya aplicada se reescribió.

Catálogo real final: **45 tablas**, todas con prefijo literal `PYRUnibague_` y RLS; **381 columnas, 60 FK entre tablas públicas, 83 FK incluyendo Auth, 163 índices, 109 policies, 97 triggers y 29 RPC**. Cero constraints sin validar. Coincide con P7/v0.4; no se agregaron tablas de negocio. Historial, unicidad estudiante/periodo, cupos, rollback y responsabilidades individuales se comprobaron con PostgreSQL real.

## Auth, entorno, Storage y Edge

`.env.local` contiene solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, usando una clave `sb_publishable_`. Vite inicializa el cliente y los navegadores ingresaron por Auth real. Git ignora `.env.local`, `work/` y `supabase/.temp/`. Se comprobó que el bundle no contiene el token de administración, claves secret ni JWT de service_role. La cadena literal `sb_secret_` del validador de configuración es una protección del código, no una credencial.

Auth hospedado: Site URL `http://localhost:5173`, redirect único `http://localhost:5173/auth/callback`, registro público deshabilitado, contraseña mínima 8, JWT 3600 segundos. No se habilitó Google OAuth. Login, logout, refresh, persistencia al recargar, multirrol, guards y rechazo de callback inválido pasaron. Recuperación: Auth emitió un token de un solo uso, se verificó `PASSWORD_RECOVERY`, cambio de contraseña, login posterior y rechazo de replay. **La entrega por correo y el callback PKCE exitoso no están certificados**: el endpoint de recuperación rechaza los correos reservados `example.test`. Se mantienen las pruebas de regresión PKCE aisladas, identificadas como tales.

Buckets privados: `pyrunibague-student-documents` y `pyrunibague-organization-documents`, límite 10 MB, MIME permitidos PDF/Word/PNG/JPEG. Se ejecutaron upload, metadata, signed URL de 60 segundos, descarga y comparación de bytes, rechazo ajeno y público, eliminación, MIME inválido y compensación de un fallo real de metadata. La UI también rechazó archivo vacío/extensión inválida y subió/eliminó un PDF TEST. No se almacenaron binarios en PostgreSQL.

`matching-run`: **ACTIVE, versión 2, `verify_jwt=true`**. `PYRUNIBAGUE_ALLOWED_ORIGINS=http://localhost:5173` configurado en secrets del runtime. `SUPABASE_URL` y `SUPABASE_ANON_KEY` inyectados funcionaron en el despliegue real; no se introdujeron claves privadas en la función. Pruebas: anon 401, roles no ADMIN 403, origen ajeno 403, input inválido 400, ADMIN 200; roles leídos desde UserRoles, RLS, puntuaciones/bloqueos explicables e historial persistido. Dos sesiones no pueden crear runs simultáneos. Solo matching estructurado, sin APIs de IA externas.

## Cuentas y recorrido persistido

Nueve cuentas ficticias, contraseñas aleatorias individuales y correos `p8-…@example.test`: un ADMIN, dos ADVISOR, dos ORGANIZATION y cuatro STUDENT. Student B tiene además ORGANIZATION para probar cambio de espacio; ese rol no le concede membresías ajenas. UserRoles es la fuente de permisos. El primer ADMIN se otorgó mediante SQL dirigido al UUID de una identidad TEST recién creada por Auth Admin; no existe bootstrap público, metadata privilegiada ni seed universal.

Credenciales únicamente en el archivo local ignorado `work/p8/fixtures.local.json`; no se incluyen en este documento, capturas ni Git. El token suministrado por el usuario continúa en su archivo original fuera del repositorio y no se copió al código.

Datos del piloto: periodo **2026B**, catálogos TEST de Sistemas/Mecánica/Electrónica, Ibagué/Espinal, dos organizaciones ficticias TEST, contactos, dos proyectos aprobados, plazas activas con capacidades **1 y 2**, convocatorias, asesores manuales, dos elegibles asignados, un no elegible y un inactivo. Se preservaron/reutilizaron catálogos existentes antes de insertar. No representan aprobación de catálogos institucionales.

Recorrido real completo: onboarding y guardado de organización → contacto → proyecto/plaza/convocatoria → revisión ADMIN → asesor regional → elegibilidad → pesos/Matching → optimizador productivo → confirmación → asesor individual → grupos → consulta y notificación estudiantil → pendientes/CSV. Se verificó que cambiar el asesor regional no cambia asesorías individuales previas.

La UI ejecutó dos reasignaciones de Student B, retiro y confirmación posterior mediante el worker del optimizador. Se conservaron asignaciones/eventos/asesorías/membresías anteriores, se liberaron cupos y se mostraron compañeros reales del mismo proyecto durante la prueba. El destino temporal quedó inactivo y ambos estudiantes volvieron a sus destinos/grupos originales. Panel final 2026B: **dos confirmados, un cupo disponible, cero elegibles sin asignar, cero pendientes, cero asignados sin asesor y cero asignaciones para revisión**.

Los fixtures técnicos de ocho pruebas de concurrencia quedaron cerrados/archivados, sus estudiantes inactivos y sus 24 identidades sin roles. Se preservó todo el historial. Solo las nueve cuentas del piloto conservan permisos; los registros técnicos no participan en 2026B.

## Evidencia y correcciones

| Comprobación | Resultado final |
| --- | --- |
| Typecheck, lint, build y diff --check | PASS |
| Vitest | 271 PASS / 33 archivos |
| E2E regresiones HTTP aisladas P1–P7 | 85 PASS: 30/15/2/11/7/5/15 |
| Suites runtime existentes, Supabase real | **24 PASS / 0 FAIL / 0 SKIPPED** |
| pgTAP real P2–P7 | **474 aserciones PASS**: 67/36/61/27/85/53/68/77 |
| Navegador con Auth/PostgREST/Storage reales | 38 recorridos PASS y 6 comprobaciones adicionales de ciclo de asignación |
| Móvil/desktop | PASS a 320/390/768/1440 px; capturas inspeccionadas |
| Impresión, CSV, refresh, vacíos, guards y documentos | PASS real |
| Deno check entrypoint/engine/embeddings | PASS |
| Tipos oficiales vs esquema remoto | PASS, comparación exacta de archivo generado |
| Recuperación Auth administrativa de un solo uso | PASS real |
| Entrega SMTP + callback PKCE exitoso | **SKIPPED**, requiere correo entregable/configurado |

Las 474 aserciones incluyen las cuatro suites SQL invocadas por runtime; no se suman como 474 pruebas adicionales independientes de las 24. E2E aislado y pruebas unitarias son regresión complementaria; no sustituyen las pruebas reales.

Correcciones: enlace productivo «Ver historial» de organización reparado; tipos oficiales en `database.generated.ts`, con refinamientos SQL explícitos para argumentos RPC nullable y CHECK de texto en `database.types.ts`; fixtures SQL acotados a sus registros/baselines; prueba de concurrencia Matching usa observador administrativo para consultar wait events sin conceder `pg_monitor` a usuarios; Vitest usa configuración vacía por defecto y no hereda la conexión real; scripts suplementarios reconocen las versiones reales y no sobrescriben tipos oficiales. Las fallas iniciales de validación se corrigieron y repitieron antes de registrar PASS.

## Advisors y límites del piloto

Sin hallazgos ERROR. Los diez avisos `auth_rls_initplan` se corrigieron por migración y desaparecieron. Permanecen avisos de [22 RPC SECURITY DEFINER autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): son endpoints deliberados con search_path vacío, revocación PUBLIC/anon y autorización interna verificada por las suites reales. No se retiraron controles para silenciar el Advisor.

La [protección contra contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) permanece deshabilitada: se intentó activarla y el API respondió **402**, requiere condiciones del plan que no se contrataron. Se conservan contraseñas aleatorias fuertes en las cuentas TEST. Rendimiento informa policies permisivas múltiples (ADMIN + propietario/miembro) e índices aún no usados con un conjunto pequeño de datos; se conservaron los índices de integridad y las reglas de acceso.

**Piloto permitido:** local, cuentas administradas, participantes informados y datos ficticios. Antes de recuperación autoservicio/invitaciones reales: configurar un remitente/buzón de prueba autorizado, validar entrega SMTP y callback PKCE completo. Revisar la protección de contraseñas disponible en el plan y confirmar los catálogos/reglas institucionales. Este cierre no declara producción pública ni despliega un frontend remoto.

## Arranque y reproducción

Desde el worktree indicado: `npm run dev -- --host 127.0.0.1 --port 5173`; abrir `http://localhost:5173`. La conexión pública local ya está preparada. Las cuentas TEST se consultan en el archivo local ignorado indicado; nunca copiar credenciales a tickets o documentación.

Evidencia local sin versionar en `work/p8/`: `runtime.log`, `sql-results.json`, `browser-results.json`, `lifecycle-browser-results.json`, `e2e-results.json`, `final-schema.json`, `final-migrations.json`, `final-settings.json`, `secret-types-check.json` y `screens/`. Scripts locales `run-runtime.mjs`, `sql-check.mjs` y `browser.mjs` reproducen las validaciones de esta máquina; runtime usa pg real, TLS con CA/hostname verificados y un login CLI temporal. Su adaptador restaura el rol postgres al preparar fixtures/RESET ROLE y conserva authenticated en las operaciones de RLS. No hay stubs SQL/Auth/Storage en las pruebas declaradas reales. Una repetición de concurrencia conserva nuevas historias técnicas y exige volver a archivarlas al terminar.

Las suites de Git mantienen sus contratos de variables P5/P6A/P6B/P6C/P7 documentados en cada archivo runtime. Se conservaron fuera de alcance matrícula, planes, cronogramas, entregables, Comprensión del Entorno, asignación territorial automática, certificados ARL y docentes técnicos obligatorios.
