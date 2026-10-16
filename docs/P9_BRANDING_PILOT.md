# P9 — Identidad Unibagué y cuentas institucionales TEST

16 de octubre de 2026. Base P8 `c05c08d`, rama `feat/p9-unibague-brand-pilot`.
Repositorio de entrega: `C:\Users\SENA\Documents\PyR2026B\paz_region_unibague`.

## Resultado y alcance

Tema transversal azul `#003D7C` y amarillo `#FFCC00`, Roboto local,
sidebar azul, superficies claras, botones azules, estados semánticos diferenciados,
tablas y formularios con contraste, navegación móvil y fichas para impresión.
Se conserva el contrato de variables CSS existente. Sin cambios a SQL, RLS,
algoritmos, pesos de matching, asignaciones ni arquitectura.

Se corrigió el subrayado de enlaces dentro de párrafos y se añadieron encabezados
y continuidad de registro a los estados vacíos de proyectos y convocatorias.
Las nueve identidades nuevas empiezan sin datos académicos, organizaciones ni
responsabilidades asignadas; sus formularios y estados vacíos están disponibles.
Para revisar datos ya poblados se comprobaron además los fixtures P8 existentes,
sin ejecutar nuevas asignaciones ni modificar sus perfiles.
Los dos asesores TEST tienen además StaffProfiles activos, requeridos por el RPC
de asesoría existente. Se insertaron exclusivamente para estas identidades nuevas,
sin otorgarles organizaciones o estudiantes y sin cambiar políticas de acceso.

## Cuentas creadas y verificadas

Proyecto Supabase `PYRUnibague` (`flrdqhemgbrdclgeynpk`).
Auth Admin creó las identidades con contraseñas aleatorias individuales y correo
confirmado técnicamente, sin invitaciones ni envío de mensajes. Esa confirmación
no demuestra propiedad de un buzón. Nombres terminados en `(TEST)` y metadata
`pyr_test_account: true`. Los permisos proceden exclusivamente de UserRoles.

| Correo ficticio | Rol persistido |
| --- | --- |
| pyrprueba.estudiante@estudiantesunibague.edu.co | STUDENT |
| pyrprueba.estudiante2@estudiantesunibague.edu.co | STUDENT |
| pyrprueba.estudiante3@estudiantesunibague.edu.co | STUDENT |
| pyrprueba.estudiante4@estudiantesunibague.edu.co | STUDENT |
| pyrprueba.asesor@unibague.edu.co | ADVISOR |
| pyrprueba.asesor2@unibague.edu.co | ADVISOR |
| pyrprueba.entidad@unibague.edu.co | ORGANIZATION |
| pyrprueba.entidad2@unibague.edu.co | ORGANIZATION |
| pyrprueba.administrador@unibague.edu.co | ADMIN |

El script suministrado se ejecutó primero en vista previa. Su preflight consultó
Auth y evitó modificar usuarios existentes. La versión integrada añade
`--check-collisions` sin mutaciones, bloquea colisiones ajenas al registro local
y devuelve error si alguna creación queda incompleta. La provisión también crea
StaffProfiles activos para nuevos ADVISOR TEST. Se conserva el ZIP original
sin secretos en `docs/PYR_Cuentas_Pruebas_e_Identidad_Visual.zip`.

Credenciales, exclusivamente en el archivo local ignorado:
`C:\Users\SENA\Documents\PyR2026B\paz_region_unibague\work\p9\cuentas-institucionales.local.json`.
No se incluyen en capturas, informes, Git ni el paquete de evidencia.

## Cómo ingresar

Desde el repositorio: `npm run dev -- --host 127.0.0.1 --port 5173`.
Abrir `http://localhost:5173/login`, elegir una cuenta de la tabla y consultar su
contraseña en el archivo local anterior. Redirecciones únicas:
`/app/student`, `/app/advisor`, `/app/organization`, `/app/admin`.
Los tres espacios ajenos se rechazan para cada cuenta. El cambio de espacio no
concede roles adicionales. No usar recuperación por correo con estas direcciones
ficticias; requiere primero disponer de buzones autorizados.

## Marca, archivos y assets

Fuentes: guía entregada `IDENTIDAD_VISUAL_UNIBAGUE_PYR.md` y
[normograma oficial, Resolución 271 de 2016](https://www.unibague.edu.co/normatividad-institucional/normograma-funcionarios).
El normograma enlaza el [registro institucional de la resolución](https://hdl.handle.net/20.500.12313/3224).

Logo original blanco: `public/brand/unibague-original.png`, descargado de
[Paz y Región, sitio oficial](https://pazyregion.unibague.edu.co/images/2019/02/12/2019-02-12-1.png).
Se presenta completo sobre azul, sin recorte, filtro, recoloración ni deformación.
Los iconos originales ya existentes de PWA/favicon se conservan. El manifest y
meta theme-color usan azul institucional; el service worker precachea logo y fuentes.
Roboto 400/500/600/700 proviene de Google Fonts y se sirve desde `public/fonts/`;
licencia OFL incluida. No hay petición externa de fuentes durante el uso.

Archivos de diseño: los seis CSS de `src/styles/`,
`src/components/forms/paged-data.css`, `src/features/matching/matching.css`,
`src/features/projects/institutional-sheet.css`, `Brand.tsx`, `AuthPage.tsx`,
`LandingPage.tsx`, `InstitutionalSheet.tsx`, los estados vacíos en
`CallsWorkspace.tsx` y `ProjectsWorkspace.tsx`, `index.html`, `vite.config.ts`.
Tokens y uso documentados en `DESIGN_SYSTEM.md`.

**Pendiente institucional:** entregar y aprobar el conjunto gráfico completo de
Paz y Región, revisar la zona de reserva y confirmar vigencia del manual 2016,
paleta, variantes y uso público de la marca con Comunicaciones. Hasta recibirlo,
el programa se identifica con texto ordinario junto al logo original Unibagué.
No se ha inventado un isotipo del programa ni publicado el frontend en Internet.

## Validación y evidencia

| Comprobación | Resultado |
| --- | --- |
| Typecheck / lint / build / diff --check | PASS |
| Vitest | 271 PASS / 33 archivos |
| E2E existentes P1–P7, HTTP aislado | 85 PASS: 30/15/2/11/7/5/15 |
| Auth real, UserProfiles y UserRoles de las 9 cuentas | PASS |
| Navegación, guards, persistencia y logout | PASS |
| 320 / 390 / 768 / 1440 px, sin overflow global | PASS |
| WCAG A/AA automático y teclado/drawer móvil | PASS |
| Datos poblados P8: proyectos, matching, asignaciones, notificaciones y ficha | PASS |

La comprobación real registra 64 resultados PASS: incluye las nueve cuentas y
12 recorridos P8 con datos. La ficha impresa revisada cabe en una página A4.

`scripts/verify-p9-pilot.mjs` prueba Auth real y UI sin trazas ni cuerpos de red.
Usa la conexión pública de `.env.local` y el registro local de credenciales.
La variable opcional `PYR_P8_FIXTURES` habilita recorridos de consulta sobre los
datos P8 existentes. No sustituye las regresiones aisladas ni envía correo.
Los controles WCAG automáticos complementan la revisión visual; no certifican
por sí solos accesibilidad completa.

Capturas principales en `p9/screens/`; registros de resultados sin secretos en
`p9/verification.json` y `p9/e2e-results.json`. Evidencia ampliada local ignorada
en `work/p9/screens/`, incluida la ficha PDF. Se inspeccionaron las vistas
de inicio, acceso, cuatro roles, móvil y ficha impresa.

[Acceso](p9/screens/login.png) · [Administrador](p9/screens/admin-1440.png) ·
[Estudiante](p9/screens/student-1440.png) · [Organización](p9/screens/organization-1440.png) ·
[Asesor](p9/screens/advisor-1440.png) · [Móvil](p9/screens/student-390.png) ·
[Impresión](p9/screens/print-sheet-1.png).

El archivo maestro que estaba sin seguimiento en dev se conserva íntegro en
`work/p9/backups/Modelo_Datos_Paz_Region_v04.pre-p9.md`; la rama P9 incorpora
la versión del mismo documento que ya formaba parte de P8.
