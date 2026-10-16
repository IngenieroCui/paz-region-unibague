# Sistema de diseño

## Identidad

Tema claro con identidad Unibagué, basado en el manual 2016 y la guía `IDENTIDAD_VISUAL_UNIBAGUE_PYR.md`. Logo blanco original del sitio oficial, conservado íntegro sobre azul. El nombre del programa se presenta como texto, pendiente del conjunto gráfico oficial aprobado. Los iconos institucionales existentes se conservan en PWA/favicon. Procedencia en `public/brand/README.md`.

## Tokens

Fuente única: src/styles/tokens.css. No repetir colores en componentes.

| Token | Valor | Uso |
| --- | --- | --- |
| navy / blue / brand-blue | #003D7C | Texto fuerte, acciones, sidebar, enlaces, foco y progreso |
| gold / brand-gold | #FFCC00 | Acentos pequeños, con texto azul si se usa como superficie |
| brand-blue-dark / brand-blue-light | #002C58 / #EAF2F9 | Hover y superficies informativas de interfaz |
| background / surface | #F7F9FC / #FFFFFF | Lienzo y cards |
| cream | #F5F8FC | Ilustración conceptual |
| foreground / muted | #172B43 / #526679 | Texto |
| border / border-strong | #D8E2EC / #7B8FA3 | Separadores/campos |
| success | #176143 sobre #EAF6EF | Confirmación |
| warning | #805300 sobre #FFF4D7 | Atención |
| error | #AF293A sobre #FFF0F2 | Error |
| info | #003D7C sobre #EAF2F9 | Información |

Spacing 4–64 px, radios 6/14/18 px y pill, sombras sm/md discretas. Roboto 400/500/600/700 hospedada localmente, licencia OFL incluida; Consolas para contenido técnico. Transiciones 140/220 ms, foco visible 3 px y z-index centralizados. Reduced motion desactiva movimiento significativo. Los colores semánticos son extensiones de interfaz, no paleta oficial. Enlaces dentro de párrafos subrayados; bordes de campos con contraste de al menos 3:1.

## Componentes

Button primary/secondary/ghost + loading/disabled; IconButton requiere nombre; Card; Badge semántico; Input/Textarea/Select con label/hint/error asociados; Checkbox; SearchInput; Progress nativo acotado; Skeleton; Alert; EmptyState; ErrorState; LoadingState.

Composición: PageHeader, SectionHeader, MetricCard, QuickActionCard, Brand, Identity, Footer, Sidebar, Topbar; PublicLayout/AppShell. Links navegan, botones actúan. Success mediante Alert/Badge, sin confirmar operaciones ficticias.

## Responsive

| Ancho | Comportamiento |
| --- | --- |
| >1024 px | Sidebar fija/topbar, contenido fluido |
| 641–1024 px | Drawer compacto, cards adaptables |
| ≤640 px | Columna única donde corresponde, switch de roles en fila propia |
| 320 px mínimo | Tabla desplaza dentro de región, no página |

Media queries usan literales 640/1024/1440 reflejados en tokens; variables CSS no se interpolan en queries. 1200 px ajusta métricas. Tabla semántica con caption y región enfocada.

## Accesibilidad

Landmarks, headings, skip link, foco al contenido, título por ruta y anclas. Drawer nativo dialog/showModal: foco contenido, Escape y retorno al disparador. Targets principales ≥44 px. IDs generados para campos y descripciones asociadas. Estados con texto, no solo color.

Axe con tags WCAG 2.2 AA complementa pruebas de teclado/responsive; no certifica accesibilidad integral. Copy prudente, previews con franja permanente y fixtures identificados. No se presentan campos sensibles ni operaciones reales.

## Extensión P4 · Projects + Admin

Se conservan shell, tokens y primitivas P3. Tablas semánticas con caption, región horizontal enfocable, filtros etiquetados y paginación de 25 filas. Recarga con datos mantiene detalle y formularios montados; carga inicial presenta skeletons. Dialogs devuelven foco, admiten Escape y confirman descarte de cambios; decisiones y acciones ADMIN tienen confirmación explícita. Axe/overflow a 1440/768/320 px y recorridos de teclado verificados en P4. Capturas desktop/móvil inspeccionadas. Ver [PROJECTS_ADMIN_P4.md](PROJECTS_ADMIN_P4.md).
