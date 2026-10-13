# Paz y Región · Modelo de datos maestro v0.4
**Estado P7:** alcance v0.4 implementado en migraciones 001–012; validación contra Supabase real pendiente. 13 de octubre de 2026.

Este documento conserva el diccionario original como referencia de alcance: las etiquetas «Propuesto» describen su situación antes de P6. Las 12 tablas propuestas están implementadas en 008–010. El esquema SQL integrado, DATABASE_CONTRACT.md y P7_OPERATIONAL_HANDOFF.md describen el estado vigente. La copia original sin seguimiento en dev permanece intacta.

> **Referencia histórica anterior a P6:** 33 tablas ya existen en las migraciones del repositorio P2–P5; **12 tablas adicionales están solo propuestas**. No se han aplicado migraciones nuevas ni se ha validado el despliegue en un Supabase real. Las instrucciones de v0.4 prevalecen sobre el diseño v0.3 en las funciones retiradas.

## 1. Cambios de alcance solicitados
1. **Matrícula: FUERA.** No almacenar estado, fecha, comprobante, documento ni importación de matrícula; corresponde a otra dependencia universitaria. La tabla existente `StudentPeriodParticipations` se mantiene exclusivamente para periodo, elegibilidad y estado de participación propio de Paz y Región, sin valores relacionados con matrícula.
2. **Plan de acción, objetivos, cronograma, actividades, entregas, diario y Comprensión del Entorno: FUERA.** Los estudiantes los gestionan fuera de esta plataforma en Drive. No proponer tablas, carga de archivos ni integración automática Drive.
3. **Asesores: asignación manual a organizaciones y por periodo.** Sin algoritmos de zonas o comunas. Máximo un asesor vigente por organización/periodo. Asesor del estudiante independiente y con historial, para evitar cambios masivos involuntarios.
4. **Proyectos: ficha básica**, proyecto + ubicación municipio + zona rural/urbana + institución(es) + interlocutor + periodo + asesor + equipo. La mayoría se obtienen de relaciones existentes. Solo `Projects.zone_type` necesita campo adicional de los listados.
5. **Interlocutores:** varios por organización. Uno principal administrativo; el operativo del proyecto puede ser distinto.
6. **Docente técnico:** opcional. ARL: solo nombre opcional en la participación por periodo, editable por personal autorizado, sin documentos ni auto-reporte exigido.
7. **Convocatorias:** publican plazas diferenciadas por perfiles y cupos. Matching es recomendación, asignación es un acto administrativo posterior.

## 2. Ficha del proyecto: dónde vive cada dato
| Campo visible | Fuente del dato / clave | Observación |
|---|---|---|
| Nombre del Proyecto | `Projects.name` | Existente |
| Ubicación | `Projects.municipality_id → Municipalities` | Existente; ej. El Espinal, Tolima |
| Zona del proyecto | `Projects.zone_type` | **Columna propuesta** rural/urbana; NO zona de asesoría |
| Instituciones participantes | `Projects.organization_id → Organizations` y opcional `ProjectParticipatingOrganizations` | Entidad titular existente; otras instituciones solo si aplica |
| Nombre y apellido del interlocutor | `ProjectInterlocutors → OrganizationContacts.full_name` | Interlocutor operativo elegido para proyecto |
| Semestre académico | `Projects.academic_period_id → AcademicPeriods.code` | Existente |
| Asesor Regional | `Projects.organization_id + academic_period_id → AdvisorOrganizationAssignments → StaffProfiles → UserProfiles` | Derivado de asignación MANUAL; no repetir texto en Projects |
| Equipo Paz y Región | `Projects → Groups → GroupMembers → Assignments → Students → AcademicPrograms` | Nombre y carrera obtenidos de relaciones; sin lista de nombres en una columna |
| Docente técnico | `ProjectTechnicalTeachers` | Opcional, sin registro cuando no haya docente |
| ARL de estudiante | `StudentPeriodParticipations.arl_provider_name` | Propuesta; solo nombre de entidad, si Universidad lo proporciona |

## 3. Ejemplo de funcionamiento: SENA / Tecnoparque
- Organización titular: SENA. Puede tener múltiples proyectos en un mismo periodo.
- Proyecto de desarrollo de software: tiene nombre, ubicación, zona Rural y un interlocutor operativo distinto al contacto principal de la organización, si así se registra.
- El asesor regional de ese semestre se asocia **manualmente** a la organización. Si cambia, no se sobrescribe el historial del asesor del estudiante.
- Proyecto con estudiantes de Sistemas: se arma su equipo desde asignaciones reales, sin guardar nombres de estudiantes en texto libre.
- Si hay otro proyecto de Mecánica/Electrónica, conserva su identidad, cupos y equipo aunque sea la misma institución.
- Las propuestas de planes de acción, cronogramas y entregables permanecen fuera del sistema, en Drive.

## 4. Arquitectura de asesorías
`UserProfiles` + `UserRoles` + `StaffProfiles` permite rol coordinador, asesor regional y docente técnico opcional.

**Relaciones críticas:**
1. `AdvisorOrganizationAssignments(advisor_id, organization_id, academic_period_id, starts_on, ends_on, is_current, assigned_by, ...)` — **carga manual**, un asesor vigente por organización/periodo.
2. `AdvisorStudentAssignments(advisor_id, participation_id, starts_on, ends_on, is_current, source_assignment_id, reason, ...)` — separado, con historial propio.
3. Al confirmar asignación estudiante–proyecto, sugerir/cargar asesor de la organización en ese momento. El administrador puede corregirlo por estudiante; nunca propagar cambios posteriores en cascada.
4. No crear `Territories` ni `AdvisorTerritoryAssignments`; el municipio del proyecto se conserva solo como información de ubicación/matching, NO como regla automática de asesor.

## 5. Convocatorias y cupos
Ejemplo de una convocatoria con **2 cupos para Sistemas y 1 para otra carrera**:
1. `Calls`: una convocatoria por organización y periodo.
2. `ProjectPositions`: una plaza/perfil Sistemas con `capacity=2` y otra plaza/perfil de otra carrera con `capacity=1`, asociadas al proyecto apropiado.
3. `ProjectPositionPrograms`: los programas compatibles en cada plaza. No confundir varias carreras compatibles con una misma plaza con cantidades diferentes por carrera.
4. `CallPositions`: vincula convocatoria y esas dos plazas; no duplica capacidad.
5. `Assignments`: consume los cupos de plaza cuando se confirman; matching no asigna por sí solo.

## 6. Inventario completo
### Acceso y roles
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_UserProfiles` | Existente | Identidad no sensible vinculada a auth.users |
| `PYRUnibague_Roles` | Existente | Catálogo roles del sistema |
| `PYRUnibague_UserRoles` | Existente | Roles de un usuario |

### Académico y catálogos
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_AcademicPeriods` | Existente | Semestres académicos |
| `PYRUnibague_AcademicPrograms` | Existente | Programas universitarios |
| `PYRUnibague_Municipalities` | Existente | Territorios y código municipal |
| `PYRUnibague_OrganizationTypes` | Existente | Clasificación de organizaciones |
| `PYRUnibague_Skills` | Existente | Catálogo de habilidades |

### Operación transversal
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_SystemConfigurations` | Existente | Configuración institucional |
| `PYRUnibague_FeatureFlags` | Existente | Activación de capacidades |
| `PYRUnibague_Notifications` | Existente | Avisos al usuario |
| `PYRUnibague_AuditLogs` | Existente | Auditoría de cambios |

### Estudiante
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_Students` | Existente | Perfil académico/profesional del estudiante |
| `PYRUnibague_StudentPeriodParticipations` | Existente | Participación y elegibilidad por semestre. NO contiene matrícula ni estado de matrícula; ARL solo como nombre opcional gestionado por personal autorizado. |
| `PYRUnibague_StudentExperiences` | Existente | Experiencias laborales/académicas |
| `PYRUnibague_StudentSkills` | Existente | Competencias del estudiante |
| `PYRUnibague_StudentInterests` | Existente | Intereses profesionales |
| `PYRUnibague_StudentLocationPreferences` | Existente | Municipios preferidos |
| `PYRUnibague_StudentDocuments` | Existente | Metadatos CV y documentos privados |
| `PYRUnibague_StudentSpecialCases` | Propuesto | Casos especiales de asignación anteriormente conversados; datos mínimos y sin diagnósticos. |

### Organización
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_Organizations` | Existente | Organización registrada, aprobada y titular de proyectos; sin territorialización automática de asesores. |
| `PYRUnibague_OrganizationMembers` | Existente | Usuarios autorizados y contactos con cuenta |
| `PYRUnibague_OrganizationDocuments` | Existente | Soportes de entidad |
| `PYRUnibague_OrganizationReviews` | Existente | Historial de aprobación |
| `PYRUnibague_OrganizationContacts` | Propuesto | Contactos/interlocutores de organización: puede haber varios. Máximo uno principal para trámites, y diferentes responsables operativos por proyecto. |

### Proyectos y plazas
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_Projects` | Existente | Proyecto con nombre, municipio, zona rural/urbana, organización principal y periodo; asesor e interlocutor se presentan desde relaciones; equipo derivado de asignaciones/grupos. No almacena plan de acción. |
| `PYRUnibague_ProjectPositions` | Existente | Perfil/posición con capacity definida (p.ej. Sistemas=2, Mecánica=1), vinculable a una o varias carreras; si los cupos difieren por carrera, crear posiciones diferentes. |
| `PYRUnibague_ProjectPositionPrograms` | Existente | Carreras solicitadas por plaza |
| `PYRUnibague_ProjectRequirements` | Existente | Requisitos descriptivos de plaza |
| `PYRUnibague_ProjectPositionSkills` | Existente | Habilidades solicitadas |

### Matching y asignación
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_MatchingConfigurations` | Existente | Pesos y reglas de matching |
| `PYRUnibague_MatchingRuns` | Existente | Corridas históricas de scoring |
| `PYRUnibague_MatchCandidates` | Existente | Puntuación por pareja estudiante-plaza |
| `PYRUnibague_Assignments` | Existente | Asignaciones con vigencia |
| `PYRUnibague_AssignmentEvents` | Existente | Cambios y desasignaciones |

### Equipo académico
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_StaffProfiles` | Propuesto | Perfil mínimo de personal: asesor regional, coordinador y eventual docente técnico. El rol se define mediante UserRoles, sin duplicar credenciales. |

### Asesoría
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_AdvisorOrganizationAssignments` | Propuesto | Asesor regional asignado MANUALMENTE a una organización en un semestre. Máximo uno vigente por organización/periodo, con historial de cambios. No utilizar territorios ni asignación por municipio. |
| `PYRUnibague_AdvisorStudentAssignments` | Propuesto | Historial independiente de asesor del estudiante por semestre. Puede inicializarse según asesor de la organización, pero cambiar el asesor de la organización NO modifica estas filas automáticamente. |
| `PYRUnibague_ProjectTechnicalTeachers` | Propuesto | Docente técnico por proyecto: vínculo OPCIONAL; su ausencia nunca bloquea la creación o asignación de un proyecto. |

### Convocatorias
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_Calls` | Propuesto | Convocatoria por organización y periodo; publica uno o varios perfiles/cupos sin confundirse con proyecto. |
| `PYRUnibague_CallPositions` | Propuesto | Vincula convocatoria con una o más plazas existentes; capacidades salen de ProjectPositions. |

### Ejecución y equipos
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_Groups` | Propuesto | Equipo de Paz y Región de un proyecto. Un proyecto puede tener más de un equipo sin compartir asesores/entregas internamente. |
| `PYRUnibague_GroupMembers` | Propuesto | Integrantes del equipo, asociados a asignaciones reales de estudiantes para obtener nombre y carrera sin duplicarlos. |

### Organizaciones
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_ProjectInterlocutors` | Propuesto | Interlocutor operativo que figura en la ficha del proyecto; puede ser distinto del interlocutor principal para papeleo. |

### Organización / proyectos
| Tabla | Situación en código | Propósito |
|---|---|---|
| `PYRUnibague_ProjectParticipatingOrganizations` | Propuesto | Otras instituciones participantes de un proyecto además de la organización titular indicada por Projects.organization_id. Solo se usa cuando hay varios participantes; no duplica al titular. |

## 7. Diccionario de campos
En las tablas existentes pueden aparecer columnas **Propuesto**, que NO se encuentran aún en las migraciones. Nunca tratarlas como ya desplegadas.
### `PYRUnibague_UserProfiles` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `user_id` | `uuid` | Sí | PK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `display_name` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `institutional_email` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `avatar_path` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_Roles` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `code` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `name` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `description` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_system` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_UserRoles` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `user_id` | `uuid` | Sí | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `role_id` | `uuid` | Sí | FK → PYRUnibague_Roles | Existente | Actual en SQL P2/P3/P4/P5 |
| `assigned_by` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_AcademicPeriods` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `code` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `name` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `starts_on` | `date` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `ends_on` | `date` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `status` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_current` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_AcademicPrograms` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `code` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `name` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `faculty_name` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `active` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_Municipalities` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `country_code` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `department_code` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `department_name` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `municipality_code` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `municipality_name` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `active` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_OrganizationTypes` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `code` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `name` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `description` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `active` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_Skills` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `name` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `category` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `aliases` | `text[]` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `active` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_SystemConfigurations` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `key` | `text` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `value` | `jsonb` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `description` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_public` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_by` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_FeatureFlags` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `key` | `text` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `enabled` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `description` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_public` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_by` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_Students` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `user_id` | `uuid` | Sí | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `student_code` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `academic_program_id` | `uuid` | No | FK → PYRUnibague_AcademicPrograms | Existente | Actual en SQL P2/P3/P4/P5 |
| `current_semester` | `integer` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `bio` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `desired_work_description` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `origin_municipality_id` | `uuid` | No | FK → PYRUnibague_Municipalities | Existente | Actual en SQL P2/P3/P4/P5 |
| `current_municipality_id` | `uuid` | No | FK → PYRUnibague_Municipalities | Existente | Actual en SQL P2/P3/P4/P5 |
| `profile_links` | `jsonb` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_active` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_StudentPeriodParticipations` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `student_id` | `uuid` | Sí | FK → PYRUnibague_Students | Existente | Actual en SQL P2/P3/P4/P5 |
| `academic_period_id` | `uuid` | Sí | FK → PYRUnibague_AcademicPeriods | Existente | Actual en SQL P2/P3/P4/P5 |
| `status` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `eligible_for_matching` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `profile_completed_at` | `timestamptz` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `arl_provider_name` | `text` | No | — | Propuesto | Solo nombre de ARL informado por Universidad. Dato institucional y de solo lectura para estudiante; no es campo real todavía. |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_StudentExperiences` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `student_id` | `uuid` | Sí | FK → PYRUnibague_Students | Existente | Actual en SQL P2/P3/P4/P5 |
| `title` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `organization_name` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `description` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `started_on` | `date` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `ended_on` | `date` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_current` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_StudentSkills` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `student_id` | `uuid` | Sí | FK → PYRUnibague_Students | Existente | Actual en SQL P2/P3/P4/P5 |
| `skill_id` | `uuid` | Sí | FK → PYRUnibague_Skills | Existente | Actual en SQL P2/P3/P4/P5 |
| `evidence_text` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_StudentInterests` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `student_id` | `uuid` | Sí | FK → PYRUnibague_Students | Existente | Actual en SQL P2/P3/P4/P5 |
| `label` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `description` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `sort_order` | `integer` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_StudentLocationPreferences` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `student_id` | `uuid` | Sí | FK → PYRUnibague_Students | Existente | Actual en SQL P2/P3/P4/P5 |
| `municipality_id` | `uuid` | Sí | FK → PYRUnibague_Municipalities | Existente | Actual en SQL P2/P3/P4/P5 |
| `preference_order` | `integer` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_StudentDocuments` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `student_id` | `uuid` | Sí | FK → PYRUnibague_Students | Existente | Actual en SQL P2/P3/P4/P5 |
| `category_code` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `file_name` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `bucket_id` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `object_path` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `mime_type` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `size_bytes` | `bigint` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `status` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `uploaded_by` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_Organizations` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `organization_type_id` | `uuid` | No | FK → PYRUnibague_OrganizationTypes | Existente | Actual en SQL P2/P3/P4/P5 |
| `legal_name` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `display_name` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `tax_id` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `description` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `website` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `municipality_id` | `uuid` | No | FK → PYRUnibague_Municipalities | Existente | Actual en SQL P2/P3/P4/P5 |
| `status` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_by` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `verified_at` | `timestamptz` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `verified_by` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_OrganizationMembers` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `organization_id` | `uuid` | Sí | FK → PYRUnibague_Organizations | Existente | Actual en SQL P2/P3/P4/P5 |
| `user_id` | `uuid` | Sí | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `membership_role` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `can_manage` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_primary_contact` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `status` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_OrganizationDocuments` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `organization_id` | `uuid` | Sí | FK → PYRUnibague_Organizations | Existente | Actual en SQL P2/P3/P4/P5 |
| `category_code` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `file_name` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `bucket_id` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `object_path` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `mime_type` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `size_bytes` | `bigint` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `status` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `uploaded_by` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_OrganizationReviews` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `organization_id` | `uuid` | Sí | FK → PYRUnibague_Organizations | Existente | Actual en SQL P2/P3/P4/P5 |
| `reviewer_id` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `decision` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `notes` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_Projects` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `organization_id` | `uuid` | Sí | FK → PYRUnibague_Organizations | Existente | Actual en SQL P2/P3/P4/P5 |
| `academic_period_id` | `uuid` | Sí | FK → PYRUnibague_AcademicPeriods | Existente | Actual en SQL P2/P3/P4/P5 |
| `name` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `summary` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `description` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `municipality_id` | `uuid` | No | FK → PYRUnibague_Municipalities | Existente | Actual en SQL P2/P3/P4/P5 |
| `zone_type` | `text` | No | — | Propuesto | NUEVO PROPUESTO: Rural / Urbana como dato configurable o catálogo ligero; no se encuentra en SQL actual. No confundir con zona de asesoría. |
| `modality` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `status` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_by` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_ProjectPositions` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `project_id` | `uuid` | Sí | FK → PYRUnibague_Projects | Existente | Actual en SQL P2/P3/P4/P5 |
| `title` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `description` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `capacity` | `integer` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `status` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_active` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_ProjectPositionPrograms` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `project_position_id` | `uuid` | Sí | FK → PYRUnibague_ProjectPositions | Existente | Actual en SQL P2/P3/P4/P5 |
| `academic_program_id` | `uuid` | Sí | FK → PYRUnibague_AcademicPrograms | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_required` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_ProjectRequirements` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `project_position_id` | `uuid` | Sí | FK → PYRUnibague_ProjectPositions | Existente | Actual en SQL P2/P3/P4/P5 |
| `label` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `description` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_mandatory` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `sort_order` | `integer` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_ProjectPositionSkills` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `project_position_id` | `uuid` | Sí | FK → PYRUnibague_ProjectPositions | Existente | Actual en SQL P2/P3/P4/P5 |
| `skill_id` | `uuid` | Sí | FK → PYRUnibague_Skills | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_required` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_MatchingConfigurations` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `academic_period_id` | `uuid` | No | FK → PYRUnibague_AcademicPeriods | Existente | Actual en SQL P2/P3/P4/P5 |
| `name` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `algorithm_version` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `minimum_recommended_score` | `numeric` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `weights` | `jsonb` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `rules` | `jsonb` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_active` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_by` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_MatchingRuns` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `academic_period_id` | `uuid` | Sí | FK → PYRUnibague_AcademicPeriods | Existente | Actual en SQL P2/P3/P4/P5 |
| `matching_configuration_id` | `uuid` | Sí | FK → PYRUnibague_MatchingConfigurations | Existente | Actual en SQL P2/P3/P4/P5 |
| `status` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `started_by` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `started_at` | `timestamptz` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `completed_at` | `timestamptz` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `summary` | `jsonb` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_MatchCandidates` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `matching_run_id` | `uuid` | Sí | FK → PYRUnibague_MatchingRuns | Existente | Actual en SQL P2/P3/P4/P5 |
| `student_id` | `uuid` | Sí | FK → PYRUnibague_Students | Existente | Actual en SQL P2/P3/P4/P5 |
| `project_position_id` | `uuid` | Sí | FK → PYRUnibague_ProjectPositions | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_eligible` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `total_score` | `numeric` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `component_scores` | `jsonb` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `blockers` | `jsonb` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `recommendations` | `jsonb` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `explanation` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_Assignments` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `academic_period_id` | `uuid` | Sí | FK → PYRUnibague_AcademicPeriods | Existente | Actual en SQL P2/P3/P4/P5 |
| `student_id` | `uuid` | Sí | FK → PYRUnibague_Students | Existente | Actual en SQL P2/P3/P4/P5 |
| `project_position_id` | `uuid` | Sí | FK → PYRUnibague_ProjectPositions | Existente | Actual en SQL P2/P3/P4/P5 |
| `match_candidate_id` | `uuid` | No | FK → PYRUnibague_MatchCandidates | Existente | Actual en SQL P2/P3/P4/P5 |
| `status` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `source` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `is_active` | `boolean` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `assigned_by` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `assigned_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `unassigned_at` | `timestamptz` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `notes` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `updated_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_AssignmentEvents` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `assignment_id` | `uuid` | Sí | FK → PYRUnibague_Assignments | Existente | Actual en SQL P2/P3/P4/P5 |
| `event_type` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `actor_user_id` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `reason_code` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `reason_text` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `metadata` | `jsonb` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_Notifications` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `user_id` | `uuid` | Sí | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `type_code` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `title` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `body` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `link_path` | `text` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `read_at` | `timestamptz` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_AuditLogs` — Existente
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Existente | Actual en SQL P2/P3/P4/P5 |
| `actor_user_id` | `uuid` | No | FK → auth.users | Existente | Actual en SQL P2/P3/P4/P5 |
| `action` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `entity_table` | `text` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `entity_id` | `uuid` | No | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `changed_fields` | `text[]` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `context` | `jsonb` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |
| `created_at` | `timestamptz` | Sí | — | Existente | Actual en SQL P2/P3/P4/P5 |

### `PYRUnibague_StaffProfiles` — Propuesto
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Propuesto | — |
| `user_id` | `uuid` | Sí | FK → auth.users | Propuesto | Identidad autenticada |
| `staff_code` | `text` | No | — | Propuesto | Código interno si aplica |
| `phone` | `text` | No | — | Propuesto | Contacto institucional |
| `academic_unit` | `text` | No | — | Propuesto | Unidad o facultad |
| `status` | `text` | Sí | — | Propuesto | Activo/inactivo; provisional |
| `created_at` | `timestamptz` | Sí | — | Propuesto | — |
| `updated_at` | `timestamptz` | Sí | — | Propuesto | — |

### `PYRUnibague_OrganizationContacts` — Propuesto
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Propuesto | — |
| `organization_id` | `uuid` | Sí | FK → PYRUnibague_Organizations | Propuesto | Entidad |
| `user_id` | `uuid` | No | FK → auth.users | Propuesto | Cuenta opcional |
| `full_name` | `text` | Sí | — | Propuesto | Nombre |
| `position_title` | `text` | No | — | Propuesto | Cargo |
| `email` | `text` | No | — | Propuesto | Contacto |
| `phone` | `text` | No | — | Propuesto | Contacto |
| `is_primary` | `boolean` | Sí | — | Propuesto | Interlocutor principal para comunicaciones/papeleo a nivel de organización; máximo uno por organización. Otros se vinculan a proyectos. |
| `created_at` | `timestamptz` | Sí | — | Propuesto | — |
| `updated_at` | `timestamptz` | Sí | — | Propuesto | — |

### `PYRUnibague_AdvisorOrganizationAssignments` — Propuesto
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Propuesto | — |
| `advisor_id` | `uuid` | Sí | FK → PYRUnibague_StaffProfiles | Propuesto | Asesor |
| `organization_id` | `uuid` | Sí | FK → PYRUnibague_Organizations | Propuesto | Entidad |
| `academic_period_id` | `uuid` | Sí | FK → PYRUnibague_AcademicPeriods | Propuesto | Semestre |
| `starts_on` | `date` | Sí | — | Propuesto | Inicio |
| `ends_on` | `date` | No | — | Propuesto | Fin |
| `is_current` | `boolean` | Sí | — | Propuesto | Vigente |
| `assigned_by` | `uuid` | No | FK → auth.users | Propuesto | Responsable del cambio |
| `created_at` | `timestamptz` | Sí | — | Propuesto | — |
| `updated_at` | `timestamptz` | Sí | — | Propuesto | — |

### `PYRUnibague_AdvisorStudentAssignments` — Propuesto
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Propuesto | — |
| `advisor_id` | `uuid` | Sí | FK → PYRUnibague_StaffProfiles | Propuesto | Asesor |
| `participation_id` | `uuid` | Sí | FK → PYRUnibague_StudentPeriodParticipations | Propuesto | Estudiante en semestre |
| `starts_on` | `date` | Sí | — | Propuesto | Inicio |
| `ends_on` | `date` | No | — | Propuesto | Fin |
| `is_current` | `boolean` | Sí | — | Propuesto | Vigente |
| `reason` | `text` | No | — | Propuesto | Motivo de reasignación |
| `source_assignment_id` | `uuid` | No | FK → PYRUnibague_Assignments | Propuesto | Asignación que motivó la asesoría; opcional |
| `created_at` | `timestamptz` | Sí | — | Propuesto | — |
| `updated_at` | `timestamptz` | Sí | — | Propuesto | — |

### `PYRUnibague_Calls` — Propuesto
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Propuesto | — |
| `organization_id` | `uuid` | Sí | FK → PYRUnibague_Organizations | Propuesto | Entidad |
| `academic_period_id` | `uuid` | Sí | FK → PYRUnibague_AcademicPeriods | Propuesto | Semestre |
| `title` | `text` | Sí | — | Propuesto | Nombre |
| `details` | `text` | No | — | Propuesto | Descripción |
| `opens_at` | `timestamptz` | No | — | Propuesto | Apertura |
| `closes_at` | `timestamptz` | No | — | Propuesto | Cierre |
| `status` | `text` | Sí | — | Propuesto | Borrador/abierta/cerrada |
| `created_at` | `timestamptz` | Sí | — | Propuesto | — |
| `updated_at` | `timestamptz` | Sí | — | Propuesto | — |

### `PYRUnibague_CallPositions` — Propuesto
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Propuesto | — |
| `call_id` | `uuid` | Sí | FK → PYRUnibague_Calls | Propuesto | Convocatoria |
| `project_position_id` | `uuid` | Sí | FK → PYRUnibague_ProjectPositions | Propuesto | Plaza |
| `created_at` | `timestamptz` | Sí | — | Propuesto | — |
| `updated_at` | `timestamptz` | Sí | — | Propuesto | — |

### `PYRUnibague_StudentSpecialCases` — Propuesto
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Propuesto | — |
| `participation_id` | `uuid` | Sí | FK → PYRUnibague_StudentPeriodParticipations | Propuesto | Periodo |
| `case_type_code` | `text` | Sí | — | Propuesto | Catálogo a confirmar |
| `requested_municipality_id` | `uuid` | No | FK → PYRUnibague_Municipalities | Propuesto | Municipio |
| `status` | `text` | Sí | — | Propuesto | Solicitud/revisión |
| `reviewed_by` | `uuid` | No | FK → auth.users | Propuesto | Coordinador |
| `decision_notes` | `text` | No | — | Propuesto | Fundamento mínimo y confidencial [RESTRINGIDO] |
| `created_at` | `timestamptz` | Sí | — | Propuesto | — |
| `updated_at` | `timestamptz` | Sí | — | Propuesto | — |

### `PYRUnibague_Groups` — Propuesto
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Propuesto | — |
| `project_id` | `uuid` | Sí | FK → PYRUnibague_Projects | Propuesto | Proyecto |
| `name` | `text` | Sí | — | Propuesto | Nombre |
| `status` | `text` | Sí | — | Propuesto | Activo/cerrado |
| `started_on` | `date` | No | — | Propuesto | Fecha de inicio |
| `created_at` | `timestamptz` | Sí | — | Propuesto | — |
| `updated_at` | `timestamptz` | Sí | — | Propuesto | — |

### `PYRUnibague_GroupMembers` — Propuesto
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Propuesto | — |
| `group_id` | `uuid` | Sí | FK → PYRUnibague_Groups | Propuesto | Equipo |
| `assignment_id` | `uuid` | Sí | FK → PYRUnibague_Assignments | Propuesto | Asignación |
| `joined_on` | `date` | No | — | Propuesto | Ingreso |
| `left_on` | `date` | No | — | Propuesto | Salida |
| `status` | `text` | Sí | — | Propuesto | Miembro activo/inactivo |
| `created_at` | `timestamptz` | Sí | — | Propuesto | — |
| `updated_at` | `timestamptz` | Sí | — | Propuesto | — |

### `PYRUnibague_ProjectTechnicalTeachers` — Propuesto
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Propuesto | — |
| `project_id` | `uuid` | Sí | FK → PYRUnibague_Projects | Propuesto | Proyecto |
| `teacher_id` | `uuid` | Sí | FK → PYRUnibague_StaffProfiles | Propuesto | Docente |
| `responsibility` | `text` | No | — | Propuesto | Papel en el proyecto |
| `created_at` | `timestamptz` | Sí | — | Propuesto | — |
| `updated_at` | `timestamptz` | Sí | — | Propuesto | — |

### `PYRUnibague_ProjectInterlocutors` — Propuesto
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Propuesto | — |
| `project_id` | `uuid` | Sí | FK → PYRUnibague_Projects | Propuesto | Proyecto |
| `organization_contact_id` | `uuid` | Sí | FK → PYRUnibague_OrganizationContacts | Propuesto | Debe pertenecer a la organización del proyecto |
| `is_primary_for_project` | `boolean` | Sí | — | Propuesto | Un contacto principal operativo vigente por proyecto |
| `notes` | `text` | No | — | Propuesto | Funciones en este proyecto, sin datos sensibles |
| `created_at` | `timestamptz` | Sí | — | Propuesto | — |
| `updated_at` | `timestamptz` | Sí | — | Propuesto | — |

### `PYRUnibague_ProjectParticipatingOrganizations` — Propuesto
| Campo | SQL actual / sugerido | Requerido | Clave/relación | Situación | Observación |
|---|---|---|---|---|---|
| `id` | `uuid` | Sí | PK | Propuesto | Identificador único del vínculo |
| `project_id` | `uuid` | Sí | FK → PYRUnibague_Projects.id | Propuesto | Proyecto al que participa |
| `organization_id` | `uuid` | Sí | FK → PYRUnibague_Organizations.id | Propuesto | Institución colaboradora registrada; UNIQUE(project_id, organization_id) |
| `participation_note` | `text` | No | — | Propuesto | Descripción opcional de la colaboración |
| `created_at` | `timestamptz` | Sí | — | Propuesto | Auditoría creación |

## 8. Relaciones relevantes
| Origen | Destino | Cardinalidad | Significado |
|---|---|---|---|
| auth.users | PYRUnibague_UserProfiles | 1:1 | Identidad |
| PYRUnibague_UserProfiles | PYRUnibague_UserRoles | 1:N | Roles |
| PYRUnibague_Students | PYRUnibague_StudentPeriodParticipations | 1:N | Por semestre |
| PYRUnibague_StaffProfiles | PYRUnibague_AdvisorOrganizationAssignments | 1:N | Vinculación asesor organización |
| PYRUnibague_Organizations | PYRUnibague_AdvisorOrganizationAssignments | 1:N | Historial responsable |
| PYRUnibague_StaffProfiles | PYRUnibague_AdvisorStudentAssignments | 1:N | Vinculación asesor estudiante |
| PYRUnibague_StudentPeriodParticipations | PYRUnibague_AdvisorStudentAssignments | 1:N | Historial independiente |
| PYRUnibague_Organizations | PYRUnibague_OrganizationContacts | 1:N | Interlocutores |
| PYRUnibague_Organizations | PYRUnibague_Projects | 1:N | Proyectos |
| PYRUnibague_Projects | PYRUnibague_ProjectPositions | 1:N | Plazas |
| PYRUnibague_AcademicPeriods | PYRUnibague_Projects | 1:N | Semestre |
| PYRUnibague_Organizations | PYRUnibague_Calls | 1:N | Convocatorias |
| PYRUnibague_Calls | PYRUnibague_CallPositions | 1:N | Plazas convocadas |
| PYRUnibague_ProjectPositions | PYRUnibague_CallPositions | 1:N | En convocatoria |
| PYRUnibague_Students | PYRUnibague_Assignments | 1:N | Asignación histórica |
| PYRUnibague_ProjectPositions | PYRUnibague_Assignments | 1:N | Ocupa cupo |
| PYRUnibague_Projects | PYRUnibague_Groups | 1:N | Equipo |
| PYRUnibague_Groups | PYRUnibague_GroupMembers | 1:N | Integrantes |
| PYRUnibague_Assignments | PYRUnibague_GroupMembers | 1:N | Miembro basado en asignación |
| PYRUnibague_Projects | PYRUnibague_ProjectInterlocutors | 1:N | Interlocutores operativos por proyecto |
| PYRUnibague_OrganizationContacts | PYRUnibague_ProjectInterlocutors | 1:N | Un interlocutor puede participar en varios proyectos |
| PYRUnibague_AcademicPeriods | PYRUnibague_AdvisorOrganizationAssignments | 1:N | Un asesor vigente por organización y periodo |
| PYRUnibague_Projects | PYRUnibague_ProjectParticipatingOrganizations | 1:N opcional | Instituciones colaboradoras adicionales al titular |
| PYRUnibague_Organizations | PYRUnibague_ProjectParticipatingOrganizations | 1:N | Una entidad puede participar en distintos proyectos |
| PYRUnibague_AdvisorOrganizationAssignments | PYRUnibague_Projects | Derivada org+periodo | Asesor visible del proyecto consultado desde asignación manual de la organización |
| PYRUnibague_StudentPeriodParticipations | PYRUnibague_AdvisorStudentAssignments | 1:N historial | Asesor de estudiante separado del asesor de organización |

## 9. Reglas aprobadas para diseño
| ID | Área | Regla | Origen | Prioridad |
|---|---|---|---|---|
| R01 | Fuera de alcance | No registrar, mostrar, consultar, importar ni administrar matrícula en esta aplicación. No existe un estado propio de matrícula. | Decisión explícita usuario 2026-10-13 | Crítica |
| R02 | Fuera de alcance | No construir tablas ni interfaces de planes de acción, objetivos, cronogramas, entregas, revisiones o Comprensión del Entorno: se gestionan en Drive fuera del software. | Decisión explícita usuario 2026-10-13 | Crítica |
| R03 | Asesores | La vinculación asesor-organización se asigna manualmente por una persona autorizada, no por cálculos de regiones, municipios ni comunas. | Decisión explícita usuario 2026-10-13 | Crítica |
| R04 | Asesores | Máximo un asesor vigente por organización y periodo; conservar historial de cambios. | Experiencia usuario v0.3 | Crítica |
| R05 | Asesores | El asesor del estudiante es independiente; reemplazar asesor de organización no cambia automáticamente asesores de estudiantes. | Video + acuerdo previo | Crítica |
| R06 | Interlocutores | Una organización puede tener varios interlocutores. Uno es principal para papeleo y cada proyecto puede señalar su interlocutor operativo. | Experiencia usuario | Alta |
| R07 | Docente técnico | El docente técnico es opcional, incluso puede no existir para muchos proyectos. | Experiencia usuario | Alta |
| R08 | Proyectos | Cada proyecto tiene su ficha: nombre, municipio, zona, instituciones, interlocutor operativo, periodo, asesor regional y equipo. | Ficha proyecto compartida | Alta |
| R09 | Proyectos | No duplicar nombres de estudiantes, carreras, asesor ni interlocutor como cadenas sueltas dentro de Projects; derivar de relaciones actuales/históricas. | Diseño relacional | Alta |
| R10 | Organizaciones | Una organización puede tener varios proyectos. Cada proyecto tiene uno o varios grupos/equipos, con estudiantes no repetidos activamente en el mismo periodo. | Experiencia usuario | Alta |
| R11 | Convocatorias | Una convocatoria agrupa perfiles/plazas. Cupos por carrera se registran en ProjectPositions diferentes cuando tienen capacidades distintas. | Ejemplo de convocatoria compartido | Alta |
| R12 | ARL | Guardar, si corresponde, solo nombre de ARL del estudiante en su participación por periodo; editable por personal autorizado, sin adjuntos ni trámites. | Decisión usuario | Alta |
| R13 | Matching | El motor produce compatibilidades y recomendaciones; la asignación es una operación posterior revisable por Admin. | Implementación P5 | Alta |
| R14 | Grupos | El equipo de Paz y Región se forma desde GroupMembers vinculados a Assignments; no guardar una lista de nombres en texto. | Diseño relacional | Alta |
| R15 | Identidad | Coordinadores, asesores y docentes pertenecen a identidad/roles; privilegios via UserRoles y RLS, no por metadata editable. | Arquitectura P2 | Alta |
| R16 | Historial | Responsables por periodo e historial de asignaciones deben permanecer trazables; cambios no alteran semestres cerrados sin autorización. | Video + diseño | Alta |
| R17 | Datos sensibles | No añadir diagnósticos ni información médica a perfiles o matching. Casos especiales se gestionan con datos mínimos y RLS. | Diseño privacidad | Crítica |
| R18 | Alcance Drive | La Universidad/estudiantes mantienen planes de acción y entregables en Drive fuera de la plataforma; no se construye sincronización de Drive. | Decisión usuario | Alta |

## 10. Preguntas no bloqueantes
| ID | Tema | Pregunta | Módulo afectado | Prioridad |
|---|---|---|---|---|
| Q01 | Asesores | ¿Qué perfil autoriza la asignación/cambio manual de asesor: coordinador, ADMIN o ambos? | RLS / UI de asignación | Media |
| Q02 | Convocatorias | ¿Una convocatoria se postula por estudiante o el administrador gestiona las candidaturas? | Aplicaciones y matching | Media |
| Q03 | Organizaciones | ¿Un proyecto puede tener varias instituciones participantes que no tengan cuenta en plataforma? | ProjectParticipatingOrganizations | Media |
| Q04 | Equipos | ¿Se usa más de un grupo en el mismo proyecto en el funcionamiento final o normalmente solo uno? | Groups / GroupMembers | Baja |
| Q05 | ARL | ¿Quién registra/actualiza el nombre de la ARL: ADMIN, asesor o importación institucional? | Permiso ARL | Baja |
| Q06 | Docentes técnicos | Cuando exista docente técnico, ¿debe iniciar sesión o solo figurar como contacto? | StaffProfiles / permisos | Baja |
| Q07 | Autenticación | ¿Cómo acceden los asesores: correo institucional, SSO o cuentas administradas? | Auth | Media |
| Q08 | Asignaciones | ¿La asignación de asesor al estudiante se copia al aprobar la plaza o al confirmar la asignación definitiva? | AdvisorStudentAssignments | Media |
| Q09 | Ubicación | ¿Basta municipio y zona rural/urbana o se necesita vereda/dirección/sede concreta? | Projects ubicación | Baja |

## 11. Inventario explícito de lo descartado (v0.3 → v0.4)
- `PYRUnibague_StudentProcessStages`: **NO propuesto para esta versión**.
- `PYRUnibague_AcademicProcessWindows`: **NO propuesto para esta versión**.
- `PYRUnibague_ImportBatches`: **NO propuesto para esta versión** (posponer carga masiva).
- `PYRUnibague_ImportRows`: **NO propuesto para esta versión** (posponer carga masiva).
- `PYRUnibague_GroupAdvisorAssignments`: **NO propuesto para esta versión**.
- `PYRUnibague_ActionPlans`: **NO propuesto para esta versión**.
- `PYRUnibague_PlanObjectives`: **NO propuesto para esta versión**.
- `PYRUnibague_PlanActivities`: **NO propuesto para esta versión**.
- `PYRUnibague_PlanActivityAssignees`: **NO propuesto para esta versión**.
- `PYRUnibague_ActivityDeliveries`: **NO propuesto para esta versión**.
- `PYRUnibague_DeliveryFiles`: **NO propuesto para esta versión**.
- `PYRUnibague_DeliveryReviews`: **NO propuesto para esta versión**.
- `PYRUnibague_SustainableDevelopmentGoals`: **NO propuesto para esta versión**.
- `PYRUnibague_ActionPlanSDGs`: **NO propuesto para esta versión**.
- `PYRUnibague_LearningMoments`: **NO propuesto para esta versión**.
- `PYRUnibague_LearningMomentResources`: **NO propuesto para esta versión**.
- `PYRUnibague_LearningMomentActivities`: **NO propuesto para esta versión**.
- `PYRUnibague_GroupLearningSubmissions`: **NO propuesto para esta versión**.
- `PYRUnibague_GroupDiaryEntries`: **NO propuesto para esta versión**.
- `PYRUnibague_DeadlineExtensions`: **NO propuesto para esta versión**.
- `PYRUnibague_Territories`: **NO propuesto para esta versión**.
- `PYRUnibague_AdvisorTerritoryAssignments`: **NO propuesto para esta versión**.

La salida del modelo propuesto **no elimina** migraciones existentes ni obliga a borrar código actual. Solo evita construir módulos nuevos innecesarios.

## 12. Plan para iniciar implementación
1. Integrar `MatchingWorkspace` de P5 en ruta admin si continúa pendiente.
2. Crear migración ADITIVA de v0.4 para `Projects.zone_type`, `StudentPeriodParticipations.arl_provider_name` y las tablas nuevas aprobadas; roles/RLS/triggers/índices necesarios. Verificar que no aparezca ninguna operación de matrícula ni estructura de planes/entregas.
3. Construir asignación manual de asesores por organización/periodo y asesor del estudiante separado; contactos e interlocutores; ficha del proyecto y vista de equipo.
4. Conectar convocatorias/cupos, matching y asignaciones definitivas con validaciones de capacidad, historial y exclusión de conflictos.
5. Probar con datos sintéticos y con Supabase real antes de declarar listo para producción. No atribuir aprobación institucional a reglas provisionales.

**Control de versión:** v0.2 (video, alcance amplio) → v0.3 (experiencia regional SENA) → **v0.4 (MVP acotado; sin matrícula, sin seguimiento en Drive, asignaciones de asesores manuales)**.