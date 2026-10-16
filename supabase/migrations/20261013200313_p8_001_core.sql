-- Core Schema v0. Applied migrations are immutable.

begin;

create table public."PYRUnibague_UserProfiles" (
  "user_id" uuid primary key references auth.users(id) on delete cascade,
  "display_name" text,
  "institutional_email" text,
  "avatar_path" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_UserProfiles" enable row level security;
create table public."PYRUnibague_Roles" (
  "id" uuid primary key default gen_random_uuid(),
  "code" text not null unique,
  "name" text not null,
  "description" text,
  "is_system" boolean not null default true,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_Roles" enable row level security;
create table public."PYRUnibague_UserRoles" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid references auth.users(id) on delete cascade not null,
  "role_id" uuid constraint "pyr_fk_UserRoles_role_id" references public."PYRUnibague_Roles"(id) on delete restrict not null,
  "assigned_by" uuid references auth.users(id) on delete set null,
  "created_at" timestamptz not null default now(),
  unique (user_id, role_id)
);

alter table public."PYRUnibague_UserRoles" enable row level security;
create index on public."PYRUnibague_UserRoles" ("user_id");

create index on public."PYRUnibague_UserRoles" ("role_id");

create index on public."PYRUnibague_UserRoles" ("assigned_by");

create table public."PYRUnibague_AcademicPeriods" (
  "id" uuid primary key default gen_random_uuid(),
  "code" text not null unique,
  "name" text not null,
  "starts_on" date,
  "ends_on" date,
  "status" text not null,
  "is_current" boolean not null default false,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

alter table public."PYRUnibague_AcademicPeriods" enable row level security;
create table public."PYRUnibague_AcademicPrograms" (
  "id" uuid primary key default gen_random_uuid(),
  "code" text not null unique,
  "name" text not null,
  "faculty_name" text,
  "active" boolean not null default true,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_AcademicPrograms" enable row level security;
create table public."PYRUnibague_Municipalities" (
  "id" uuid primary key default gen_random_uuid(),
  "country_code" text not null default 'CO',
  "department_code" text not null,
  "department_name" text not null,
  "municipality_code" text not null,
  "municipality_name" text not null,
  "active" boolean not null default true,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique (country_code, department_code, municipality_code)
);

alter table public."PYRUnibague_Municipalities" enable row level security;
create table public."PYRUnibague_OrganizationTypes" (
  "id" uuid primary key default gen_random_uuid(),
  "code" text not null unique,
  "name" text not null,
  "description" text,
  "active" boolean not null default true,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_OrganizationTypes" enable row level security;
create table public."PYRUnibague_Skills" (
  "id" uuid primary key default gen_random_uuid(),
  "name" text not null,
  "category" text,
  "aliases" text[] not null default '{}',
  "active" boolean not null default true,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  check (length(btrim(name)) > 0)
);

alter table public."PYRUnibague_Skills" enable row level security;
create table public."PYRUnibague_SystemConfigurations" (
  "key" text primary key,
  "value" jsonb not null,
  "description" text,
  "is_public" boolean not null default false,
  "updated_by" uuid references auth.users(id) on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_SystemConfigurations" enable row level security;
create index on public."PYRUnibague_SystemConfigurations" ("updated_by");

create table public."PYRUnibague_FeatureFlags" (
  "key" text primary key,
  "enabled" boolean not null default false,
  "description" text,
  "is_public" boolean not null default true,
  "updated_by" uuid references auth.users(id) on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

alter table public."PYRUnibague_FeatureFlags" enable row level security;
create index on public."PYRUnibague_FeatureFlags" ("updated_by");

create unique index on public."PYRUnibague_AcademicPeriods" (is_current) where is_current;

create unique index on public."PYRUnibague_Skills" (lower(btrim(name)));

commit;
