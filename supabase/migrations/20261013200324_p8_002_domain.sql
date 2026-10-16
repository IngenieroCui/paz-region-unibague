-- Core Schema v0. Applied migrations are immutable.

begin;

create table public."PYRUnibague_Students" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid references auth.users(id) on delete restrict not null unique,
  "student_code" text unique,
  "academic_program_id" uuid constraint "pyr_fk_Students_academic_program_id" references public."PYRUnibague_AcademicPrograms"(id) on delete restrict,
  "current_semester" integer check (current_semester > 0),
  "bio" text,
  "desired_work_description" text,
  "origin_municipality_id" uuid constraint "pyr_fk_Students_origin_municipality_id" references public."PYRUnibague_Municipalities"(id) on delete restrict,
  "current_municipality_id" uuid constraint "pyr_fk_Students_current_municipality_id" references public."PYRUnibague_Municipalities"(id) on delete restrict,
  "profile_links" jsonb not null default '{}' check (jsonb_typeof(profile_links) = 'object'),
  "is_active" boolean not null default true,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_Students" enable row level security;
create index on public."PYRUnibague_Students" ("academic_program_id");

create index on public."PYRUnibague_Students" ("origin_municipality_id");

create index on public."PYRUnibague_Students" ("current_municipality_id");

create table public."PYRUnibague_StudentPeriodParticipations" (
  "id" uuid primary key default gen_random_uuid(),
  "student_id" uuid constraint "pyr_fk_StudentPeriodParticipations_student_id" references public."PYRUnibague_Students"(id) on delete restrict not null,
  "academic_period_id" uuid constraint "pyr_fk_StudentPeriodParticipations_academic_period_id" references public."PYRUnibague_AcademicPeriods"(id) on delete restrict not null,
  "status" text not null,
  "eligible_for_matching" boolean not null default false,
  "profile_completed_at" timestamptz,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique (student_id, academic_period_id)
);

alter table public."PYRUnibague_StudentPeriodParticipations" enable row level security;
create index on public."PYRUnibague_StudentPeriodParticipations" ("student_id");

create index on public."PYRUnibague_StudentPeriodParticipations" ("academic_period_id");

create table public."PYRUnibague_StudentExperiences" (
  "id" uuid primary key default gen_random_uuid(),
  "student_id" uuid constraint "pyr_fk_StudentExperiences_student_id" references public."PYRUnibague_Students"(id) on delete cascade not null,
  "title" text not null,
  "organization_name" text,
  "description" text,
  "started_on" date,
  "ended_on" date,
  "is_current" boolean not null default false,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  check (ended_on is null or started_on is null or ended_on >= started_on),
  check (not is_current or ended_on is null)
);

alter table public."PYRUnibague_StudentExperiences" enable row level security;
create index on public."PYRUnibague_StudentExperiences" ("student_id");

create table public."PYRUnibague_StudentSkills" (
  "id" uuid primary key default gen_random_uuid(),
  "student_id" uuid constraint "pyr_fk_StudentExperiences_student_id" references public."PYRUnibague_Students"(id) on delete cascade not null,
  "skill_id" uuid constraint "pyr_fk_StudentSkills_skill_id" references public."PYRUnibague_Skills"(id) on delete restrict not null,
  "evidence_text" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique (student_id, skill_id)
);

alter table public."PYRUnibague_StudentSkills" enable row level security;
create index on public."PYRUnibague_StudentSkills" ("student_id");

create index on public."PYRUnibague_StudentSkills" ("skill_id");

create table public."PYRUnibague_StudentInterests" (
  "id" uuid primary key default gen_random_uuid(),
  "student_id" uuid constraint "pyr_fk_StudentExperiences_student_id" references public."PYRUnibague_Students"(id) on delete cascade not null,
  "label" text not null,
  "description" text,
  "sort_order" integer not null default 0,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_StudentInterests" enable row level security;
create index on public."PYRUnibague_StudentInterests" ("student_id");

create table public."PYRUnibague_StudentLocationPreferences" (
  "id" uuid primary key default gen_random_uuid(),
  "student_id" uuid constraint "pyr_fk_StudentExperiences_student_id" references public."PYRUnibague_Students"(id) on delete cascade not null,
  "municipality_id" uuid constraint "pyr_fk_StudentLocationPreferences_municipality_id" references public."PYRUnibague_Municipalities"(id) on delete restrict not null,
  "preference_order" integer not null check (preference_order > 0),
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique (student_id, municipality_id),
  unique (student_id, preference_order)
);

alter table public."PYRUnibague_StudentLocationPreferences" enable row level security;
create index on public."PYRUnibague_StudentLocationPreferences" ("student_id");

create index on public."PYRUnibague_StudentLocationPreferences" ("municipality_id");

create table public."PYRUnibague_StudentDocuments" (
  "id" uuid primary key default gen_random_uuid(),
  "student_id" uuid constraint "pyr_fk_StudentExperiences_student_id" references public."PYRUnibague_Students"(id) on delete cascade not null,
  "category_code" text not null,
  "file_name" text not null,
  "bucket_id" text not null,
  "object_path" text not null unique,
  "mime_type" text,
  "size_bytes" bigint check (size_bytes >= 0),
  "status" text not null,
  "uploaded_by" uuid references auth.users(id) on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_StudentDocuments" enable row level security;
create index on public."PYRUnibague_StudentDocuments" ("student_id");

create index on public."PYRUnibague_StudentDocuments" ("uploaded_by");

create table public."PYRUnibague_Organizations" (
  "id" uuid primary key default gen_random_uuid(),
  "organization_type_id" uuid constraint "pyr_fk_Organizations_organization_type_id" references public."PYRUnibague_OrganizationTypes"(id) on delete restrict,
  "legal_name" text not null,
  "display_name" text,
  "tax_id" text,
  "description" text,
  "website" text,
  "municipality_id" uuid constraint "pyr_fk_Organizations_municipality_id" references public."PYRUnibague_Municipalities"(id) on delete restrict,
  "status" text not null,
  "created_by" uuid references auth.users(id) on delete set null,
  "verified_at" timestamptz,
  "verified_by" uuid references auth.users(id) on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_Organizations" enable row level security;
create index on public."PYRUnibague_Organizations" ("organization_type_id");

create index on public."PYRUnibague_Organizations" ("municipality_id");

create index on public."PYRUnibague_Organizations" ("created_by");

create index on public."PYRUnibague_Organizations" ("verified_by");

create table public."PYRUnibague_OrganizationMembers" (
  "id" uuid primary key default gen_random_uuid(),
  "organization_id" uuid constraint "pyr_fk_OrganizationMembers_organization_id" references public."PYRUnibague_Organizations"(id) on delete restrict not null,
  "user_id" uuid references auth.users(id) on delete cascade not null,
  "membership_role" text not null,
  "can_manage" boolean not null default false,
  "is_primary_contact" boolean not null default false,
  "status" text not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public."PYRUnibague_OrganizationMembers" enable row level security;
create index on public."PYRUnibague_OrganizationMembers" ("organization_id");

create index on public."PYRUnibague_OrganizationMembers" ("user_id");

create table public."PYRUnibague_OrganizationDocuments" (
  "id" uuid primary key default gen_random_uuid(),
  "organization_id" uuid constraint "pyr_fk_OrganizationDocuments_organization_id" references public."PYRUnibague_Organizations"(id) on delete cascade not null,
  "category_code" text not null,
  "file_name" text not null,
  "bucket_id" text not null,
  "object_path" text not null unique,
  "mime_type" text,
  "size_bytes" bigint check (size_bytes >= 0),
  "status" text not null,
  "uploaded_by" uuid references auth.users(id) on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_OrganizationDocuments" enable row level security;
create index on public."PYRUnibague_OrganizationDocuments" ("organization_id");

create index on public."PYRUnibague_OrganizationDocuments" ("uploaded_by");

create table public."PYRUnibague_OrganizationReviews" (
  "id" uuid primary key default gen_random_uuid(),
  "organization_id" uuid constraint "pyr_fk_OrganizationMembers_organization_id" references public."PYRUnibague_Organizations"(id) on delete restrict not null,
  "reviewer_id" uuid references auth.users(id) on delete set null,
  "decision" text not null,
  "notes" text,
  "created_at" timestamptz not null default now()
);

alter table public."PYRUnibague_OrganizationReviews" enable row level security;
create index on public."PYRUnibague_OrganizationReviews" ("organization_id");

create index on public."PYRUnibague_OrganizationReviews" ("reviewer_id");

create table public."PYRUnibague_Projects" (
  "id" uuid primary key default gen_random_uuid(),
  "organization_id" uuid constraint "pyr_fk_OrganizationMembers_organization_id" references public."PYRUnibague_Organizations"(id) on delete restrict not null,
  "academic_period_id" uuid constraint "pyr_fk_StudentPeriodParticipations_academic_period_id" references public."PYRUnibague_AcademicPeriods"(id) on delete restrict not null,
  "name" text not null,
  "summary" text,
  "description" text,
  "municipality_id" uuid constraint "pyr_fk_Organizations_municipality_id" references public."PYRUnibague_Municipalities"(id) on delete restrict,
  "modality" text,
  "status" text not null,
  "created_by" uuid references auth.users(id) on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_Projects" enable row level security;
create index on public."PYRUnibague_Projects" ("organization_id");

create index on public."PYRUnibague_Projects" ("academic_period_id");

create index on public."PYRUnibague_Projects" ("municipality_id");

create index on public."PYRUnibague_Projects" ("created_by");

create table public."PYRUnibague_ProjectPositions" (
  "id" uuid primary key default gen_random_uuid(),
  "project_id" uuid constraint "pyr_fk_ProjectPositions_project_id" references public."PYRUnibague_Projects"(id) on delete restrict not null,
  "title" text not null,
  "description" text,
  "capacity" integer not null check (capacity > 0),
  "status" text not null,
  "is_active" boolean not null default true,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_ProjectPositions" enable row level security;
create index on public."PYRUnibague_ProjectPositions" ("project_id");

create table public."PYRUnibague_ProjectPositionPrograms" (
  "id" uuid primary key default gen_random_uuid(),
  "project_position_id" uuid constraint "pyr_fk_ProjectPositionPrograms_project_position_id" references public."PYRUnibague_ProjectPositions"(id) on delete cascade not null,
  "academic_program_id" uuid constraint "pyr_fk_Students_academic_program_id" references public."PYRUnibague_AcademicPrograms"(id) on delete restrict not null,
  "is_required" boolean not null default true,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique (project_position_id, academic_program_id)
);

alter table public."PYRUnibague_ProjectPositionPrograms" enable row level security;
create index on public."PYRUnibague_ProjectPositionPrograms" ("project_position_id");

create index on public."PYRUnibague_ProjectPositionPrograms" ("academic_program_id");

create table public."PYRUnibague_ProjectRequirements" (
  "id" uuid primary key default gen_random_uuid(),
  "project_position_id" uuid constraint "pyr_fk_ProjectPositionPrograms_project_position_id" references public."PYRUnibague_ProjectPositions"(id) on delete cascade not null,
  "label" text not null,
  "description" text,
  "is_mandatory" boolean not null default false,
  "sort_order" integer not null default 0,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_ProjectRequirements" enable row level security;
create index on public."PYRUnibague_ProjectRequirements" ("project_position_id");

create table public."PYRUnibague_ProjectPositionSkills" (
  "id" uuid primary key default gen_random_uuid(),
  "project_position_id" uuid constraint "pyr_fk_ProjectPositionPrograms_project_position_id" references public."PYRUnibague_ProjectPositions"(id) on delete cascade not null,
  "skill_id" uuid constraint "pyr_fk_StudentSkills_skill_id" references public."PYRUnibague_Skills"(id) on delete restrict not null,
  "is_required" boolean not null default false,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique (project_position_id, skill_id)
);

alter table public."PYRUnibague_ProjectPositionSkills" enable row level security;
create index on public."PYRUnibague_ProjectPositionSkills" ("project_position_id");

create index on public."PYRUnibague_ProjectPositionSkills" ("skill_id");

create table public."PYRUnibague_MatchingConfigurations" (
  "id" uuid primary key default gen_random_uuid(),
  "academic_period_id" uuid constraint "pyr_fk_MatchingConfigurations_academic_period_id" references public."PYRUnibague_AcademicPeriods"(id) on delete restrict,
  "name" text not null,
  "algorithm_version" text not null,
  "minimum_recommended_score" numeric check (minimum_recommended_score between 0 and 100),
  "weights" jsonb not null default '{}' check (jsonb_typeof(weights) = 'object'),
  "rules" jsonb not null default '{}' check (jsonb_typeof(rules) = 'object'),
  "is_active" boolean not null default false,
  "created_by" uuid references auth.users(id) on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_MatchingConfigurations" enable row level security;
create index on public."PYRUnibague_MatchingConfigurations" ("academic_period_id");

create index on public."PYRUnibague_MatchingConfigurations" ("created_by");

create table public."PYRUnibague_MatchingRuns" (
  "id" uuid primary key default gen_random_uuid(),
  "academic_period_id" uuid constraint "pyr_fk_StudentPeriodParticipations_academic_period_id" references public."PYRUnibague_AcademicPeriods"(id) on delete restrict not null,
  "matching_configuration_id" uuid constraint "pyr_fk_MatchingRuns_matching_configuration_id" references public."PYRUnibague_MatchingConfigurations"(id) on delete restrict not null,
  "status" text not null,
  "started_by" uuid references auth.users(id) on delete set null,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "summary" jsonb not null default '{}',
  "created_at" timestamptz not null default now(),
  check (completed_at is null or (started_at is not null and completed_at >= started_at))
);

alter table public."PYRUnibague_MatchingRuns" enable row level security;
create index on public."PYRUnibague_MatchingRuns" ("academic_period_id");

create index on public."PYRUnibague_MatchingRuns" ("matching_configuration_id");

create index on public."PYRUnibague_MatchingRuns" ("started_by");

create table public."PYRUnibague_MatchCandidates" (
  "id" uuid primary key default gen_random_uuid(),
  "matching_run_id" uuid constraint "pyr_fk_MatchCandidates_matching_run_id" references public."PYRUnibague_MatchingRuns"(id) on delete restrict not null,
  "student_id" uuid constraint "pyr_fk_StudentPeriodParticipations_student_id" references public."PYRUnibague_Students"(id) on delete restrict not null,
  "project_position_id" uuid constraint "pyr_fk_MatchCandidates_project_position_id" references public."PYRUnibague_ProjectPositions"(id) on delete restrict not null,
  "is_eligible" boolean not null,
  "total_score" numeric check (total_score between 0 and 100),
  "component_scores" jsonb not null default '{}',
  "blockers" jsonb not null default '[]',
  "recommendations" jsonb not null default '[]',
  "explanation" text,
  "created_at" timestamptz not null default now(),
  unique (matching_run_id, student_id, project_position_id)
);

alter table public."PYRUnibague_MatchCandidates" enable row level security;
create index on public."PYRUnibague_MatchCandidates" ("matching_run_id");

create index on public."PYRUnibague_MatchCandidates" ("student_id");

create index on public."PYRUnibague_MatchCandidates" ("project_position_id");

create table public."PYRUnibague_Assignments" (
  "id" uuid primary key default gen_random_uuid(),
  "academic_period_id" uuid constraint "pyr_fk_StudentPeriodParticipations_academic_period_id" references public."PYRUnibague_AcademicPeriods"(id) on delete restrict not null,
  "student_id" uuid constraint "pyr_fk_StudentPeriodParticipations_student_id" references public."PYRUnibague_Students"(id) on delete restrict not null,
  "project_position_id" uuid constraint "pyr_fk_MatchCandidates_project_position_id" references public."PYRUnibague_ProjectPositions"(id) on delete restrict not null,
  "match_candidate_id" uuid constraint "pyr_fk_Assignments_match_candidate_id" references public."PYRUnibague_MatchCandidates"(id) on delete restrict,
  "status" text not null,
  "source" text not null check (source in ('MATCHING', 'MANUAL')),
  "is_active" boolean not null default true,
  "assigned_by" uuid references auth.users(id) on delete set null,
  "assigned_at" timestamptz not null default now(),
  "unassigned_at" timestamptz,
  "notes" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  check (unassigned_at is null or unassigned_at >= assigned_at),
  check (not is_active or unassigned_at is null)
);

alter table public."PYRUnibague_Assignments" enable row level security;
create index on public."PYRUnibague_Assignments" ("academic_period_id");

create index on public."PYRUnibague_Assignments" ("student_id");

create index on public."PYRUnibague_Assignments" ("project_position_id");

create index on public."PYRUnibague_Assignments" ("match_candidate_id");

create index on public."PYRUnibague_Assignments" ("assigned_by");

create table public."PYRUnibague_AssignmentEvents" (
  "id" uuid primary key default gen_random_uuid(),
  "assignment_id" uuid constraint "pyr_fk_AssignmentEvents_assignment_id" references public."PYRUnibague_Assignments"(id) on delete restrict not null,
  "event_type" text not null,
  "actor_user_id" uuid references auth.users(id) on delete set null,
  "reason_code" text,
  "reason_text" text,
  "metadata" jsonb not null default '{}',
  "created_at" timestamptz not null default now()
);

alter table public."PYRUnibague_AssignmentEvents" enable row level security;
create index on public."PYRUnibague_AssignmentEvents" ("assignment_id");

create index on public."PYRUnibague_AssignmentEvents" ("actor_user_id");

create table public."PYRUnibague_Notifications" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid references auth.users(id) on delete cascade not null,
  "type_code" text not null,
  "title" text not null,
  "body" text,
  "link_path" text,
  "read_at" timestamptz,
  "created_at" timestamptz not null default now()
);

alter table public."PYRUnibague_Notifications" enable row level security;
create index on public."PYRUnibague_Notifications" ("user_id");

create table public."PYRUnibague_AuditLogs" (
  "id" uuid primary key default gen_random_uuid(),
  "actor_user_id" uuid references auth.users(id) on delete set null,
  "action" text not null,
  "entity_table" text not null,
  "entity_id" uuid,
  "changed_fields" text[] not null default '{}',
  "context" jsonb not null default '{}',
  "created_at" timestamptz not null default now()
);

alter table public."PYRUnibague_AuditLogs" enable row level security;
create index on public."PYRUnibague_AuditLogs" ("actor_user_id");

create unique index on public."PYRUnibague_Assignments" (academic_period_id, student_id) where is_active;

create index on public."PYRUnibague_Organizations" (lower(legal_name));

create index on public."PYRUnibague_Projects" (lower(name));

commit;
