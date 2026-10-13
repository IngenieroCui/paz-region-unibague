-- P6-A / model v0.4. Exactly eight tables; no automatic student propagation.
begin;

insert into public."PYRUnibague_Roles" (code,name,description,is_system)
values ('ADVISOR','Asesor regional','Responsabilidades manuales por periodo académico',true)
on conflict(code) do update set name=excluded.name,description=excluded.description,is_system=true;
create or replace function pyr_unibague_private.keep_system_roles() returns trigger
language plpgsql set search_path = '' as $$
begin
 if old.code in ('ADMIN','STUDENT','ORGANIZATION','ADVISOR') and
 (TG_OP='DELETE' or new.code is distinct from old.code or new.id is distinct from old.id) then
  raise exception 'System role identity is immutable' using errcode='23514';
 end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end $$;

create table public."PYRUnibague_StaffProfiles" (
 "id" uuid primary key default gen_random_uuid(),
 "user_id" uuid not null unique constraint "pyr_p6a_StaffProfiles_user_id" references auth.users(id) on delete restrict,
 "staff_code" text unique, "phone" text, "academic_unit" text,
 "status" text not null check (length(btrim(status)) > 0),
 "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now()
);
create table public."PYRUnibague_OrganizationContacts" (
 "id" uuid primary key default gen_random_uuid(),
 "organization_id" uuid not null constraint "pyr_p6a_OrganizationContacts_organization_id" references public."PYRUnibague_Organizations"(id) on delete restrict,
 "user_id" uuid constraint "pyr_p6a_OrganizationContacts_user_id" references auth.users(id) on delete set null,
 "full_name" text not null check (length(btrim(full_name)) > 0),
 "position_title" text, "email" text, "phone" text, "is_primary" boolean not null default false,
 "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now()
);
create unique index "p6a_contact_primary" on public."PYRUnibague_OrganizationContacts"(organization_id) where is_primary;
create table public."PYRUnibague_AdvisorOrganizationAssignments" (
 "id" uuid primary key default gen_random_uuid(),
 "advisor_id" uuid not null constraint "pyr_p6a_AdvisorOrganizationAssignments_advisor_id" references public."PYRUnibague_StaffProfiles"(id) on delete restrict,
 "organization_id" uuid not null constraint "pyr_p6a_AdvisorOrganizationAssignments_organization_id" references public."PYRUnibague_Organizations"(id) on delete restrict,
 "academic_period_id" uuid not null constraint "pyr_p6a_AdvisorOrganizationAssignments_academic_period_id" references public."PYRUnibague_AcademicPeriods"(id) on delete restrict,
 "starts_on" date not null, "ends_on" date, "is_current" boolean not null default true,
 "assigned_by" uuid constraint "pyr_p6a_AdvisorOrganizationAssignments_assigned_by" references auth.users(id) on delete set null,
 "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(),
 check (ends_on is null or ends_on >= starts_on), check (is_current = (ends_on is null))
);
create unique index "p6a_org_advisor_current" on public."PYRUnibague_AdvisorOrganizationAssignments"(organization_id,academic_period_id) where is_current;
create table public."PYRUnibague_AdvisorStudentAssignments" (
 "id" uuid primary key default gen_random_uuid(),
 "advisor_id" uuid not null constraint "pyr_p6a_AdvisorStudentAssignments_advisor_id" references public."PYRUnibague_StaffProfiles"(id) on delete restrict,
 "participation_id" uuid not null constraint "pyr_p6a_AdvisorStudentAssignments_participation_id" references public."PYRUnibague_StudentPeriodParticipations"(id) on delete restrict,
 "starts_on" date not null, "ends_on" date, "is_current" boolean not null default true,
 "reason" text, "source_assignment_id" uuid constraint "pyr_p6a_AdvisorStudentAssignments_source_assignment_id" references public."PYRUnibague_Assignments"(id) on delete restrict,
 "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(),
 check (ends_on is null or ends_on >= starts_on), check (is_current = (ends_on is null))
);
create unique index "p6a_student_advisor_current" on public."PYRUnibague_AdvisorStudentAssignments"(participation_id) where is_current;
create table public."PYRUnibague_StudentSpecialCases" (
 "id" uuid primary key default gen_random_uuid(),
 "participation_id" uuid not null constraint "pyr_p6a_StudentSpecialCases_participation_id" references public."PYRUnibague_StudentPeriodParticipations"(id) on delete restrict,
 "case_type_code" text not null check (length(btrim(case_type_code)) > 0),
 "requested_municipality_id" uuid constraint "pyr_p6a_StudentSpecialCases_requested_municipality_id" references public."PYRUnibague_Municipalities"(id) on delete restrict,
 "status" text not null check (length(btrim(status)) > 0),
 "reviewed_by" uuid constraint "pyr_p6a_StudentSpecialCases_reviewed_by" references auth.users(id) on delete set null, "decision_notes" text,
 "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now()
);
create table public."PYRUnibague_ProjectTechnicalTeachers" (
 "id" uuid primary key default gen_random_uuid(),
 "project_id" uuid not null constraint "pyr_p6a_ProjectTechnicalTeachers_project_id" references public."PYRUnibague_Projects"(id) on delete cascade,
 "teacher_id" uuid not null constraint "pyr_p6a_ProjectTechnicalTeachers_teacher_id" references public."PYRUnibague_StaffProfiles"(id) on delete restrict,
 "responsibility" text,
 "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(),
 unique(project_id,teacher_id)
);
create table public."PYRUnibague_ProjectInterlocutors" (
 "id" uuid primary key default gen_random_uuid(),
 "project_id" uuid not null constraint "pyr_p6a_ProjectInterlocutors_project_id" references public."PYRUnibague_Projects"(id) on delete cascade,
 "organization_contact_id" uuid not null constraint "pyr_p6a_ProjectInterlocutors_organization_contact_id" references public."PYRUnibague_OrganizationContacts"(id) on delete restrict,
 "is_primary_for_project" boolean not null default false, "notes" text,
 "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(),
 unique(project_id,organization_contact_id)
);
create unique index "p6a_project_primary_contact" on public."PYRUnibague_ProjectInterlocutors"(project_id) where is_primary_for_project;
create table public."PYRUnibague_ProjectParticipatingOrganizations" (
 "id" uuid primary key default gen_random_uuid(),
 "project_id" uuid not null constraint "pyr_p6a_ProjectParticipatingOrganizations_project_id" references public."PYRUnibague_Projects"(id) on delete cascade,
 "organization_id" uuid not null constraint "pyr_p6a_ProjectParticipatingOrganizations_organization_id" references public."PYRUnibague_Organizations"(id) on delete restrict,
 "participation_note" text, "created_at" timestamptz not null default now(),
 unique(project_id,organization_id)
);
alter table public."PYRUnibague_StudentPeriodParticipations" add column "arl_provider_name" text;
-- Existing participation policies already restrict ALL writes to ADMIN.

-- A staff row never grants a role. Persisted UserRoles is always authoritative.
create function pyr_unibague_private.advisor_for_org(p_org uuid,p_period uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and public.pyr_unibague_has_role('ADVISOR') and exists (
  select 1 from public."PYRUnibague_AdvisorOrganizationAssignments" a
  join public."PYRUnibague_StaffProfiles" s on s.id=a.advisor_id
  where s.user_id=auth.uid() and s.status='active' and a.is_current
   and a.organization_id=p_org and (p_period is null or a.academic_period_id=p_period));
$$;
create function pyr_unibague_private.advisor_for_project(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public."PYRUnibague_Projects" p where p.id=p_project
  and (pyr_unibague_private.advisor_for_org(p.organization_id,p.academic_period_id)
   or (public.pyr_unibague_has_role('ADVISOR') and exists(
    select 1 from public."PYRUnibague_AdvisorStudentAssignments" a
    join public."PYRUnibague_StaffProfiles" s on s.id=a.advisor_id
    join public."PYRUnibague_StudentPeriodParticipations" sp on sp.id=a.participation_id
    join public."PYRUnibague_Assignments" x on x.student_id=sp.student_id and x.academic_period_id=sp.academic_period_id and x.is_active
    join public."PYRUnibague_ProjectPositions" pos on pos.id=x.project_position_id
    where a.is_current and s.status='active' and s.user_id=auth.uid()
     and sp.academic_period_id=p.academic_period_id and pos.project_id=p.id))));
$$;

-- Histories cannot be rewritten/deleted, including by direct administrative SQL.
create function pyr_unibague_private.advisor_insert_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if new.is_current and (new.starts_on>current_date or not exists(
  select 1 from public."PYRUnibague_StaffProfiles" s
  join public."PYRUnibague_UserRoles" ur on ur.user_id=s.user_id
  join public."PYRUnibague_Roles" r on r.id=ur.role_id
  where s.id=new.advisor_id and s.status='active' and r.code='ADVISOR')) then
  raise exception 'Current responsibility requires active persisted advisor and valid date' using errcode='23514';
 end if;
 if TG_TABLE_NAME='PYRUnibague_AdvisorStudentAssignments' then
  if new.source_assignment_id is not null and not exists(
   select 1 from public."PYRUnibague_Assignments" x join public."PYRUnibague_StudentPeriodParticipations" sp
   on sp.student_id=x.student_id and sp.academic_period_id=x.academic_period_id
   where x.id=new.source_assignment_id and sp.id=new.participation_id) then
   raise exception 'Assignment must match participation' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
create function pyr_unibague_private.advisor_history_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
 if TG_OP='DELETE' then raise exception 'Advisor history cannot be deleted' using errcode='23514'; end if;
 if TG_OP='UPDATE' then
  if (to_jsonb(new)-array['is_current','ends_on','updated_at','assigned_by'])
    is distinct from (to_jsonb(old)-array['is_current','ends_on','updated_at','assigned_by'])
   or (not old.is_current and (new.is_current or new.ends_on is distinct from old.ends_on))
   or (old.is_current and new.is_current and new.ends_on is distinct from old.ends_on) then
   raise exception 'Advisor history is immutable' using errcode='23514';
  end if;
  if TG_TABLE_NAME='PYRUnibague_AdvisorOrganizationAssignments' and
    (to_jsonb(new)->'assigned_by') is distinct from (to_jsonb(old)->'assigned_by') and to_jsonb(new)->>'assigned_by' is not null then
   raise exception 'Advisor actor is immutable' using errcode='23514';
  end if;
 end if;
 return new;
end $$;

create function public.pyr_unibague_change_organization_advisor(
 p_organization_id uuid,p_academic_period_id uuid,p_advisor_id uuid,p_starts_on date default current_date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public."PYRUnibague_AdvisorOrganizationAssignments"%rowtype; result uuid;
begin
 if auth.uid() is null or not public.pyr_unibague_has_role('ADMIN') then raise exception 'ADMIN required' using errcode='42501'; end if;
 if p_starts_on is null or p_starts_on>current_date then raise exception 'Invalid start date' using errcode='22023'; end if;
 -- Parent lock also serializes the first responsibility (there may be no history row yet).
 perform 1 from public."PYRUnibague_Organizations" where id=p_organization_id for update;
 if not found then raise exception 'Organization not found' using errcode='P0002'; end if;
 perform 1 from public."PYRUnibague_AcademicPeriods" where id=p_academic_period_id;
 if not found then raise exception 'Period not found' using errcode='P0002'; end if;
 if p_advisor_id is not null and not exists(select 1 from public."PYRUnibague_StaffProfiles" s
  join public."PYRUnibague_UserRoles" ur on ur.user_id=s.user_id
  join public."PYRUnibague_Roles" r on r.id=ur.role_id
  where s.id=p_advisor_id and s.status='active' and r.code='ADVISOR') then
  raise exception 'Active persisted ADVISOR required' using errcode='23514';
 end if;
 select * into previous from public."PYRUnibague_AdvisorOrganizationAssignments"
  where organization_id=p_organization_id and academic_period_id=p_academic_period_id and is_current for update;
 if found then
  if previous.advisor_id=p_advisor_id then return previous.id; end if;
  if p_starts_on<previous.starts_on then raise exception 'Invalid change date' using errcode='22023'; end if;
  update public."PYRUnibague_AdvisorOrganizationAssignments" set is_current=false,ends_on=p_starts_on where id=previous.id;
 end if;
 if p_advisor_id is not null then
  insert into public."PYRUnibague_AdvisorOrganizationAssignments"(advisor_id,organization_id,academic_period_id,starts_on,assigned_by)
  values(p_advisor_id,p_organization_id,p_academic_period_id,p_starts_on,auth.uid()) returning id into result;
 end if;
 return result;
end $$;
create function public.pyr_unibague_change_student_advisor(
 p_participation_id uuid,p_advisor_id uuid,p_starts_on date default current_date,
 p_reason text default null,p_source_assignment_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare part public."PYRUnibague_StudentPeriodParticipations"%rowtype;
 previous public."PYRUnibague_AdvisorStudentAssignments"%rowtype; result uuid;
begin
 if auth.uid() is null or not public.pyr_unibague_has_role('ADMIN') then raise exception 'ADMIN required' using errcode='42501'; end if;
 if p_starts_on is null or p_starts_on>current_date then raise exception 'Invalid start date' using errcode='22023'; end if;
 select * into part from public."PYRUnibague_StudentPeriodParticipations" where id=p_participation_id for update;
 if not found then raise exception 'Participation not found' using errcode='P0002'; end if;
 if p_advisor_id is not null and not exists(select 1 from public."PYRUnibague_StaffProfiles" s
  join public."PYRUnibague_UserRoles" ur on ur.user_id=s.user_id
  join public."PYRUnibague_Roles" r on r.id=ur.role_id
  where s.id=p_advisor_id and s.status='active' and r.code='ADVISOR') then
  raise exception 'Active persisted ADVISOR required' using errcode='23514';
 end if;
 if p_source_assignment_id is not null and not exists(select 1 from public."PYRUnibague_Assignments"
  where id=p_source_assignment_id and student_id=part.student_id and academic_period_id=part.academic_period_id) then
  raise exception 'Assignment must match participation' using errcode='23514';
 end if;
 select * into previous from public."PYRUnibague_AdvisorStudentAssignments" where participation_id=p_participation_id and is_current for update;
 if found then
  if previous.advisor_id=p_advisor_id and previous.source_assignment_id is not distinct from p_source_assignment_id
   and previous.reason is not distinct from nullif(btrim(p_reason),'') then return previous.id; end if;
  if p_starts_on<previous.starts_on then raise exception 'Invalid change date' using errcode='22023'; end if;
  update public."PYRUnibague_AdvisorStudentAssignments" set is_current=false,ends_on=p_starts_on where id=previous.id;
 end if;
 if p_advisor_id is not null then
  insert into public."PYRUnibague_AdvisorStudentAssignments"(advisor_id,participation_id,starts_on,reason,source_assignment_id)
  values(p_advisor_id,p_participation_id,p_starts_on,nullif(btrim(p_reason),''),p_source_assignment_id) returning id into result;
 end if;
 -- Actor is retained in AuditLogs; v0.4 intentionally has no assigned_by column here.
 return result;
end $$;

create function pyr_unibague_private.p6a_relation_guard() returns trigger
language plpgsql set search_path = '' as $$
declare project public."PYRUnibague_Projects"%rowtype; target uuid;
begin
 if TG_OP='DELETE' then target=old.project_id; else target=new.project_id; end if;
 select * into project from public."PYRUnibague_Projects" where id=target for update;
 if TG_OP='DELETE' and not found then return old; end if;
 if TG_OP='UPDATE' and new.project_id<>old.project_id then raise exception 'Cannot move relation' using errcode='23514'; end if;
 if current_user not in ('postgres','service_role','supabase_admin') and not public.pyr_unibague_has_role('ADMIN')
  and (not public.pyr_unibague_can_manage_org(project.organization_id) or project.status not in ('draft','changes_required')) then
  raise exception 'Project profile cannot be edited' using errcode='42501';
 end if;
 if TG_OP='DELETE' then return old; end if;
 if TG_TABLE_NAME='PYRUnibague_ProjectInterlocutors' then
  if not exists(select 1 from public."PYRUnibague_OrganizationContacts" c where c.id=new.organization_contact_id and c.organization_id=project.organization_id) then
   raise exception 'Contact must belong to project owner' using errcode='23514';
  end if;
 elsif TG_TABLE_NAME='PYRUnibague_ProjectParticipatingOrganizations' then
  if new.organization_id=project.organization_id then raise exception 'Participating organization cannot duplicate owner' using errcode='23514'; end if;
 end if;
 return new;
end $$;
-- Also protect parent edits so existing relations cannot become contradictory.
create function pyr_unibague_private.p6a_parent_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if TG_TABLE_NAME='PYRUnibague_OrganizationContacts' then
  if new.organization_id is distinct from old.organization_id then raise exception 'Cannot move contact' using errcode='23514'; end if;
 else
  if new.organization_id is distinct from old.organization_id and (
   exists(select 1 from public."PYRUnibague_ProjectInterlocutors" where project_id=old.id)
   or exists(select 1 from public."PYRUnibague_ProjectParticipatingOrganizations" where project_id=old.id and organization_id=new.organization_id)) then
   raise exception 'Owner conflicts with project relations' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
create trigger p6a_parent before update on public."PYRUnibague_Projects" for each row execute function pyr_unibague_private.p6a_parent_guard();
create trigger p6a_parent before update on public."PYRUnibague_OrganizationContacts" for each row execute function pyr_unibague_private.p6a_parent_guard();
create function pyr_unibague_private.p6a_staff_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
 if (new.id,new.user_id,new.created_at) is distinct from (old.id,old.user_id,old.created_at) then
  raise exception 'Staff identity is immutable' using errcode='23514';
 end if;
 return new;
end $$;
create trigger p6a_staff_identity before update on public."PYRUnibague_StaffProfiles" for each row execute function pyr_unibague_private.p6a_staff_identity();

-- Preserve identities referenced by advisor/case history even before C is merged.
create function pyr_unibague_private.p6a_source_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if (new.student_id,new.academic_period_id) is distinct from (old.student_id,old.academic_period_id) then
  if TG_TABLE_NAME='PYRUnibague_StudentPeriodParticipations' then
   if exists(select 1 from public."PYRUnibague_AdvisorStudentAssignments" where participation_id=old.id)
    or exists(select 1 from public."PYRUnibague_StudentSpecialCases" where participation_id=old.id) then
    raise exception 'Participation identity is referenced by administrative history' using errcode='23514';
   end if;
  else
   if exists(select 1 from public."PYRUnibague_AdvisorStudentAssignments" where source_assignment_id=old.id) then
    raise exception 'Assignment identity is referenced by advisor history' using errcode='23514';
   end if;
  end if;
 end if;
 return new;
end $$;
create trigger p6a_source_identity before update on public."PYRUnibague_StudentPeriodParticipations" for each row execute function pyr_unibague_private.p6a_source_identity();
create trigger p6a_source_identity before update on public."PYRUnibague_Assignments" for each row execute function pyr_unibague_private.p6a_source_identity();

-- Atomic primary-contact replacement, under existing manager RLS (no bypass).
create function public.pyr_unibague_save_organization_contact(
 p_organization_id uuid,p_full_name text,p_id uuid default null,p_position_title text default null,
 p_email text default null,p_phone text default null,p_user_id uuid default null,p_is_primary boolean default false
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
 if auth.uid() is null or not (public.pyr_unibague_has_role('ADMIN') or public.pyr_unibague_can_manage_org(p_organization_id)) then
  raise exception 'Organization manager required' using errcode='42501';
 end if;
 perform 1 from public."PYRUnibague_Organizations" where id=p_organization_id for update;
 if not found then raise exception 'Organization not found' using errcode='P0002'; end if;
 if p_id is not null and not exists(select 1 from public."PYRUnibague_OrganizationContacts" where id=p_id and organization_id=p_organization_id) then
  raise exception 'Contact not found' using errcode='P0002';
 end if;
 if p_is_primary then update public."PYRUnibague_OrganizationContacts" set is_primary=false where organization_id=p_organization_id and is_primary and id is distinct from p_id; end if;
 if p_id is null then
  insert into public."PYRUnibague_OrganizationContacts"(organization_id,full_name,position_title,email,phone,user_id,is_primary)
  values(p_organization_id,btrim(p_full_name),nullif(btrim(p_position_title),''),nullif(btrim(p_email),''),nullif(btrim(p_phone),''),p_user_id,p_is_primary) returning id into result;
 else
  update public."PYRUnibague_OrganizationContacts" set full_name=btrim(p_full_name),position_title=nullif(btrim(p_position_title),''),
   email=nullif(btrim(p_email),''),phone=nullif(btrim(p_phone),''),user_id=p_user_id,is_primary=p_is_primary where id=p_id returning id into result;
 end if;
 return result;
end $$;

-- Project only the academic/professional fields needed for advising. No documents,
-- ARL, private case notes, tax IDs, student codes, Auth IDs or profile links.
create function public.pyr_unibague_advisor_workspace(p_academic_period_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare staff uuid; result jsonb;
begin
 if auth.uid() is null or not public.pyr_unibague_has_role('ADVISOR') then raise exception 'ADVISOR required' using errcode='42501'; end if;
 select id into staff from public."PYRUnibague_StaffProfiles" where user_id=auth.uid() and status='active';
 if staff is null then raise exception 'Active staff profile required' using errcode='42501'; end if;
 select jsonb_build_object(
  'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',coalesce(o.display_name,o.legal_name),'description',o.description,
   'starts_on',a.starts_on,'contacts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'full_name',c.full_name,'position_title',c.position_title,'email',c.email,'phone',c.phone,'is_primary',c.is_primary) order by c.is_primary desc,c.full_name,c.id)
    from public."PYRUnibague_OrganizationContacts" c where c.organization_id=o.id),'[]'::jsonb)) order by o.legal_name,o.id)
   from public."PYRUnibague_AdvisorOrganizationAssignments" a join public."PYRUnibague_Organizations" o on o.id=a.organization_id
   where a.advisor_id=staff and a.academic_period_id=p_academic_period_id and a.is_current),'[]'::jsonb),
  'students',coalesce((select jsonb_agg(jsonb_build_object('participation_id',sp.id,'name',coalesce(u.display_name,'Estudiante'),
   'program',ap.name,'semester',s.current_semester,'bio',s.bio,'desired_work_description',s.desired_work_description,'starts_on',a.starts_on,
   'experiences',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'organization_name',e.organization_name,'description',e.description,'started_on',e.started_on,'ended_on',e.ended_on,'is_current',e.is_current) order by e.started_on desc,e.id) from public."PYRUnibague_StudentExperiences" e where e.student_id=s.id),'[]'::jsonb),
   'skills',coalesce((select jsonb_agg(jsonb_build_object('id',ss.id,'name',sk.name,'evidence_text',ss.evidence_text) order by sk.name,ss.id) from public."PYRUnibague_StudentSkills" ss join public."PYRUnibague_Skills" sk on sk.id=ss.skill_id where ss.student_id=s.id),'[]'::jsonb),
   'interests',coalesce((select jsonb_agg(jsonb_build_object('id',si.id,'label',si.label,'description',si.description) order by si.sort_order,si.id) from public."PYRUnibague_StudentInterests" si where si.student_id=s.id),'[]'::jsonb)) order by u.display_name,sp.id)
   from public."PYRUnibague_AdvisorStudentAssignments" a join public."PYRUnibague_StudentPeriodParticipations" sp on sp.id=a.participation_id
   join public."PYRUnibague_Students" s on s.id=sp.student_id left join public."PYRUnibague_UserProfiles" u on u.user_id=s.user_id
   left join public."PYRUnibague_AcademicPrograms" ap on ap.id=s.academic_program_id
   where a.advisor_id=staff and a.is_current and sp.academic_period_id=p_academic_period_id),'[]'::jsonb),
  'projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'summary',p.summary,'description',p.description,
   'organization_id',p.organization_id,'organization_name',coalesce(o.display_name,o.legal_name),'modality',p.modality,'municipality',m.municipality_name,
   'interlocutors',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'full_name',c.full_name,'position_title',c.position_title,'email',c.email,'phone',c.phone,'is_primary',pi.is_primary_for_project) order by pi.is_primary_for_project desc,c.full_name,c.id)
    from public."PYRUnibague_ProjectInterlocutors" pi join public."PYRUnibague_OrganizationContacts" c on c.id=pi.organization_contact_id where pi.project_id=p.id),'[]'::jsonb)) order by p.name,p.id)
   from public."PYRUnibague_Projects" p join public."PYRUnibague_Organizations" o on o.id=p.organization_id
   left join public."PYRUnibague_Municipalities" m on m.id=p.municipality_id
   where p.academic_period_id=p_academic_period_id and pyr_unibague_private.advisor_for_project(p.id)),'[]'::jsonb)
 ) into result;
 return result;
end $$;

-- Uniform timestamps, audit of field names only, RLS, explicit grants and FK indexes.
do $$
declare t text; col record;
begin
 foreach t in array array['StaffProfiles','OrganizationContacts','AdvisorOrganizationAssignments','AdvisorStudentAssignments','StudentSpecialCases','ProjectTechnicalTeachers','ProjectInterlocutors','ProjectParticipatingOrganizations'] loop
  execute format('alter table public.%I enable row level security','PYRUnibague_'||t);
  execute format('revoke all on public.%I from public,anon,authenticated','PYRUnibague_'||t);
  execute format('grant select on public.%I to authenticated','PYRUnibague_'||t);
  if t not in ('AdvisorOrganizationAssignments','AdvisorStudentAssignments') then
   execute format('grant insert,update,delete on public.%I to authenticated','PYRUnibague_'||t);
   execute format('create policy admin_manage on public.%I for all to authenticated using (public.pyr_unibague_has_role(''ADMIN'')) with check (public.pyr_unibague_has_role(''ADMIN''))','PYRUnibague_'||t);
  else
   execute format('create policy admin_read on public.%I for select to authenticated using (public.pyr_unibague_has_role(''ADMIN''))','PYRUnibague_'||t);
   execute format('create trigger p6a_history before update or delete on public.%I for each row execute function pyr_unibague_private.advisor_history_guard()','PYRUnibague_'||t);
   execute format('create trigger p6a_insert before insert on public.%I for each row execute function pyr_unibague_private.advisor_insert_guard()','PYRUnibague_'||t);
  end if;
  if t<>'ProjectParticipatingOrganizations' then
   execute format('create trigger touch_updated_at before update on public.%I for each row execute function pyr_unibague_private.touch_updated_at()','PYRUnibague_'||t);
  end if;
  execute format('create trigger p6a_audit after insert or update or delete on public.%I for each row execute function pyr_unibague_private.audit_operation()','PYRUnibague_'||t);
  for col in select a.attname from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
   where c.contype='f' and c.conrelid=format('public.%I','PYRUnibague_'||t)::regclass loop
   execute format('create index on public.%I (%I)','PYRUnibague_'||t,col.attname);
  end loop;
 end loop;
 foreach t in array array['ProjectTechnicalTeachers','ProjectInterlocutors','ProjectParticipatingOrganizations'] loop
  execute format('create policy org_read on public.%I for select to authenticated using (pyr_unibague_private.project_access(project_id,false))','PYRUnibague_'||t);
  execute format('create policy org_manage on public.%I for all to authenticated using (pyr_unibague_private.project_access(project_id,true)) with check (pyr_unibague_private.project_access(project_id,true))','PYRUnibague_'||t);
  execute format('create policy advisor_read on public.%I for select to authenticated using (pyr_unibague_private.advisor_for_project(project_id))','PYRUnibague_'||t);
  execute format('create trigger p6a_relation before insert or update or delete on public.%I for each row execute function pyr_unibague_private.p6a_relation_guard()','PYRUnibague_'||t);
 end loop;
end $$;
create policy org_read on public."PYRUnibague_OrganizationContacts" for select to authenticated using (public.pyr_unibague_is_org_member(organization_id));
create policy org_manage on public."PYRUnibague_OrganizationContacts" for all to authenticated using (public.pyr_unibague_can_manage_org(organization_id)) with check (public.pyr_unibague_can_manage_org(organization_id));
create policy advisor_self on public."PYRUnibague_StaffProfiles" for select to authenticated using (user_id=auth.uid() and public.pyr_unibague_has_role('ADVISOR'));
create policy advisor_self on public."PYRUnibague_AdvisorOrganizationAssignments" for select to authenticated using (
 is_current and public.pyr_unibague_has_role('ADVISOR') and exists(select 1 from public."PYRUnibague_StaffProfiles" s where s.id=advisor_id and s.user_id=auth.uid() and s.status='active'));
create policy org_current on public."PYRUnibague_AdvisorOrganizationAssignments" for select to authenticated using (is_current and public.pyr_unibague_is_org_member(organization_id));
create policy advisor_self on public."PYRUnibague_AdvisorStudentAssignments" for select to authenticated using (
 is_current and public.pyr_unibague_has_role('ADVISOR') and exists(select 1 from public."PYRUnibague_StaffProfiles" s where s.id=advisor_id and s.user_id=auth.uid() and s.status='active'));

-- Special-case reviewer is derived from the authenticated administrative actor.
create function pyr_unibague_private.special_case_actor() returns trigger
language plpgsql set search_path = '' as $$
begin
 if auth.uid() is not null then
  if not public.pyr_unibague_has_role('ADMIN') then raise exception 'ADMIN required' using errcode='42501'; end if;
  new.reviewed_by=auth.uid();
 end if;
 return new;
end $$;
create trigger p6a_case_actor before insert or update on public."PYRUnibague_StudentSpecialCases" for each row execute function pyr_unibague_private.special_case_actor();

revoke all on function pyr_unibague_private.advisor_insert_guard(),pyr_unibague_private.advisor_history_guard(),pyr_unibague_private.p6a_relation_guard(),pyr_unibague_private.p6a_parent_guard(),pyr_unibague_private.p6a_staff_identity(),pyr_unibague_private.p6a_source_identity(),pyr_unibague_private.special_case_actor() from public,anon,authenticated;
revoke all on function pyr_unibague_private.advisor_for_org(uuid,uuid),pyr_unibague_private.advisor_for_project(uuid) from public,anon;
grant execute on function pyr_unibague_private.advisor_for_org(uuid,uuid),pyr_unibague_private.advisor_for_project(uuid) to authenticated;
revoke all on function public.pyr_unibague_change_organization_advisor(uuid,uuid,uuid,date),public.pyr_unibague_change_student_advisor(uuid,uuid,date,text,uuid),public.pyr_unibague_save_organization_contact(uuid,text,uuid,text,text,text,uuid,boolean),public.pyr_unibague_advisor_workspace(uuid) from public,anon;
grant execute on function public.pyr_unibague_change_organization_advisor(uuid,uuid,uuid,date),public.pyr_unibague_change_student_advisor(uuid,uuid,date,text,uuid),public.pyr_unibague_save_organization_contact(uuid,text,uuid,text,text,text,uuid,boolean),public.pyr_unibague_advisor_workspace(uuid) to authenticated;
commit;
