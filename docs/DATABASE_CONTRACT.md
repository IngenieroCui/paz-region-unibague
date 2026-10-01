# Core Schema v0

Contrato base de P3/P4/P5. Implementado en cuatro migraciones P2 y una migración aditiva P3 ordenadas en `supabase/migrations/`. No modificar migraciones aplicadas. Todas las tablas propias están en public y usan quoted identifiers literales.

## Tabla → propósito → propietario funcional

| Tabla | Propósito | Propietario |

| --- | --- | --- |

| `"PYRUnibague_UserProfiles"` | Metadata de identidad, 1:1 con Auth | Responsable común · Auth/infra/admin |

| `"PYRUnibague_Roles"` | Catálogo RBAC global | Responsable común · Auth/infra/admin |

| `"PYRUnibague_UserRoles"` | Asignaciones multirrol persistidas | Responsable común · Auth/infra/admin |

| `"PYRUnibague_AcademicPeriods"` | Periodos académicos reales | Responsable común · Auth/infra/admin |

| `"PYRUnibague_AcademicPrograms"` | Programas académicos reales | Responsable común · Auth/infra/admin |

| `"PYRUnibague_Municipalities"` | Catálogo territorial | Responsable común · Auth/infra/admin |

| `"PYRUnibague_OrganizationTypes"` | Tipos configurables de entidad | P3 · organizations |

| `"PYRUnibague_Skills"` | Habilidades normalizadas | Responsable común · Auth/infra/admin |

| `"PYRUnibague_SystemConfigurations"` | Configuración JSON pública o privada | Responsable común · Auth/infra/admin |

| `"PYRUnibague_FeatureFlags"` | Flags de producto; no autorizan acceso | Responsable común · Auth/infra/admin |

| `"PYRUnibague_Students"` | Perfil profesional ligado a Auth | P3 · students |

| `"PYRUnibague_StudentPeriodParticipations"` | Participación y elegibilidad por periodo | P3 · students |

| `"PYRUnibague_StudentExperiences"` | Experiencia profesional | P3 · students |

| `"PYRUnibague_StudentSkills"` | Habilidades y evidencia | P3 · students |

| `"PYRUnibague_StudentInterests"` | Intereses ordenados | P3 · students |

| `"PYRUnibague_StudentLocationPreferences"` | Preferencias territoriales ordenadas | P3 · students |

| `"PYRUnibague_StudentDocuments"` | Metadata de documentos privados | P3 · students |

| `"PYRUnibague_Organizations"` | Identidad y revisión de organización | P3 · organizations |

| `"PYRUnibague_OrganizationMembers"` | Membresías y facultad de gestión | P3 · organizations |

| `"PYRUnibague_OrganizationDocuments"` | Metadata de documentos privados | P3 · organizations |

| `"PYRUnibague_OrganizationReviews"` | Historial de decisiones administrativas | P3 · organizations |

| `"PYRUnibague_Projects"` | Proyectos de organización en un periodo | P4 · projects |

| `"PYRUnibague_ProjectPositions"` | Plazas con capacidad positiva | P4 · projects |

| `"PYRUnibague_ProjectPositionPrograms"` | Compatibilidad con varios programas | P4 · projects |

| `"PYRUnibague_ProjectRequirements"` | Requisitos de una plaza | P4 · projects |

| `"PYRUnibague_ProjectPositionSkills"` | Habilidades requeridas/opcionales | P4 · projects |

| `"PYRUnibague_MatchingConfigurations"` | Versiones, pesos y reglas futuras | P5 · matching |

| `"PYRUnibague_MatchingRuns"` | Ejecuciones futuras por periodo | P5 · matching |

| `"PYRUnibague_MatchCandidates"` | Elegibilidad, puntuaciones y explicaciones futuras | P5 · matching |

| `"PYRUnibague_Assignments"` | Asignación por estudiante/periodo/plaza | P6 · assignments (coordinación P4) |

| `"PYRUnibague_AssignmentEvents"` | Historial técnico de asignación | P6 · assignments (coordinación P4) |

| `"PYRUnibague_Notifications"` | Mensajes individuales | Responsable común · Auth/infra/admin |

| `"PYRUnibague_AuditLogs"` | Acciones y nombres de campos; sin valores | Responsable común · Auth/infra/admin |

## Integridad y datos
33 tablas. PK UUID con gen_random_uuid(), salvo UserProfiles.user_id = auth.users.id y keys text de configuraciones/flags. created_at en todas; updated_at y trigger central en mutables. Las migraciones definen los campos y tipos autoritativos; el fallback TypeScript está sincronizado con esas definiciones y debe regenerarse con CLI.

Foreign keys de historiales operativos usan RESTRICT; referencias de actor usan SET NULL. Auth→UserProfiles/UserRoles/Members/Notifications usa CASCADE. Los hijos editables de perfil, metadata documental y relaciones auxiliares usan CASCADE; la eliminación de un Student/Organization/Project referenciado por historial queda bloqueada. No borrar objetos Storage mediante SQL: la metadata no borra automáticamente los archivos; el módulo documental deberá coordinar limpieza vía API Storage.

Un solo periodo actual (índice parcial), una asignación activa por estudiante/periodo (índice parcial), score entre 0 y 100 cuando existe, capacidad > 0, fechas coherentes en experiencias/periodos/runs/asignaciones. Unique en roles, participaciones, relaciones de habilidad/programa, memberships y preferencias territoriales; municipios por país/departamento/código; skills por lower(btrim(name)). Índices para FKs, legal_name y name de proyectos.

Estados institucionales son text requerido sin enum ni seed de workflows. Las reglas definitivas aún no existen. `OrganizationMembers.status = 'active'` es únicamente un marcador técnico de acceso: junto a rol global ORGANIZATION permite lectura; `can_manage` permite gestión. ADMIN establece esas membresías; la RPC P3 crea la membresía propia inicial durante el registro técnico autorizado. Otros status no autorizan acceso. Source MATCHING/MANUAL distingue origen técnico.

Students.student_code, academic_program_id y current_semester son campos editables del perfil propio; declararlos no concede elegibilidad institucional. is_active es administrativo; el estudiante crea su perfil activo y completa información profesional. No puede cambiar user_id, id ni created_at. Participaciones son lectura propia/gestión ADMIN. Organization status, verified_at/by y created_by no son editables por miembros. institutional_email es metadata editable de aplicación, no sustituye Auth.email ni concede permisos.

## API de seguridad
RPC públicas: pyr_unibague_has_role(role_code), pyr_unibague_current_roles(), pyr_unibague_is_student_owner(student_id), pyr_unibague_is_org_member(organization_id), pyr_unibague_can_manage_org(organization_id), pyr_unibague_mark_notification_read(notification_id). EXECUTE solo authenticated, search_path vacío, referencias calificadas. Helpers técnicos/trigger functions en schema pyr_unibague_private (fuera de schemas de PostgREST).

ADMIN gestiona datos operativos. AuditLogs solo lectura ADMIN, escritura únicamente por trigger técnico; Notifications sin UPDATE genérico, RPC idempotente solo propia. Matching admin-only. Assignments lectura propia/organización propietaria, writes ADMIN; sin RPC definitiva ni comprobación de capacidad aún (P6). Ver AUTH_RBAC y RLS_MATRIX.

## Storage
Dos buckets privados: pyrunibague-student-documents, pyrunibague-organization-documents. Path exacto: `<student_id|organization_id>/<document_id>/<filename>`, UUID canónico en los dos primeros segmentos y nombre sin carpetas. Metadata valida bucket/path/id/nombre y uploader. Primero reservar document_id y usarlo en upload y metadata; no asumir una transacción atómica entre Storage y PostgreSQL. signed URLs de 60 s en lib/supabase/storage.ts; deben tratarse como enlaces temporales de acceso, sin persistirlas ni cachearlas. ADMIN accede; Student solo propio; Organization solo managers de su entidad.

## Semilla y evolución
Solo STUDENT, ORGANIZATION, ADMIN. Sin usuarios, credenciales, periodos, programas, municipios, tipos, proyectos ni matching activo ficticio. Fixtures SQL viven exclusivamente dentro de una transacción de pruebas revertida.

P3/P4/P5 amplían servicios y UI sobre este contrato. Cualquier cambio imprescindible usa nueva migración coordinada y regenera tipos; no renombrar ni rediseñar tablas unilateralmente. Matching/assignments mantienen relaciones normales; la validación transaccional entre periodo/plaza/candidato y la capacidad será implementada con la RPC de P6 antes de habilitar asignaciones a usuarios normales. No hay datos médicos, embeddings ni pgvector.

## Extensión P3

Registro atómico mediante pyr_unibague_register_organization; no INSERT directo desde Organization. pending_review y membresía active/can_manage/is_primary_contact son estados técnicos iniciales, sin verificación. RPC adicionales de orden: pyr_unibague_set_student_preferences y pyr_unibague_order_student_interests, SECURITY INVOKER con RLS y propietario. OrganizationReviews añade SELECT miembro, sin writes. Storage privado limita técnicamente a 10 MiB y PDF/Word/PNG/JPEG. Tipos fallback sincronizados manualmente. Contrato detallado en STUDENT_ORGANIZATION_MODULES.md.

## Extensión P4 · Projects + Admin

La migración aditiva `202610010006_projects_admin_p4.sql` no altera las 33 tablas ni migraciones previas. Añade RPC `pyr_unibague_review_organization`, `pyr_unibague_set_current_academic_period`, `pyr_unibague_admin_dashboard`, `pyr_unibague_admin_students` y `pyr_unibague_project_totals`, más triggers de estados/plazas, último ADMIN y roles del sistema inmutables. RPC de revisión y periodo son transaccionales SECURITY DEFINER con search_path vacío y ADMIN persistido; agregados/búsqueda son SECURITY INVOKER bajo RLS. EXECUTE público/anon revocado. Los tipos siguen siendo fallback manual. Firmas, invariantes y límites: [PROJECTS_ADMIN_P4.md](PROJECTS_ADMIN_P4.md).
