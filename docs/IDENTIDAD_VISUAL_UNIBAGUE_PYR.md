# Identidad visual Unibagué para Paz y Región · base de implementación

Investigación documental: 16 de octubre de 2026. **No es una aprobación institucional para uso público del logo.**

## Fuentes consultadas

1. Universidad de Ibagué, *Manual de Identidad Visual Corporativa* (2016), Resolución 271 de 2016, citada en el normograma institucional. Texto consultable: https://es.scribd.com/document/684458702/Manual-Imagen-Institucional-Logos y referencia oficial: https://desarrolloregional.unibague.edu.co/normatividad-institucional/normograma-funcionarios
2. Universidad de Ibagué, *Uso del correo electrónico institucional y correos masivos*, código CI-LI-04, versión 01, 2022: https://sig.unibague.edu.co/documentos/comunicacion-interna-y-externa/otra-informacion-documentada-4/456-ci-li-04-uso-del-correo-electro-nico-institucional-y-los-correos-masivos/file
3. Universidad de Ibagué, sitio oficial vigente: https://www.unibague.edu.co/

## Colores corporativos (documentados en manual 2016)

| Uso | RGB institucional | Hex resultante | Pantone indicado |
| --- | --- | --- | --- |
| Azul institucional | (0, 61, 124) | `#003D7C` | 288 PC |
| Amarillo institucional | (255, 204, 0) | `#FFCC00` | 123 PC |

Estos códigos RGB son explícitos en el manual de 2016. Verificar con Promoción y Comunicación Institucional si existe un manual 2026 que los actualice antes del lanzamiento público.

### Paleta adicional de interfaz (propuesta, NO paleta institucional oficial)

| Token | Valor | Uso |
| --- | --- | --- |
| `--brand-blue` | `#003D7C` | encabezados, enlaces, botones principales |
| `--brand-gold` | `#FFCC00` | foco y acentos medidos, no texto en blanco |
| `--brand-blue-dark` | `#002C58` | hover, texto sobre superficies claras |
| `--brand-blue-light` | `#EAF2F9` | tarjetas informativas azules |
| `--surface` | `#FFFFFF` | paneles |
| `--background` | `#F7F9FC` | fondo de aplicación |
| `--border` | `#D8E2EC` | bordes |
| `--foreground` | `#172B43` | texto principal |
| `--muted` | `#526679` | texto secundario |
| `--success` | `#176143` | solo estados OK; no sustituir por amarillo |
| `--warning` | `#805300` | advertencias |
| `--error` | `#AF293A` | errores |

## Logotipo, símbolo y nombre del programa

El manual especifica un **logosímbolo** (isotipo + tipografía), no solo una letra o escudo. Utilizar un archivo institucional original sin calcarlo ni reconstruirlo con CSS/SVG. No deformar, recortar, rotar, recolorear fuera de versiones admitidas ni añadir sombras/filtros. Mantener zona de reserva: el manual habla de 2X.

**Tamaños mínimos digitales del manual:** logo horizontal sin eslogan 100 px, con eslogan 180 px; logosímbolo Unibagué 70 px; isotipo 25 px. El isotipo aislado requiere consulta a Promoción y Comunicación Institucional. Si no se tiene el asset correcto, dejar un placeholder de texto tipográfico temporal y pedir el archivo original (ideal SVG o PNG transparente suministrado por la Universidad).

**Hallazgo crucial para Paz y Región:** el manual de 2016 menciona expresamente que *Paz y Región y Ávaco son las únicas dependencias con isotipos adjuntos permitidos* y ordena mostrarlos en su totalidad; no improvisar el logo del programa ni separar sus partes. Solicitar el lockup oficial de Paz y Región al área responsable y verificar vigencia de esa excepción.

## Tipografías (manual 2016)

- Logosímbolo: **Tahoma Bold** (NO intentar reemplazar letras del logo).
- Textos complementarios y composición digital: **Roboto**, recomendada por el manual.
- Nombre de dependencias: Helvetica Neue 57 Condensed, si se usan las plantillas institucionales.
- Eslogan oficial del manual 2016: Aparajita Bold Italic, **solo como parte de pieza oficial**; no imitarlo manualmente.

Para React: usar CSS `font-family: Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif;` con fuentes licenciadas y cargadas de proveedor legítimo si procede. No distribuir archivos de fuentes extraídos del manual.

## Implementación concreta sobre P8/P9

1. Centralizar tokens en `src/styles/tokens.css`; preservar nombres consumidos (`--navy`, `--gold`, `--blue`), remapearlos a azul institucional y amarillo. El código P7 anterior usa `--navy: #0D192B`, `--gold: #FFD200`, `--blue: #0B5ED7`, que NO son los códigos exactos del manual.
2. Revisar todas las CSS de `src/styles/{global,components,workspace,public,modules}.css`, más estilos de features que tengan literales azules/amarillos propios. Reutilizar tokens, evitar sustituciones globales ciegas.
3. Sustituir identidad en login, portada, selección de rol, cabecera, sidebar, PWA manifest/favicon, tarjetas, tablas, estados y vistas imprimibles. Mantener nombres claros: “Paz y Región” como producto, “Universidad de Ibagué” como institución.
4. Comprobar contraste WCAG AA (texto al menos 4.5:1; UI al menos 3:1), tamaños táctiles, teclado, focus ring y 320–1440 px. Azul/amarillo con intención; el amarillo sirve como acento y no siempre como superficie de texto blanco.
5. No reestructurar módulos funcionales ni SQL: cambio transversal de diseño solamente. Eliminar decoraciones/ilustraciones que parezcan escudos inventados. Preservar estados de éxito/advertencia/error con semántica propia.
6. No distribuir logo institucional modificado. Identificar asset oficial en la web o solicitarlo; añadir nota para visto bueno de marca antes de publicación pública.
7. Validar print de fichas/CSV (CSV no lleva diseño) y PWA. Hacer pruebas de captura de las cuatro experiencias: estudiante, organización, asesor y administrador, además de acceso y recuperación.

## Correos de prueba y autorización

- Estudiantes, conforme a CI-LI-04 (2022): `nombre.apellido@estudiantesunibague.edu.co`, con sufijo numérico tras el apellido cuando existe coincidencia.
- Personal institucional: `nombre.apellido@unibague.edu.co`, documentado en directorios de Unibagué.
- **No determinar ADMIN/ADVISOR/ORGANIZATION por el dominio; solo distingue familia de cuenta.** La universidad determina el rol institucional y el aplicativo lo registra en `PYRUnibague_UserRoles` con autorización administrativa.
- Las direcciones `pyrprueba.*` del script son ficticias para piloto, no verifican propiedad del buzón ni permiten recuperación de contraseña sin control de ese correo. No enviar invitaciones y retirar antes de abrir el sitio a terceros.
