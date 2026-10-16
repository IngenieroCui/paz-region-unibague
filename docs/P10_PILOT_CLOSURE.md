# P10 — Cierre del piloto controlado

16 de octubre de 2026 · Alcance maestro v0.4 · Supabase `flrdqhemgbrdclgeynpk`.

La aplicación P1–P9 se consolidó con correcciones verificadas, nueve cuentas P9
rotadas y datos ficticios conectados. **Publicada en `origin/dev`**: commit de
implementación `4add45c9ba4618c3d2d95f4bdbf0256b6c98ab6c`, confirmado por push normal,
`git ls-remote` y fetch el 16 de octubre de 2026 a las 09:02 (America/Bogota).
El comprobante verificable está en [`p10/publication.json`](p10/publication.json).
El frontend sigue siendo un piloto local controlado, sin publicación web pública.

## Correcciones e integración

- Aplicado el parche entregado tras `git apply --check`. Ficha y equipos separan
  integrantes vigentes y retirados; el historial permanece consultable.
- Capacidad activa y total registrada diferenciadas, estados traducidos y
  `1 cupo`/`2 cupos`. El proyecto TEST 1 demuestra 3 cupos activos frente a 6 históricos.
- Correo largo truncado en sidebar, con valor íntegro en `title`; navegación móvil conservada.
- Participación y ejecuciones de matching traducidas; plural de documentos corregido.
- Indicación discreta de demostración con `VITE_PYR_DEMO=true` en inicio, login y sidebar.
- `origin/dev` partía de `780a04c`, sin P7/P8/P9. Se integró conservando sus commits.
  El merge recuperaba el arranque antiguo; se restauró el router completo P1–P9.
  La pantalla antigua recibida queda conservada en `src/LegacyApp.tsx`, junto con sus assets.
- Corregido un aviso de pureza React del footer legado y habilitados puertos alternativos
  para ejecutar E2E sin reutilizar accidentalmente el servidor de otro worktree.
- La prueba SQL del último ADMIN reconoce al ADMIN P9 TEST conocido dentro de un
  savepoint revertido. No modifica roles persistidos ni relaja el control del último ADMIN.

## Seguridad de las nueve identidades P9

Auth Admin oficial `updateUserById`: nueve contraseñas aleatorias independientes,
login real de cada UUID y revocación global mediante `signOut`. No se tocaron hashes SQL,
roles ni cuentas históricas P8. Comparación anterior/posterior: **9 identidades ajenas
sin modificaciones**. Los JWT ya emitidos pueden durar hasta su expiración; la revocación
retira los refresh tokens. Evidencia sin valores: [`p10/rotation-results.json`](p10/rotation-results.json).

Distribución persistida: 4 STUDENT, 2 ADVISOR, 2 ORGANIZATION, 1 ADMIN.
El registro de contraseñas actualizado está exclusivamente en `work/p9/`, ignorado por Git,
tanto en el worktree P10 como en el repositorio principal. Nunca se imprime ni se exporta.

Las direcciones `pyrprueba.*` son ficticias y no acreditan control del buzón.
No se enviaron invitaciones ni recuperación. El frontend bloquea recuperación para estas
nueve direcciones antes de llamar a Auth. Supabase conserva signup deshabilitado,
callback local y SMTP personalizado sin configurar. Este bloqueo de interfaz no sustituye
la obligación de reemplazar las identidades antes de habilitar correo o acceso público.

## Datos TEST y escenarios finales

Se reutilizan periodo 2026B, programas TEST-SIS/TEST-MEC, municipios, tipo organizacional
y habilidad de P8. No se reasignaron estudiantes P8 ni se duplicaron catálogos.

| Identidad P9 | Escenario final |
| --- | --- |
| Estudiante 1 | Sistemas, perfil completo, habilidades/intereses/preferencias, CV privado válido, elegible, plaza Sistemas, equipo 1 con Estudiante 2, asesor individual 1 y notificaciones |
| Estudiante 2 | Mecánica, perfil completo, participación elegible, otra plaza compatible, equipo 1 y asesor individual 2 |
| Estudiante 3 | Perfil suficiente, elegible, sin asignación vigente; historial de asignación/reasignación/retiro; asesor individual 2 |
| Estudiante 4 | Participación activa sin elegibilidad; sin asignaciones |
| Organización 1 | TEST P10 Organización 1, Ibagué, proyecto 1, dos plazas activas y una histórica inactiva, convocatoria abierta, interlocutor, equipo y dos estudiantes confirmados |
| Organización 2 | TEST P10 Organización 2, Espinal, proyecto 2, plaza activa, convocatoria abierta, interlocutor y equipo con retiro histórico |
| Asesor 1 | Organización 1 y Estudiante 1 |
| Asesor 2 | Organización 2 y Estudiantes 2/3; proyecto 1 accesible por responsabilidad individual y proyecto 2 por organización |
| ADMIN | Consulta y operación de los cuatro roles, matching, asignaciones, pendientes, CSV y auditoría |

`scripts/sembrar-p10.mjs --apply` exige el proyecto único, registro P9 rotado y los nueve
UUID conocidos. Reejecutado con éxito: reutiliza sus registros TEST, conserva historial
y usa las RPC obligatorias de organizaciones, interlocutores, asesorías y asignaciones.
La elegibilidad se guarda con sesión ADMIN por el mismo flujo de la interfaz.
Los nuevos registros se localizan por `TEST P10`/`TEST-P10`, UUID de usuario y sus relaciones.
El manifiesto operativo queda ignorado en `work/p10/fixtures.json`; no contiene contraseñas.
Los documentos P10 se corrigieron al descubrir que el PDF técnico heredado era incompleto;
ahora usan `tests/fixtures/TEST-CV.pdf`, válido y sin datos personales reales.
No se añadieron matrículas, planes académicos ni módulos fuera de v0.4.

## Recorridos y comprobaciones

Las nueve identidades iniciaron sesión en navegador contra Auth/PostgREST/Storage reales.
Se revisaron navegación, formularios, datos poblados, refresco, guards, cierre de sesión,
notificaciones, documentos, equipos y asesorías independientes. Cambiar el asesor de una
organización no cambió el asesor individual del estudiante.

ADMIN ejecutó en navegador matching estructurado → optimización → confirmación →
reasignación → desasignación. Cada transición se comprobó en las tablas/eventos persistidos;
Estudiante 3 se restauró sin destino vigente. No hubo mocks en estos recorridos.

RLS niega lectura/escritura cruzada entre organizaciones y estudiantes; cada asesor ve sus
estudiantes. Las ocho cuentas no ADMIN no pueden confirmar. Documentos con signed URLs
temporales: descarga propia permitida, firma ajena y URL pública denegadas. Notificaciones
personales aisladas. Dos sesiones PostgreSQL reales verifican espera por bloqueo,
rechazo de revisión obsoleta, unicidad y capacidad; escenario restaurado al finalizar.

Sin migraciones nuevas, RESET ni ampliaciones de RLS: **45 tablas con RLS, 14 migraciones,
dos buckets privados**. Se verificó la correspondencia local/remota de versiones.
Advisor sin ERROR: permanecen los avisos existentes sobre
[22 RPC SECURITY DEFINER autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
con autorización interna probada, y
[protección de contraseñas filtradas deshabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Su activación sigue pendiente de las condiciones del plan descritas en P8.

## Pruebas y revisión visual

| Validación | Resultado |
| --- | --- |
| `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` | PASS |
| `npm test -- --maxWorkers=2` | 274 PASS, 33 archivos; incluye ficha, históricos, plazas activas/inactivas, singular e impresión |
| E2E HTTP aislados P1–P7 | 85 pruebas distintas PASS: base 30 + P4 15 adicionales + matching 2 + asesores 11 + P6B 7 + asignaciones 5 + P7 15 |
| SQL pgTAP en Supabase real | 474 aserciones PASS, ocho suites: 67/36/61/27/85/53/68/77 |
| API real con las nueve identidades | 14 comprobaciones agrupadas PASS |
| Navegador real poblado | 84 comprobaciones PASS |
| Ciclo administrativo real en navegador | 5 comprobaciones PASS |
| Concurrencia PostgreSQL real | PASS; sin creación de identidades adicionales |
| Deno check de entrypoint, engine y embeddings | PASS |
| Exportación segura, cuatro escenarios positivos/negativos | PASS |

E2E HTTP aislados y unitarias emplean simulaciones; SQL, API y navegador real son evidencia
separada. No se suman las aserciones SQL como pruebas E2E. SMTP/PKCE con buzón real y
aceptación institucional se omiten deliberadamente, sin declararlos PASS.
Los runners de API cierran su propia sesión local para no revocar simultáneamente las
sesiones del navegador durante pruebas. Las fallas iniciales de fixtures y selectores
se corrigieron y repitieron antes de registrar los resultados finales.

Revisión automática WCAG A/AA y overflow a 320/390/768/1440 px; menú móvil y foco por teclado,
formularios largos, tablas desplazables, matching y optimización poblados. Fichas A4
renderizadas e inspeccionadas. Se conserva azul `#003D7C`, amarillo `#FFCC00`, Roboto local,
logo original y superficies claras. Evidencias seleccionadas en [`p10/screens/`](p10/screens/).

## Exportación, Git y pendientes

`scripts/exportar-codigo-seguro.ps1 -Destino <ruta.zip>` exige HEAD limpio, empaqueta solamente
Git y revisa rutas/contenido, incluso ZIP anidados. Bloquea archivos locales, credenciales,
tokens/JWT y formatos privados no inspeccionables. `probar-exportacion-segura.ps1` verifica
exclusión de ignorados y rechazo de ruta versionada, secreto sintético y ZIP sensible.
`verificar-secretos-p10.mjs` revisa staged y blobs del historial nuevo sin imprimir valores.
El ZIP histórico versionado de instrucciones P9 se inspeccionó: no contiene las credenciales
del paquete distribuido que incluyó `work/`.

Rama de trabajo: `feat/p10-pilot-complete`.
Worktree: `C:\Users\SENA\Documents\Codex\2026-10-16\c-users-sena-documents-pyr2026b-paz-4\work\p10`.
Repositorio: `https://github.com/jnaveros40/paz_region_unibague`.
El comprobante de publicación registra SHA enviado, SHA leído del remoto y ascendencia de
`780a04c`/P7/P8/P9. La revisión final exacta se obtiene con `git rev-parse origin/dev` tras fetch.
El commit posterior únicamente incorpora este comprobante y no cambia el código probado.
No se publica en `main`, no se fuerza el push ni se reescribe historial.

Pendientes institucionales: buzones realmente controlados y reemplazo de cuentas ficticias;
SMTP/PKCE con correo entregable; staging HTTPS privado; aprobación de marca compuesta y
assets oficiales por Comunicaciones; validación de reglas/catálogos y aceptación con
participantes reales autorizados. Ninguno impide la demostración TEST local controlada.
