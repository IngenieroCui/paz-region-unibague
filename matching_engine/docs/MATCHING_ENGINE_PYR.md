# Algoritmo `hybrid-pyr-v0.2`

## Fases (siguen el AS-IS institucional)
1. **Validar** insumos del periodo (esquema, IDs únicos, referencias).
2. **Bloquear** lo confirmado: matrículas SIGA activas y directas con `Ubicacion_Confirmada=SI` se congelan y restan cupo. Si una confirmada viola una regla o excede cupos se **informa** (`verificacion_reglas`, `excede_cupos`), nunca se mueve.
3. **Directas aprobadas sin plaza exacta**: capa de elegibilidad determinista (tipo de plaza permitido para el tipo de directa, estado, programa, municipio/modalidad aprobados, cupo) → puntaje → **min-cost max-flow** (P6-C) sobre cupos restantes, maximizando primero cuántos casos se ubican y luego la compatibilidad. Resultado: `PROPUESTA_REQUIERE_APROBACION` o `REQUIERE_GESTION_HUMANA`. Convocatorias **nunca** se resuelven por similitud.
4. **Electividad SIGA**: solo plazas `Normal` aprobadas con cupo restante (tras confirmadas y propuestas). Top-K por estudiante, empates por ID. No consume cupos. Simulación global opcional y etiquetada.
5. **Conciliación** posterior con matrículas SIGA reales (`reconcile`).
6. **Exportación** Excel + JSON.

El optimizador nunca decide elegibilidad: recibe solo aristas que pasaron la capa dura. Un invariante final (`violaciones_restricciones_duras = 0`) audita cupos y unicidad.

## v0.3.2: restricción de perfil y campo profesional
- La regla de perfil compara programas canónicos (`pyr_matching/programs.py`): conectores, tildes, alias y un solo error de digitación se reconcilian; celdas con varios programas cuentan cada uno; `PENDIENTE`/`N/A`/`#REF!` son desconocidos. Todo lo no exacto queda en la hoja `Normalizacion_Programas`. Ver [PROGRAMAS_UNIBAGUE.md](PROGRAMAS_UNIBAGUE.md).
- La auditoría re-verifica las filas del motor con una segunda implementación de las reglas duras (`audit._second_opinion`).
- Componente `occupational` en `hybrid-pyr-v0.3` (esquema `pyr-features/2.1`): máximo, sobre las ramas del perfil ocupacional oficial del programa del estudiante, de la similitud rama ↔ proyecto. `occupational_mode = fallback` lo limita a estudiantes sin texto profesional. Pesos v0.3.2: program 25, occupational 15, semantic 25, requirements 10, interests 5, lexical 5, location 10, modality 5, historical 0.

## Componentes (0–100; vacío = desconocido)
| Componente | Peso prov. | Fuente | Cálculo |
|---|---|---|---|
| `program` | 30 | Programa vs `Perfil`/`Perfil alterno` | 100 exacto · 85 alterno · 0 otro (si la regla es `soft`) |
| `semantic` | 35 | Texto profesional estudiante vs plaza | coseno TF-IDF (por defecto) o embeddings locales × 100 |
| `lexical` | 10 | mismo texto | `textScore` de `hybrid-v0.1` (reutilizado literal) |
| `skills` | 10 | Habilidades (2027+) vs requisitos/necesidades | `textScore`; hoy siempre desconocido |
| `location` | 10 | Municipio de origen vs plaza | 100 igual · 40 distinto (**blando**, informativo) |
| `modality` | 5 | Modalidad preferida (2027+) vs plaza | 100/0 |

Total = Σ raw·peso_efectivo/100, con pesos renormalizados sobre componentes disponibles (misma regla que `hybrid-v0.1`). `cobertura_evidencia` = peso disponible / peso configurado; `confianza_evidencia` ALTA ≥ 0.7, MEDIA ≥ 0.4, BAJA. Un estudiante sin textos solo tiene evidencia de programa: su puntaje renormalizado puede ser alto **con confianza BAJA**, y la explicación lo advierte.

Texto profesional estudiante = expectativas + aprendizajes + habilidades + intereses + trabajo deseado. Plaza = nombre, línea, descripción, actividades, requisitos, necesidades. Nunca identidad, contacto, salud ni justificaciones.

## Cambios semánticos deliberados vs `hybrid-v0.1`
- `academic` (lista `is_required` de la plataforma) → `program` (perfil/perfil alterno observado en el Tablero).
- `experience`/`interests`/`preference` (campos inexistentes en las fuentes PyR) → `semantic` + `lexical`.
- `location` deja de usar preferencias ordenadas (no existen) y queda informativo; las restricciones territoriales aprobadas pasan a la capa dura.
- Nuevo `modality`; nueva capa de directas; capacidad sin consumo en electividad.
- `hybrid-v0.1` sigue disponible (`pyr_matching.hybrid_v01`) con **paridad exacta** contra el TypeScript en 160 casos dorados; P6-C en 60 casos dorados + oráculo exhaustivo (150 grafos aleatorios).

## Backends semánticos
| Backend | Dependencias | Datos fuera del equipo | Paráfrasis desarrollo (n=30) | Paráfrasis reservado (n=30) |
|---|---|---|---|---|
| `tfidf` (defecto política v0.2) | ninguna | no | top-1 0.30 · MRR 0.40 | top-1 0.33 · MRR 0.46 |
| `tfidf-conceptos` (defecto política v0.3.1) | ninguna | no | top-1 0.90 · MRR 0.95 | top-1 0.90 · MRR 0.94 |
| `sentence-transformers` `paraphrase-multilingual-MiniLM-L12-v2` | `pip install -e ".[semantic]"` | no (modelo local) | top-1 0.77 · MRR 0.86 | top-1 0.97 · MRR 0.98 |

`tfidf-conceptos` (v0.3.1) concatena el vector TF-IDF de palabras con un vector TF-IDF de conceptos temáticos (`pyr_matching/semantic_lexicon.py`, versión registrada en `backend_semantico`); con conceptos en ambos textos, similitud = (1−α)·cos_palabras + α·cos_conceptos, α = `semantic.concept_weight` (0.5, elegido solo con el conjunto de desarrollo). El conjunto reservado (`benchmarks/semantic_holdout.py`) se escribió antes del léxico y no se usó para ajustarlo; aun así lo escribió el mismo equipo, por lo que la cifra es optimista. Si los embeddings fallan, el respaldo es `semantic.fallback_backend` (`tfidf-conceptos` en v0.3.1).

Reproducir: `python benchmarks/semantic_benchmark.py --embeddings`. Es un conjunto pequeño y escrito por el equipo: indica que los embeddings capturan paráfrasis que el léxico no, **no** mide calidad en datos reales. Las escalas difieren (embeddings dan cosenos más altos), por lo que el umbral depende del backend (decisión D3). Si el paquete/modelo falta, el motor cae a TF-IDF y lo registra como advertencia `SEMANTIC_BACKEND_UNAVAILABLE`.

## Rendimiento (sintético, Windows, Python 3.14, TF-IDF)
520 estudiantes × 370 plazas (tamaño similar a 2026B): ~8 s por defecto; ~21 s con `--simulate` (min-cost flow sobre ~35 k aristas).

## Estado de entrenamiento
**No entrenado.** Ningún componente se ajustó con resultados de PyR. Ver `RETRAINING_PLAYBOOK.md`.
