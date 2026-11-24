# Demo reproducible — escenario sintético verificable a mano

```bash
.venv/Scripts/pyr-match make-sample --out demo.xlsx
```
```bash
.venv/Scripts/pyr-match match --inputs demo.xlsx --period 2027A --out demo_out.xlsx --simulate --timestamp 2026-11-12T00:00:00+00:00
```
Datos 100 % inventados (`pyr_matching/fixtures.py::hand_rows`). Programas: Sistemas (SIS), Psicología (PSI), Contaduría (CON), Música.

## Plazas
| Plaza | Tipo | Municipio | Perfil (alterno) | Cupos | Nota |
|---|---|---|---|---|---|
| V01 | Normal | Ibagué | SIS | 1 | software comunitario |
| V02 | Normal | Chaparral | PSI | 2 | psicosocial |
| V03 | Normal | Ibagué | CON (SIS) | 1 | contabilidad |
| V04 | Municipio de origen | Líbano | SIS (PSI) | 1 | |
| V05 | Caso especial | Ibagué | PSI | 1 | semipresencial |
| V06 | Convocatoria | Ortega | CON | 1 | |
| V07 | Normal | Ibagué | PSI | 1 | **Cerrada** |
| V08 | Normal | Planadas | SIS | 1 | ocupada por matrícula SIGA de E10 |

## Resultado esperado (verificado por `tests/test_scenario.py`)
| Estudiante | Situación de entrada | Resultado | Por qué |
|---|---|---|---|
| E06 | Convocatoria aprobada, V06 confirmada | `CONFIRMADA_FIJA` V06 | decisión institucional congelada |
| E04 | MO aprobado, Líbano | `PROPUESTA_REQUIERE_APROBACION` V04 | única plaza en Líbano; mejor evidencia que E14 |
| E05 | CE aprobado, Ibagué + semipresencial | `PROPUESTA_REQUIERE_APROBACION` V05 | restricciones duras cumplidas |
| E14 | MO aprobado, Líbano | `REQUIERE_GESTION_HUMANA` / `CUPOS_AGOTADOS_ENTRE_DIRECTAS` | V04 tiene 1 cupo |
| E07 | CE aprobado, Mariquita | `REQUIERE_GESTION_HUMANA` / `SIN_PLAZA_COMPATIBLE…` | no se viola la restricción |
| E13 | Convocatoria aprobada sin plaza | `REQUIERE_GESTION_HUMANA` / `CONVOCATORIA_SIN_PLAZA_SELECCIONADA` | el motor no elige ganadores |
| E08 | CE pendiente | `PENDIENTE_APROBACION_INSTITUCIONAL` | |
| E15 | estado vacío | `PENDIENTE…` / `ESTADO_APROBACION_DESCONOCIDO` | nunca se asume aprobado |
| E09 | MO rechazado | electivo: V01 (1), V03 (2) | vuelve a SIGA |
| E01 | SIS | V01 (1), V03 alterno (2) | V02 bloqueada por programa |
| E02 / E03 | PSI / CON | V02 / V03 | |
| E12 | SIS sin textos | V01, V03 con **confianza BAJA** | solo evidencia de programa |
| E10 | matriculado en V08 | excluido | cupo ocupado |
| E11 | Música | `SIN_RECOMENDACION` / `SIN_OPCIONES_ELEGIBLES` | ninguna plaza con su perfil |

V01 aparece como 1.ª opción de E01, E09 y E12 aunque tiene 1 cupo: las recomendaciones **no** consumen cupos; SIGA decide por elección. `--simulate` muestra una distribución hipotética (E02→V02, E03→V03, E12→V01) marcada `SIMULACION_NO_VINCULANTE`.
