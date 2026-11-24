# Manual de uso del motor de emparejamiento Paz y Región

Motor `pyr-matching` versión 1.0.0 (algoritmo sin cambios desde 0.3.2), algoritmo `hybrid-pyr-v0.3`, política provisional `pyr-v032-provisional-2026-11-16`. Universidad de Ibagué, programa Paz y Región. Noviembre de 2026.

## 1. Para qué sirve

El motor recibe libros Excel con estudiantes, plazas y decisiones institucionales de un semestre, y produce un libro Excel auditable con:

- las ubicaciones directas ya confirmadas por la institución (se respetan tal cual) y propuestas para las directas aprobadas que aún no tienen plaza;
- una lista de recomendaciones por estudiante para la electividad en SIGA (top 5 por defecto), con puntaje de compatibilidad, nivel de confianza y explicación en texto;
- los casos que no se pueden resolver automáticamente, con el motivo y el siguiente paso;
- el estado de cupos por plaza y una hoja de trazabilidad con versiones y huellas de los archivos usados.

El motor no aprueba casos especiales, no elige ganadores de convocatorias, no matricula estudiantes y no reemplaza la decisión de la Coordinación. Sus recomendaciones SIGA son no vinculantes: el estudiante elige.

## 2. Requisitos

| Requisito | Detalle |
|---|---|
| Sistema | Windows 10/11, macOS o Linux |
| Python | 3.10 o superior (probado con 3.14) |
| Dependencia obligatoria | `openpyxl` (se instala sola) |
| Opcional: embeddings | `sentence-transformers` y el modelo `paraphrase-multilingual-MiniLM-L12-v2` (unos 470 MB, se descarga una sola vez y corre en el equipo; no envía datos a terceros) |
| Hardware | Un portátil normal. 520 estudiantes por 370 plazas toma unos 7 s (5 s emparejar, 2 s escribir el Excel) con el respaldo semántico por defecto |
| Datos | Libros Excel ya limpios y validados por la institución, guardados en una carpeta institucional fuera de git |

En Windows, si se instala el paquete opcional de embeddings, la carpeta del proyecto debe tener una ruta corta (por ejemplo `C:\pyr\matching_engine`). Con rutas muy largas Windows no puede cargar algunas librerías y el motor vuelve automáticamente al respaldo sin dependencias, dejando la advertencia `SEMANTIC_BACKEND_UNAVAILABLE` en el resumen.

### Instalación

```bash
cd matching_engine
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[test]"
```

En Linux o macOS se usa `.venv/bin/python` en lugar de `.venv/Scripts/python`. Para comprobar la instalación:

```bash
.venv/Scripts/python -m pytest -q
```

El resultado esperado (v1.0.0) es `349 passed, 2 skipped` (las dos omitidas requieren el modelo de embeddings).

Opcional, embeddings locales:

```bash
.venv/Scripts/python -m pip install -e ".[semantic]"
.venv/Scripts/pyr-match download-model
```

## 3. Uso en un semestre, paso a paso

En los comandos, `insumo.xlsx` es el libro del semestre y `2027A` el periodo. Siempre conviene pasar la política v0.3.2, que es la recomendada:

```bash
POL=pyr_matching/config/policy_pyr_v03_provisional.json
```

Sin `--policy` el motor usa la política v0.2, que se conserva por compatibilidad.

1. **Validar los insumos.** No produce recomendaciones; solo revisa estructura, IDs y referencias.
   ```bash
   .venv/Scripts/pyr-match validate --inputs insumo.xlsx --period 2027A --policy $POL
   ```
   Si devuelve código 2, el JSON impreso lista los bloqueantes (por ejemplo `ID_DUPLICADO` en la hoja `Plazas`, fila 14). Se corrigen en el Excel y se repite.
2. **Ejecutar el emparejamiento.**
   ```bash
   .venv/Scripts/pyr-match match --inputs insumo.xlsx --period 2027A --policy $POL --out resultados_2027A.xlsx --json-out resultados_2027A.json
   ```
   La consola muestra un resumen: confirmadas, propuestas, casos para gestión humana, pendientes y cuántos electivos recibieron recomendaciones.
3. **Revisar el resultado.** Abrir `resultados_2027A.xlsx` por la hoja `Resumen_Ejecucion` y luego `Diccionario_Salida`. Las propuestas directas (`PROPUESTA_REQUIERE_APROBACION`) deben aprobarse o ajustarse por la Coordinación.
4. **Publicar recomendaciones** a los estudiantes, si la Coordinación lo decide, desde la hoja `Recomendaciones_SIGA`.
5. **Conciliar con SIGA** después de las matrículas reales:
   ```bash
   .venv/Scripts/pyr-match reconcile --inputs insumo.xlsx --period 2027A --enrollments siga_2027A.xlsx --previous-output resultados_2027A.xlsx --out conciliacion_2027A.xlsx
   ```
6. **Recoger revisiones expertas** para entrenar el motor (sección 8).

Opciones útiles de `match`:

| Opción | Efecto |
|---|---|
| `--inputs a.xlsx b.xlsx` | Varias fuentes; cada hoja se busca por nombre |
| `--mapping mi_mapeo.json` | Adapta encabezados institucionales distintos sin tocar código |
| `--semantic sentence-transformers` | Usa embeddings locales (si están instalados) |
| `--simulate` | Agrega una asignación global hipotética, no vinculante |
| `--pairs none\|top\|all` | Cuánto detalle de parejas exportar en `Pares_Evaluados` |
| `--registry carpeta` | Usa el modelo supervisado activo del registro (sección 8) |

Para probar sin datos reales: `pyr-match make-sample --out ejemplo.xlsx` genera un libro sintético de 15 estudiantes y 8 plazas que se puede verificar a mano (ver `docs/DEMO.md`).

## 4. Qué entra

Un libro (o varios) con estas hojas. Los encabezados no distinguen mayúsculas, tildes ni espacios, y las uniones se hacen solo por ID.

| Hoja | Obligatoria | Columnas principales |
|---|---|---|
| `Estudiantes` | sí | `ID_Estudiante`, `Periodo`, `Programa` (obligatorias); `Municipio_Origen`, `Habilitado`, `Expectativas`, `Aprendizajes_Esperados`, `Habilidades`, `Intereses`, `Trabajo_Deseado`, `Modalidad_Preferida` |
| `Plazas` | sí | `ID_Plaza`, `Periodo`, `Cupos`, `Estado`, `Tipo_Plaza` (obligatorias); `Perfil_Programa`, `Perfil_Programa_Alterno`, `Municipio`, `Modalidad`, `Nombre_Proyecto`, `Descripcion_Proyecto`, `Linea_Proyecto`, `Actividades`, `Requisitos`, `Necesidades_Organizacion`, datos de organización |
| `Decisiones_Directas` | no | `ID_Estudiante`, `Periodo`, `Tipo_Directa` (Caso especial, Municipio de origen, Convocatoria), `Estado_Aprobacion` (Aprobado, Pendiente, Rechazado), `ID_Plaza_Confirmada`, `Ubicacion_Confirmada`, `Municipio_Aprobado`, `Modalidades_Aprobadas` |
| `Matriculas_SIGA` | no | `ID_Estudiante`, `ID_Plaza`, `Periodo`, `Estado` |
| `Etiquetas` | solo `train` | `ID_Estudiante`, `ID_Plaza`, `Periodo`, `Etiqueta` (0 a 1), `Fuente_Etiqueta` |

### Cómo se registran las plazas

En el Tablero Maestro cada fila de `Proyectos` es **un cupo para un perfil**. Cuando una organización pide varios estudiantes (el formulario de convocatoria pregunta "Número de Estudiantes Requeridos"), el proyecto se repite en varias filas, aunque sea la misma carrera. En 2026B, por ejemplo, la Fiscalía tiene tres filas de Derecho para el mismo proyecto y el Consultorio Jurídico ocho filas de Derecho, una por área. Por eso, al preparar el libro del motor:

- una fila de `Proyectos` = una fila de `Plazas`, con `Cupos = 1` y un `ID_Plaza` propio (por ejemplo `2027A-0001`, `2027A-0002`...);
- la columna `Aprobados` del Tablero **no** es un número de cupos: trae el programa del estudiante aprobado en esa fila. Para el histórico se usa `capacity_mode = row_count`; si se intenta `approved_column`, el motor avisa con `APROBADOS_NO_NUMERICO`;
- `GRUPO SIGA` agrupa filas de una misma organización para SIGA; no reemplaza a la fila como unidad.

Reglas que conviene conocer:

- Un campo vacío significa "desconocido", no cero. Un estudiante sin `Expectativas` no es penalizado; su puntaje se calcula con la evidencia disponible y su confianza baja.
- `Tipo_Plaza` decide el flujo: solo las plazas `Normal` aprobadas se recomiendan en SIGA. Las de municipio de origen, caso especial y convocatoria se usan para directas.
- Una directa sin `Estado_Aprobacion` queda como `PENDIENTE_APROBACION_INSTITUCIONAL`. El motor nunca la asume aprobada.
- Una plaza sin perfil de programa queda bloqueada para recomendación (política `missing_vacancy_profile = block`).
- No se deben incluir justificaciones de casos especiales, diagnósticos, datos de salud ni documentos de identidad. El mapeo rechaza columnas sensibles.

El detalle completo de columnas y valores permitidos está en `docs/EXCEL_CONTRACT.md`.

## 5. Restricciones obligatorias

Las restricciones son lo más importante del motor: se aplican **antes** de calcular cualquier puntaje, y una pareja que no las cumple nunca aparece como recomendación ni como propuesta. Cada una es configurable en la política, y cuando el dato que necesita no existe, la pareja se bloquea con un código `*_NO_VERIFICABLE`. El motor nunca adivina un dato que falta.

| Regla | Qué exige | Código si falla |
|---|---|---|
| Periodo | La plaza es del periodo que se ejecuta | `PERIODO_DISTINTO` |
| Habilitación | El estudiante está habilitado | `ESTUDIANTE_NO_HABILITADO` |
| Estado de la plaza | Estado permitido por la política (hoy `Aprobada`) | `PLAZA_NO_APROBADA` |
| Tipo de plaza y flujo | SIGA solo plazas `Normal`; cada tipo de directa solo sus tipos de plaza | `TIPO_PLAZA_NO_HABILITADO` |
| Perfil de programa | El programa del estudiante está en `Perfil` o `Perfil (alternativo)` | `PROGRAMA_NO_COMPATIBLE`, `PROGRAMA_NO_VERIFICABLE`, `PERFIL_PLAZA_NO_VERIFICABLE` |
| Municipio aprobado | En directas con municipio aprobado, la plaza está en ese municipio | `MUNICIPIO_RESTRINGIDO`, `MUNICIPIO_NO_VERIFICABLE` |
| Modalidad aprobada | La modalidad de la plaza está entre las aprobadas | `MODALIDAD_RESTRINGIDA`, `MODALIDAD_NO_VERIFICABLE` |
| Cupo | Quedan cupos después de confirmadas, matrículas SIGA y propuestas | `SIN_CUPO` |
| Convocatorias | Nunca las resuelve el motor: requieren la plaza seleccionada por la institución | `CONVOCATORIA_SIN_PLAZA_SELECCIONADA` |

### Nombres de programa

El nombre del programa no se escribe igual en todas las fuentes: el Tablero dice `Ingeniería Sistemas` y `Contaduría`, la página oficial dice `Ingeniería de Sistemas` y `Contaduría Pública`, y en 2026B un perfil dice `Administración de Emrpresas`. Una comparación literal excluiría estudiantes por error. Desde la versión 0.3.2, antes de aplicar la regla de perfil, cada nombre se reconcilia con el catálogo oficial de la Universidad (17 programas actuales más Administración Financiera, Ciencia Política y Fisioterapia UAM):

- se ignoran tildes, mayúsculas, espacios y conectores (*de, en, y*);
- se aplican alias conocidos (`Contaduría` → Contaduría Pública);
- se corrige **un solo** error de digitación en una sola palabra (`Emrpresas` → Empresas). Una diferencia mayor no se corrige: "Ingeniería Eléctrica" nunca se convierte en Electrónica;
- una celda con varios programas (`Psicología / Derecho`) cuenta cada uno.

Todo lo que no fue exacto queda en la hoja `Normalizacion_Programas` y en las advertencias `PROGRAMA_CORREGIDO_APROX` y `PROGRAMA_NO_RECONOCIDO`, para que la Coordinación corrija la fuente. El catálogo y sus alias están en `docs/PROGRAMAS_UNIBAGUE.md`.

### Datos pendientes

Valores como `PENDIENTE`, `PENDIENTE NOMBRE PROYECTO`, `N/A` o `#REF!` se tratan como **vacíos**, nunca como un municipio o un programa real. Si el dato pendiente era una restricción aprobada (por ejemplo, el municipio aprobado de una directa), la pareja se bloquea y el caso va a gestión humana (`MUNICIPIO_APROBADO_FALTANTE`). Una restricción pendiente nunca se salta. La advertencia `VALOR_PENDIENTE_COMO_DESCONOCIDO` dice cuántas celdas había en cada columna.

### Doble verificación

Al terminar cada ejecución, la hoja `Auditoria_Restricciones` vuelve a comprobar desde los insumos cada fila que produjo el motor, con dos implementaciones distintas de las reglas: la del motor y un verificador escrito por separado. También revisa que los rangos de cada estudiante sean consecutivos y que ninguna plaza se le recomiende dos veces. Si cualquiera de las dos encuentra una violación en filas del motor, la ejecución se detiene en lugar de entregar un resultado. Los conflictos que ya venían en decisiones institucionales (sobrecupos o ubicaciones fuera de perfil confirmadas por la institución) se reportan como `HISTORICO_INSTITUCIONAL` y no se modifican.

## 6. Qué sale

| Hoja | ¿Es una asignación real? | Para qué se usa |
|---|---|---|
| `Resumen_Ejecucion` | no | Versiones, política y su huella, respaldo semántico, conteos, coberturas, advertencias, SHA-256 de los insumos |
| `Asignaciones_Directas` | `CONFIRMADA_FIJA` sí; `PROPUESTA_REQUIERE_APROBACION` no | Directas confirmadas (congeladas) y propuestas del optimizador |
| `Recomendaciones_SIGA` | no | Top 5 por estudiante con `rango`, `compatibilidad`, `confianza_evidencia`, `explicacion` |
| `Sin_Asignacion` | no | Casos con `codigo_motivo` y `siguiente_paso` |
| `Plazas_Disponibles` | no | Cupos originales, ocupados, reservados y restantes |
| `Idoneidad_Por_Plaza` | no | Los 10 estudiantes electivos más compatibles con cada plaza (informativo) |
| `Pares_Evaluados` | no | Puntaje por componente, pesos efectivos y bloqueos de cada pareja |
| `Auditoria_Restricciones` | no | Conflictos ya presentes en decisiones institucionales frente a violaciones del motor (estas siempre son 0), con doble verificación |
| `Normalizacion_Programas` | no | Nombres de programa que no coincidían exactamente con el catálogo y cómo se reconciliaron |
| `Diccionario_Salida` | no | Significado y valores de cada columna |

### Cómo leer un puntaje

`compatibilidad` va de 0 a 100 y combina estos componentes con pesos provisionales:

| Componente | Peso | Qué compara |
|---|---|---|
| `program` | 25 | Programa del estudiante con perfil o perfil alterno de la plaza |
| `occupational` | 15 | Campo profesional: la mejor rama del perfil ocupacional oficial del programa frente al proyecto. Solo para estudiantes sin texto profesional |
| `semantic` | 25 | Expectativas y aprendizajes esperados con nombre, línea, descripción y actividades del proyecto |
| `requirements` | 10 | Habilidades con requisitos y necesidades de la organización |
| `interests` | 5 | Intereses y trabajo deseado con el proyecto |
| `lexical` | 5 | Coincidencia literal de palabras en todo el texto profesional |
| `location` | 10 | Municipio de origen con municipio de la plaza (informativo) |
| `modality` | 5 | Modalidad preferida con modalidad de la plaza |
| `historical` | 0 | Señal experimental de comportamiento histórico, apagada |

El componente `occupational` usa las ramas de cada carrera tomadas de su página oficial (por ejemplo, Ingeniería de Sistemas: desarrollo de software, arquitectura de software, gestión de proyectos TI, redes y nube, consultoría TI y emprendimiento tecnológico). Toma la mejor rama, así que un proyecto de redes cuenta para Sistemas tanto como uno de software, y ningún programa amplio queda en desventaja. Es blando: nunca bloquea. Solo se usa cuando el estudiante no escribió expectativas, intereses ni habilidades, porque en las pruebas, cuando sí había texto, lo que el estudiante dijo ordenaba mejor que el perfil general de la carrera (sección 10).

Los componentes sin evidencia se excluyen y los pesos se renormalizan. `confianza_evidencia` dice cuánta evidencia hubo: ALTA si existe al menos el 70 % del peso configurado, MEDIA desde 40 %, BAJA por debajo. Un puntaje alto con confianza BAJA no indica una buena pareja; la explicación lo advierte.

Las restricciones obligatorias (estado de la plaza, tipo de plaza, programa, municipio y modalidad aprobados, cupo) se aplican antes del puntaje. Una pareja bloqueada nunca recibe puntaje ni aparece como recomendación.

### Códigos de salida de la consola

| Código | Significado |
|---|---|
| 0 | Ejecución correcta |
| 2 | Error de validación o de mapeo de encabezados |
| 3 | No hay datos suficientes para entrenar |
| 4 | Activación de modelo rechazada por incompatibilidad o falta de aprobador |
| 1 | Error inesperado |

## 7. Configuración

Toda la configuración está en archivos JSON versionados dentro de `pyr_matching/config/`. Cualquier cambio en la política cambia su huella, queda registrado en cada ejecución e invalida los modelos entrenados con la política anterior.

| Archivo | Uso |
|---|---|
| `policy_pyr_v03_provisional.json` | Política recomendada v0.3.2: pesos, umbral (50), top K (5), reglas duras, respaldo semántico, parámetros de entrenamiento |
| `policy_pyr_provisional.json` | Política v0.2 (compatibilidad) |
| `mapping_canonical.json` | Encabezados canónicos |
| `mapping_tablero_2026b_EJEMPLO.json` | Ejemplo de mapeo para el Tablero institucional |
| `historical_sources_tablero.json` | Fuentes para reconstruir el histórico |

Los pesos y el umbral son valores provisionales de ingeniería. La Coordinación debe aprobarlos o ajustarlos (decisiones pendientes en `docs/POLICY_DECISIONS.md`). Para cambiarlos se copia la política, se edita y se pasa con `--policy`; el motor valida que los pesos sumen 100.

### Respaldo semántico

La comparación de textos puede hacerse de tres formas. Se elige con `semantic.backend` en la política o con `--semantic` en la consola.

| Respaldo | Dependencias | Cuándo usarlo |
|---|---|---|
| `tfidf-conceptos` (predeterminado en v0.3.1) | ninguna | Uso normal. Combina palabras con un léxico de 51 áreas temáticas de PyR (infancia, agro, víctimas, agua, emprendimiento, redes, logística, comercio exterior, urbanismo, etc.) para reconocer paráfrasis |
| `sentence-transformers` | paquete opcional y modelo local | Cuando se pueda instalar: fue el mejor en textos nuevos (sección 10). Si falla, el motor vuelve a `tfidf-conceptos` y lo deja escrito en el resumen |
| `tfidf` | ninguna | Solo palabras literales. Se conserva para comparar y por compatibilidad con v0.2 |

El léxico vive en `pyr_matching/semantic_lexicon.py`. Para agregar un tema o sinónimo se edita ese archivo siguiendo sus reglas (prefijos de al menos 4 letras, frases con espacio, nada de atributos personales sensibles), se sube `LEXICON_VERSION` y se corre `python benchmarks/semantic_benchmark.py` para verificar que el conjunto reservado no empeore. `semantic.concept_weight` (0 a 1, por defecto 0,5) controla cuánto pesan los conceptos frente a las palabras.

## 8. Cómo entrenar más el motor

Hoy el motor no está entrenado con resultados de PyR: funciona con la línea base explicable de la sección 6. Puede aprender de dos maneras, que se mantienen separadas.

| Pista | Qué aprende | Fuente | Estado |
|---|---|---|---|
| A, comportamiento histórico | Qué plazas tendían a elegir estudiantes parecidos | Asignaciones SIGA de 2025A a 2026B | Experimental, peso 0. No mide idoneidad |
| B, idoneidad supervisada | Qué parejas estudiante y plaza juzga buenas la institución | Revisiones expertas aprobadas | Lista para usar; faltan etiquetas reales |

Solo la pista B puede cambiar las recomendaciones. Una asignación histórica o una matrícula SIGA no se acepta como etiqueta de idoneidad: refleja orden de llegada, cupos disponibles y decisiones forzadas, no si la pareja era buena. El comando las rechaza.

### Ciclo de entrenamiento (pista B)

1. **Generar la plantilla de revisión** después de correr el semestre:
   ```bash
   .venv/Scripts/pyr-match feedback-template --inputs insumo_2027A.xlsx --period 2027A --policy $POL --out D:/pyr_privado/revision_2027A.xlsx --blind --explore 2
   ```
   `--blind` oculta puntaje, explicación y rango, y desordena las filas, para que el revisor no se deje llevar por lo que opinó el motor. `--explore 2` agrega dos plazas elegibles no recomendadas por estudiante; sin ellas el modelo solo ve las opciones que el motor ya consideraba buenas y no aprende qué hace débil a una pareja.
2. **Revisar.** Revisores autorizados califican `evaluacion_idoneidad` de 1 a 5 (o `NO_EVALUABLE`) con un código seudónimo en `id_revisor`. Un aprobador distinto marca `estado_aprobacion = APROBADA` y llena `aprobado_por`. No se modifican las columnas de identificación ni se escriben datos personales en comentarios.
3. **Importar.**
   ```bash
   .venv/Scripts/pyr-match feedback-import --files D:/pyr_privado/revision_2027A.xlsx --store D:/pyr_privado/retro
   ```
   Cada importación crea una versión inmutable con huella. Se rechazan y cuentan: filas no aprobadas, filas alteradas, sin revisor o aprobador, aprobador igual al revisor, valores fuera de escala y `NO_EVALUABLE`. Si varios revisores califican la misma pareja se promedian y se marca el desacuerdo. Los comentarios nunca se guardan.
4. **Reentrenar** cuando haya al menos dos periodos revisados:
   ```bash
   .venv/Scripts/pyr-match retrain --inputs D:/pyr_privado/insumos_2027A_2027B.xlsx --period 2027B --policy $POL --feedback-store D:/pyr_privado/retro --registry D:/pyr_registro --report-out D:/pyr_privado/reentreno.json
   ```
   El libro de `--inputs` debe contener los estudiantes y plazas de todos los periodos revisados. El último periodo se reserva como prueba. El reentrenamiento nunca activa el modelo.
5. **Revisar el informe** (`reentreno.json`): estado, métricas frente a la línea base, compuertas que falló y subgrupos.
6. **Activar**, solo si el estado es `PROMOVIBLE` y la Coordinación lo aprueba:
   ```bash
   .venv/Scripts/pyr-match registry --registry D:/pyr_registro activate --model-id <id> --policy $POL --approved-by "Coordinación PyR" --reason "piloto 2028A"
   ```
7. **Usar** el modelo con `match --registry D:/pyr_registro`. El resumen muestra `version_algoritmo = hybrid-pyr-v0.3+<id>`.
8. **Revertir** si algo sale mal: `registry ... rollback` vuelve al modelo anterior y `registry ... rollback-to-baseline` vuelve a la línea base.

### Requisitos para entrenar

| Requisito | Mínimo de la política | Recomendado según la simulación (sección 10) |
|---|---|---|
| Parejas revisadas utilizables | 200 | 800 o más (unos 50 estudiantes por periodo con `--explore 2`) |
| Parejas positivas (nota 3 o más) | 20 | Que haya positivas y negativas en todos los periodos |
| Periodos con revisiones | 2 | 3 o más; el último queda como prueba |
| Parejas en el periodo de prueba | 40 | 150 o más |
| Tamaño de subgrupo para la compuerta de equidad | 30 parejas y 5 de cada clase | Subgrupos por programa y municipio con al menos 30 parejas |

Si falta algo, `retrain` termina con código 3 y explica el motivo (`POCAS_ETIQUETAS`, `POCOS_POSITIVOS`, `POCOS_PERIODOS`, `UNA_SOLA_CLASE_EN_PRUEBA`, etc.).

Características que deben tener las revisiones:

- Revisores que conozcan el programa académico y el territorio, con un código seudónimo estable por persona.
- Modo ciego y exploración activados (`--blind --explore 2`).
- Al menos dos revisores en una muestra de parejas (por ejemplo, 10 %) para medir el desacuerdo.
- Revisiones de varios programas y municipios, no de uno solo, para que la compuerta de equidad pueda evaluarse.
- Juicios de idoneidad formativa y profesional, no de "a dónde fue el estudiante".
- Más y mejores textos de los estudiantes: desde 2027 conviene recoger `Habilidades`, `Intereses`, `Trabajo_Deseado` y `Modalidad_Preferida`. Más evidencia sube la confianza de la línea base y da al modelo información que hoy no existe.

### Compuertas de promoción

Un modelo candidato queda `PROMOVIBLE` solo si cumple todas:

| Compuerta | Estado si falla |
|---|---|
| AUC en prueba mayor que el de la línea base | `RECHAZADO_NO_SUPERA_LINEA_BASE` |
| Mejor que el modelo activo, si lo hay | `RECHAZADO_NO_SUPERA_MODELO_ACTIVO` |
| Ordena las opciones de cada estudiante al menos tan bien como la línea base (NDCG graduado @3), nuevo en v0.3.1 | `RECHAZADO_EMPEORA_ORDEN_POR_ESTUDIANTE` |
| Ningún subgrupo de programa o municipio con tamaño suficiente pierde más de 0,10 de AUC | `RECHAZADO_DEGRADA_SUBGRUPO` |
| Al menos 40 parejas en el periodo de prueba | `RECHAZADO_PRUEBA_INSUFICIENTE` |

Los subgrupos demasiado pequeños para evaluarse se listan en `paso_5_subgrupos_no_evaluables_por_tamano` y deben revisarse a mano antes de activar.

### Pista A (experimental)

```bash
.venv/Scripts/pyr-match historical-build --manifest D:/pyr_privado/manifest.json --out-dir D:/pyr_privado/historico
.venv/Scripts/pyr-match evaluate-historical --dataset D:/pyr_privado/historico/historico_canonico.json --out-dir D:/pyr_privado/evaluacion
.venv/Scripts/pyr-match train-behavior --dataset D:/pyr_privado/historico/historico_canonico.json --registry D:/pyr_registro_comportamiento
```

`historical-build` seudonimiza con una clave HMAC (`PYR_PSEUDONYM_KEY` o `--pseudonym-key-file`) que debe custodiar la oficina de protección de datos. Sus métricas miden coincidencia con decisiones pasadas, no calidad. Antes de usarla deben resolverse con la institución el significado de la columna `Aprobados`, si una fila de `Proyectos` es un cupo y cómo se mapean los estados de aprobación (ver `docs/HISTORICAL_DATA.md`).

## 9. Integración con la plataforma

```python
from pyr_matching import match_files
res = match_files(["insumo.xlsx"], "2027A", output="resultados.xlsx")
payload = res.to_json_dict()   # schema_version = "pyr-match-result/1.0"
```

También existe un contrato JSON de entrada (`pyr-match-request/1.0`) con `pyr-match match-json` o `pyr_matching.api.match_request`. Los campos desconocidos o sensibles se rechazan. Detalles en `docs/INTEGRATION.md` y un ejemplo en `examples/request_example.json`.

Desde la v1.0.0 también hay una API HTTP (`pyr-match serve`) para que otra aplicación suba el Excel y reciba el libro de resultados: ver `docs/DESPLIEGUE_Y_API.md`. Requisitos de equipo y servidor: `docs/REQUISITOS.md`.

## 10. Pruebas y resultados (versiones 0.3.1 y 0.3.2)

Todas las pruebas usan datos sintéticos. Indican que el motor y su ciclo de entrenamiento funcionan; no demuestran calidad sobre datos reales de PyR, que debe medirse con revisiones expertas.

### Prueba de punta a punta

Se ejecutaron en orden `make-sample`, `validate`, `match`, `make-historical-sample`, `historical-build`, `evaluate-historical`, `train-behavior`, `feedback-template`, `feedback-import` y `retrain`. Todos terminaron con código 0 y salidas coherentes. La suite automática pasa completa (337 pruebas, 2 omitidas que requieren el modelo de embeddings).

### Comparación de textos (paráfrasis)

Cada frase de estudiante tiene un proyecto correcto escrito con otras palabras, entre 30 opciones. El conjunto de desarrollo se usó para construir el léxico; el conjunto reservado se escribió antes del léxico y no se usó para ajustarlo.

| Respaldo | Desarrollo top 1 | Desarrollo MRR | Reservado top 1 | Reservado MRR |
|---|---|---|---|---|
| `tfidf` (v0.3.0) | 30 % | 0,40 | 33 % | 0,46 |
| `tfidf-conceptos` (v0.3.1) | 90 % | 0,95 | 90 % | 0,94 |
| `sentence-transformers` | 77 % | 0,86 | 97 % | 0,98 |

El mismo equipo escribió el léxico y el conjunto reservado, así que el 90 % es optimista. Los embeddings no dependen del léxico y siguen siendo la mejor opción cuando se pueden instalar.

### Simulación con verdad conocida

`benchmarks/simulacion_reentrenamiento.py` genera cinco periodos de estudiantes y plazas con temas latentes, escribe los textos con vocabulario distinto en cada lado, simula revisores (nota 1 a 5 con ruido) y corre el ciclo real de plantilla, importación y reentrenamiento.

Calidad del orden de la línea base frente a la verdad (150 estudiantes, 60 plazas):

| Respaldo | NDCG@5 | Acierto top 1 |
|---|---|---|
| `tfidf` | 0,76 | 39 % |
| `tfidf-conceptos` | 0,88 | 63 % |
| `sentence-transformers` | 0,88 | 64 % |

Reentrenamiento. Se simularon dos criterios institucionales: uno temático, parecido a los pesos provisionales, y uno territorial, en el que los revisores valoran mucho más que la plaza quede en el municipio del estudiante. Cada combinación se corrió con dos semillas; el modelo se evaluó contra la verdad en un periodo nuevo que nunca se usó para entrenar (`benchmarks/simulacion_reentrenamiento.py --seeds 2`, unos 3 minutos, reproducible).

| Criterio | Estudiantes por periodo | `--explore` | Parejas revisadas | Modelos promovibles | Acierto top 1: línea base → modelo promovido |
|---|---|---|---|---|---|
| Territorial | 20 | 0 / 2 | 211 / 311 | 1 de 2 / 2 de 2 | 75 % → 85 % y 95 % |
| Territorial | 50 | 0 / 2 | 558 / 826 | 2 de 2 / 2 de 2 | 62 % → 80 %; 66 % → 74 % (sin exploración) y 86 % (con) |
| Territorial | 100 | 0 / 2 | 1131 / 1891 | 1 de 2 / 2 de 2 | 60 % → 76 %; 52 % → 68 % y 69 % |
| Territorial | 150 | 0 / 2 | 1698 / 2850 | 2 de 2 / 2 de 2 | 49 % → 60 % (sin) y 76 % (con); 51 % → 70 % y 71 % |
| Temático | 20 a 150 | 0 y 2 | 211 a 2850 | 3 de 16 | 70 % → 62 %; 63 % → 47 %; 63 % → 57 % |

Conclusiones para quien vaya a entrenar el motor:

- Cuando el criterio de la institución difiere de los pesos provisionales, el reentrenamiento corrige el orden: 14 de 16 modelos se promovieron y todos mejoraron el acierto top 1 frente a la línea base.
- La exploración (`--explore 2`) ayuda: con exploración todos los modelos del mundo territorial fueron promovibles y aprendieron más (49 % → 76 % frente a 49 % → 60 % sin ella, con 150 estudiantes).
- Cuando los pesos provisionales ya reflejan el criterio, entrenar no aporta. Las compuertas bloquearon 13 de 16 candidatos, pero 3 pasaron y ninguno mejoró el top 1. Las compuertas reducen el riesgo, no lo eliminan.
- Por eso, antes de activar un modelo promovible: correr `match` con y sin el modelo sobre un periodo nuevo, generar la plantilla ciega con las recomendaciones de ambos y pedir a los revisores que las califiquen. Activar solo si el modelo gana en esa comparación.
- Si lo que se busca es un cambio de criterio claro y conocido (por ejemplo, dar más peso al territorio), suele ser más simple y transparente ajustar los pesos de la política con aprobación de la Coordinación que entrenar un modelo.

El JSON completo de la corrida está en la carpeta de entregables (`simulacion_reentrenamiento_resultados.json`).

### Validación con datos reales 2026B (campo profesional)

Se tomaron el nombre de proyecto y el perfil de las 277 filas de `Proyectos` 2026B que tienen proyecto definido (solo datos de organizaciones, nada personal; el archivo de trabajo se dejó fuera del repositorio). Para cada proyecto, el motor ordenó las 19 carreras por su mejor rama ocupacional y se miró en qué puesto quedaba la carrera del perfil.

| Respaldo | Carrera del perfil en 1.er lugar | Entre las 3 primeras | MRR |
|---|---|---|---|
| Al azar | 5 % | 16 % | — |
| `tfidf` | 33 % | 60 % | 0,50 |
| `tfidf-conceptos` | 43 % | 65 % | 0,57 |
| `sentence-transformers` | 33 % | 60 % | 0,51 |

Muchos proyectos son interdisciplinarios (por ejemplo, "Fortalecimiento a los procesos misionales de Comfenalco" tiene filas para Derecho, Psicología, Mecánica y Sistemas), así que "entre las 3 primeras" es la medida más justa. Las ramas y los conceptos nuevos se escribieron después de ver estos nombres de proyecto, por lo que la cifra es optimista.

En el simulador, usar el campo profesional como término fijo (peso 15) empeoró el orden (NDCG@5 de 0,873 a 0,836), porque cuando el estudiante escribe sus intereses, lo que dice ordena mejor que el perfil general de su carrera. Como respaldo, solo para estudiantes sin texto, el orden general queda igual (0,873) y el acierto top 1 sube de 61 % a 64 %; en el subgrupo sin texto, de 25 % a 36 % (22 estudiantes simulados). Por eso la política usa `occupational_mode = fallback`.

### Cambios de la versión 0.3.2

- Restricción de perfil reforzada con el catálogo de programas de la Universidad, alias y corrección de un solo error de digitación, todo reportado en `Normalizacion_Programas`.
- Valores pendientes (`PENDIENTE`, `N/A`, `#REF!`) tratados como desconocidos; una restricción pendiente bloquea, nunca se salta.
- Verificador independiente de las reglas duras en la auditoría, más control de rangos y plazas duplicadas.
- Componente `occupational` (campo profesional por ramas), en modo respaldo.
- Léxico `pyr-conceptos-es/1.1`: 12 áreas nuevas de campos profesionales (51 en total). El conjunto reservado de paráfrasis se mantiene en 90 %.
- Histórico: diagnóstico `APROBADOS_NO_NUMERICO` y recomendación de `row_count` (una fila = un cupo).
- Escritura del Excel unas 7 veces más rápida.

### Cambios de la versión 0.3.1

- Nuevo respaldo semántico `tfidf-conceptos`, predeterminado en la política v0.3.1.
- Plantilla de revisión: `--explore N` y modo ciego completo (oculta también el rango y desordena las filas).
- Compuerta nueva `RECHAZADO_EMPEORA_ORDEN_POR_ESTUDIANTE` (NDCG graduado por estudiante).
- Compuerta de subgrupos con tamaño mínimo (30 parejas, 5 por clase); los subgrupos pequeños se reportan para revisión humana.
- Simulador de reentrenamiento y conjunto reservado de paráfrasis en `benchmarks/`.
- Se probó un objetivo de entrenamiento por pares dentro de cada estudiante. Fue peor que el actual cuando el criterio institucional difiere de la política, así que se descartó.

## 11. Privacidad

- Los libros reales, el almacén de revisiones, los registros de modelos y las cachés de embeddings se guardan en carpetas institucionales fuera de git. Los comandos de histórico, evaluación y revisión experta se niegan a escribir dentro del repositorio; para `match` y `retrain` la carpeta de salida la elige quien ejecuta, y debe ser institucional.
- El motor solo usa texto profesional. No usa identidad, contacto, salud, etnia del estudiante ni justificaciones de casos especiales.
- Los embeddings corren en el equipo. `download-model` es el único paso que usa la red y no envía datos.
- Las salidas contienen IDs de estudiantes: se tratan como datos institucionales.

Más detalle en `docs/FAIRNESS_PRIVACY.md`.

## 12. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| Código 2 al validar | Columna obligatoria faltante, ID duplicado o encabezado distinto | Leer el JSON de bloqueantes; usar `--mapping` si los encabezados difieren |
| `SIN_OPCIONES_ELEGIBLES` para muchos estudiantes | Plazas sin perfil, perfiles que no coinciden con el nombre del programa o plazas no aprobadas | Revisar `Perfil_Programa` y `Estado` en `Plazas`; ver `bloqueos` en `Pares_Evaluados` |
| Confianza BAJA generalizada | Estudiantes sin `Expectativas` ni otros textos | Recoger los textos en la preinscripción |
| Advertencia `SEMANTIC_BACKEND_UNAVAILABLE` | Falta el paquete o el modelo de embeddings, o la ruta es demasiado larga en Windows | Instalar `.[semantic]`, ejecutar `download-model`, usar una ruta corta |
| `retrain` termina con código 3 | Pocas revisiones, un solo periodo o una sola clase | Ver los motivos impresos; revisar más parejas con `--explore` |
| Modelo `RECHAZADO_*` | No mejora a la línea base o perjudica a un subgrupo | Seguir con la línea base; recoger más revisiones |
| Activación rechazada (código 4) | Política distinta a la del entrenamiento, estado no promovible o sin `--approved-by` | Reentrenar con la política vigente o completar la aprobación |
| `HUELLA_NO_COINCIDE` al importar | Se editaron columnas de identificación de la plantilla | Volver a generar la plantilla y no tocar esas columnas |
| `PROGRAMA_NO_RECONOCIDO` | Un programa no está en el catálogo y difiere en más de un error de digitación | Corregir el nombre en la fuente o pedir que se agregue un alias (decisión D25) |
| `PROGRAMA_CORREGIDO_APROX` | Un nombre tenía un error de digitación y se reconcilió | Revisar la hoja `Normalizacion_Programas` y corregir la fuente |
| `VALOR_PENDIENTE_COMO_DESCONOCIDO` | Celdas con `PENDIENTE`, `N/A`, `#REF!` | Completar el dato; mientras tanto, la pareja que dependa de él queda bloqueada o sin evidencia |
| `APROBADOS_NO_NUMERICO` en el histórico | `Aprobados` trae programas, no cupos | Usar `capacity_mode = row_count` |

## 13. Documentos relacionados

| Documento | Contenido |
|---|---|
| `README.md` | Resumen e inicio rápido |
| `docs/EXCEL_CONTRACT.md` | Contrato completo de entrada y salida |
| `docs/PROGRAMAS_UNIBAGUE.md` | Catálogo de programas, alias, ramas ocupacionales y reglas de reconciliación |
| `docs/MATCHING_ENGINE_PYR.md` | Algoritmo y fases |
| `docs/POLICY_DECISIONS.md` | Decisiones pendientes de aprobación institucional |
| `docs/RETRAINING_PLAYBOOK.md` | Guía técnica de entrenamiento |
| `docs/HISTORICAL_DATA.md` | Reconstrucción del histórico |
| `docs/EVALUATION.md` | Evaluación temporal |
| `docs/INTEGRATION.md` | Contrato JSON |
| `docs/FAIRNESS_PRIVACY.md` | Datos excluidos y auditorías |
