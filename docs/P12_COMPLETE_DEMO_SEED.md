# P12 - Seeder y demostración real

20 de octubre de 2026, America/Bogota. **Estado: PARCIAL / BLOQUEADO. P12 no cumple todavía su criterio final.**

Base: `origin/dev` verificado por fetch, commit `688c2b5`. Rama `feat/p12-complete-demo-seed`. Destino único: Supabase `unxiuzkhxlzneywtnuvf`. No se usó el proyecto anterior, no se crearon identidades ni se cambiaron roles o contraseñas.

## Estado remoto y límites

La Secret API Key local permite Auth Admin, REST y Storage desde Node. No concede permisos de Management/SQL ni despliegue de Edge Functions. El conector de Supabase respondió `You do not have permission to perform this action` al consultar el proyecto, migraciones y funciones.

OpenAPI administrativo expone 45 tablas PYR y 29 RPC PYR. Se inspeccionaron los contratos REST actuales y las migraciones locales; **no se certificó el catálogo SQL remoto de FK, triggers, RLS ni el historial de migraciones**. El archivo privado de contratos se limita al prefijo PYR; el proyecto contiene otras aplicaciones que no son parte del escenario.

Faltan las tres RPC de P11: `pyr_unibague_external_registration_ready`, `pyr_unibague_start_external_onboarding`, `pyr_unibague_submit_organization`. `GET /functions/v1/matching-run` autenticado devuelve 404 `NOT_FOUND`. Se mantienen bloqueadas publicación, matching, confirmaciones y equipo final. No se insertan candidatos, recomendaciones ni notificaciones artificiales; no se confirma manualmente para sustituir el algoritmo.

Migraciones locales que requieren cotejo y aplicación por un canal SQL autorizado, en orden y sin reset:

1. `20261016154045_p11_dual_auth_organizations.sql`
2. `20261020122421_p11_review_safety.sql`
3. `20261020134931_p11_1_organization_identity.sql`

Después se debe desplegar `matching-run` mediante el mecanismo autorizado del proyecto actual y comprobar su autenticación. El seeder no despliega funciones ni aplica DDL con la Secret Key. Si existe un `SUPABASE_ACCESS_TOKEN` autorizado en el entorno privado, el preflight consulta el historial por Management; nunca lo imprime. No es necesario ese token para las etapas independientes ya ejecutadas.

## Datos reales del escenario

Identificador estable: `PYR-DEMO-2026B`, presente en descripciones, nombres de documentos, entidades del piloto y manifiesto local. Los UUID actuales permanecen en `work/p12/manifest.local.json`, ignorado por Git.

| Entidad | Resultado persistido |
| --- | --- |
| Periodo | `TEST-PYR-2026B`, nombre `2026B — Piloto TEST`, activo y actual; no existía periodo actual |
| Programas | Ingeniería de Sistemas, Comunicación Social y Derecho, todos etiquetados TEST; no son un catálogo oficial |
| Territorio/tipo | Municipio y tipo ficticios P11 reutilizados; segundo municipio TEST creado |
| Habilidades | Tres habilidades interdisciplinarias TEST |
| Estudiantes | Cuatro perfiles distintos, semestres 8/9, presentación, territorio, habilidades, intereses, preferencias y PDF privado |
| Participación | Cuatro participaciones activas; estudiantes 1/2/3 elegibles, estudiante 4 no elegible; no se inventó un motivo institucional |
| Organización A | Reutiliza `TEST P11 Organización 2`, cuenta `entidad2`, ya aprobada por ADMIN independiente |
| Organización B | Reutiliza `TEST P11 Organización 1`, cuenta `entidad`, pasa de rechazada a cambios solicitados mediante la revisión P4 existente; conserva historial y observación TEST |
| Contactos | Representante principal e interlocutor adicional por organización; contactos anteriores conservados |
| Documentos | Cuatro CV y dos constancias organizacionales P12 sintéticos, PDF legibles, buckets privados y metadata vinculada |
| Asesor 1 | Cuenta `asesor`: organización A y estudiante 1, responsabilidades independientes por periodo |
| Asesor 2 | Cuenta `asesor2`: organización B y estudiante 2, responsabilidades independientes por periodo |
| Proyecto/plazas | Un proyecto interdisciplinario borrador de A; dos plazas activas de capacidad uno, programas y habilidades compatibles con estudiantes 1/2 |
| Convocatoria | Borrador con ambas plazas del proyecto y mismo periodo/organización |
| Configuración | `hybrid-v0.1`, pesos 40 académico + 30 habilidades + 10 ubicación + 20 preferencia, suma 100; semántica desactivada, umbral 70 |
| Asignaciones/matching/equipo | Ninguna ejecución ni asignación fabricada. Los cuatro estudiantes permanecen sin asignación mientras falte el matching real |

Se registraron 46 entidades creadas mediante `ensure`, además de reutilizar las dos organizaciones, catálogos P11 y crear responsabilidades mediante sus RPC. El manifiesto contiene también identidades y referencias reutilizadas. Las preferencias y responsabilidades usan sus RPC reales. No hay matrícula, cronograma, plan de acción, entregable ni módulos nuevos.

La revisión organizacional usa el flujo P4 realmente disponible, con ADMIN sin membresía en ambas organizaciones. No se presenta como envío formal P11 ni certifica las protecciones adicionales pendientes. B conserva el estado de cambios solicitados y puede editar sus datos; el botón de reenvío formal permanece bloqueado por la RPC ausente.

## Cuentas existentes verificadas

| Cuenta | Rol | Estado |
| --- | --- | --- |
| `pyrprueba.estudiante@estudiantesunibague.edu.co` | STUDENT | Sistemas, elegible, asignación pendiente por dependencia remota |
| `pyrprueba.estudiante2@estudiantesunibague.edu.co` | STUDENT | Comunicación Social, sin GitHub, elegible, asignación pendiente |
| `pyrprueba.estudiante3@estudiantesunibague.edu.co` | STUDENT | Sistemas, elegible sin asignación |
| `pyrprueba.estudiante4@estudiantesunibague.edu.co` | STUDENT | Derecho, no elegible, sin asignación |
| `pyrprueba.entidad@unibague.edu.co` | ORGANIZATION | B, cambios solicitados |
| `pyrprueba.entidad2@unibague.edu.co` | ORGANIZATION | A, aprobada |
| `pyrprueba.asesor@unibague.edu.co` | ADVISOR | StaffProfile activo; A y estudiante 1 |
| `pyrprueba.asesor2@unibague.edu.co` | ADVISOR | StaffProfile activo; B y estudiante 2 |
| `pyrprueba.administrador@unibague.edu.co` | ADMIN | Revisión independiente, métricas, pendientes y exportaciones reales |

Los nueve emails/UUID se cotejan mediante Auth Admin, luego se realizan logins con contraseña y se consultan los roles persistidos. La metadata TEST es una comprobación adicional; no concede permisos. Las contraseñas siguen en el registro local privado P11; no están en este documento ni en el seed.

## Reproducción

Node >=22.12, `npm ci`, entorno público del proyecto actual y `SUPABASE_SECRET_KEY` en `work/admin.env` (o variable de entorno local). `supabase-admin.mjs` comprueba proyecto y clave pública, y restringe las peticiones al proyecto autorizado.

Conservar/restaurar el registro autorizado de las nueve cuentas en `work/p11/cuentas-test.local.json`, o indicar `PYR_P12_LEDGER`. Debe tener `project_ref` y `accounts` con `email`, `user_id`, `role`, `password`. No se genera ni incluye un registro nuevo. Conservar también el manifiesto de ejecución privado cuando se cambie de checkout; contiene el vínculo exacto entre documento y ruta privada. **No eliminar el manifiesto para intentar reiniciar un escenario ya sembrado.**

Desde la raíz del repositorio:

```text
node scripts/seed-pilot-complete.mjs --plan
node scripts/seed-pilot-complete.mjs --apply
node scripts/seed-pilot-complete.mjs --verify
node scripts/verify-pilot-complete.mjs
node scripts/verify-pilot-browser.mjs
node --test tests/p12/seed.test.mjs
```

`--plan` no modifica datos de dominio; sí verifica Auth y escribe evidencias locales. `--apply` guarda intención/UUID antes de insertar, y persiste el manifiesto por pasos mediante reemplazo atómico. Los errores de red no justifican duplicar filas. Si una fila reutilizada desaparece, cambia de UUID o hay coincidencias ambiguas, aborta. El archivo `seed.lock` impide ejecuciones simultáneas de plan/apply/cleanup; después de un proceso interrumpido, revisar su PID antes de retirar manualmente un lock obsoleto.

Código de salida: 0 para comprobación sin bloqueos, 1 para error y 2 para ejecución parcial con dependencias pendientes. La verificación no declara terminado P12 cuando quedan bloqueos. La fase futura de matching invoca la Edge Function real, usa el optimizador existente sobre candidatos reales restringidos al escenario y confirma mediante RPC con la revisión del snapshot. **Esa fase no se ejecutó ni se certificó remotamente.** El ciclo de retiro/reasignación/restauración y sus negativos siguen pendientes; el verificador los marca bloqueados, no PASS.

Si cambia la elegibilidad, asesor o periodo fuera del seeder, se exige revisar la discrepancia. Las correcciones no borran historial. El periodo actual institucional existente se respeta. La activación inicial del periodo TEST usa UPDATE ADMIN sujeto al índice único parcial, sin desmarcar un periodo que pudiera aparecer concurrentemente.

Limpieza explícita, acotada y conservadora:

```text
node scripts/seed-pilot-complete.mjs --cleanup --confirm=PYR-DEMO-2026B
```

Solo elimina hojas creadas y registradas por el seed (intereses, habilidades y vínculos de plazas/interlocución). Conserva perfiles, organizaciones, periodos, PDFs, revisiones, responsabilidades e historial. Si hay runs de matching o asignaciones del escenario, cancela la limpieza para preservar evidencia. **No es una eliminación integral del piloto.** No se ejecutó cleanup confirmado en esta entrega; sí se comprobó que sin confirmación aborta antes de conectarse.

## Verificación y evidencias

Typecheck, lint, 312 Vitest, build y 40 E2E base: PASS. Cinco pruebas Node del seeder: PASS (idempotencia, persistencia de intención antes de fallo, rechazo de ambigüedad, protección de registros reutilizados y proyecto incorrecto). Las suites E2E base usan fixtures HTTP y no se confunden con las pruebas reales siguientes.

Verificación Supabase real: 24 PASS, 0 FAIL y cinco grupos BLOCKED. Cubre Auth de nueve cuentas, periodo visible, perfiles diferentes, preferencias/participaciones, roles, aislamiento de datos y Storage, documentos propios/ADMIN y denegación cruzada/anónima, responsabilidades independientes, integridad de proyecto/convocatoria/plazas, cupos persistidos, métricas y exportaciones por RPC. Los asesores no obtienen documentos privados de estudiantes según el contrato existente. Una capacidad persistida correcta **no** equivale a haber ensayado un exceso de cupo en servidor.

Idempotencia real: tras dos ejecuciones se conservan los mismos 46 registros y UUID del manifiesto. No se crearon asignaciones ni runs. No se reescribieron revisiones innecesariamente.

Los PDFs se renderizaron e inspeccionaron visualmente. Capturas de escritorio y móvil, impresión institucional y tiempos de navegación con Supabase real se guardan en `work/p12/browser/`. El informe de navegador diferencia expresamente frontend local y hospedado; sus resultados finales están en `work/p12/browser-verification.local.json`. Las capturas y UUID de ejecución permanecen fuera de Git.

Evidencias privadas: `preflight.local.json`, `contracts.local.json`, `manifest.local.json`, `verification.local.json`, `idempotence.local.json` y `browser-verification.local.json` dentro de `work/p12/`. No incluyen claves, contraseñas, sesiones, trazas ni cuerpos de Auth.

## Hospedaje, Git y pendientes

La puerta `https://pazregionunibague-sepia.vercel.app/login/institucional` sigue devolviendo **404**. No se certifican nueve recorridos hospedados ni se presentan tiempos locales como medidas de esa URL. El frontend de `dev` ya incluye la reescritura SPA de P11.1; falta comprobar el despliegue que sirve esa URL. No se modificó `main` ni el proyecto Vercel de otra cuenta.

**No se publica a `origin/dev` mientras fallen las condiciones críticas remotas exigidas por el pedido.** El trabajo se conserva en la rama P12 para su revisión y continuación. El estado concreto del commit/entrega se comprueba en el repositorio, sin incluir credenciales en Git.

Para cerrar P12: disponer de canal SQL autorizado; cotejar y aplicar migraciones pendientes; verificar SQL/RLS y conflicto de interés; desplegar matching; ejecutar y revisar scores/optimizador/confirmaciones/capacidad; completar equipo/notificaciones/ciclos reversibles; restaurar el estado de dos asignados, uno elegible pendiente y uno no elegible; comprobar el despliegue hospedado y repetir allí los nueve recorridos y rendimiento; entonces realizar push normal a `dev`, sin force.
