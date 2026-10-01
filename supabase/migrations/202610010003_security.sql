begin;
create schema if not exists pyr_unibague_private;
revoke all on schema pyr_unibague_private from public;
grant usage on schema pyr_unibague_private to authenticated;

create function public.pyr_unibague_has_role(role_code text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public."PYRUnibague_UserRoles" ur
 join public."PYRUnibague_Roles" r on r.id = ur.role_id
 where ur.user_id = auth.uid() and r.code = role_code);
$$;
create function public.pyr_unibague_current_roles() returns setof text
language sql stable security definer set search_path = '' as $$
 select r.code from public."PYRUnibague_UserRoles" ur
 join public."PYRUnibague_Roles" r on r.id = ur.role_id
 where ur.user_id = auth.uid() order by r.code;
$$;
create function public.pyr_unibague_is_student_owner(student_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.pyr_unibague_has_role('STUDENT') and exists
 (select 1 from public."PYRUnibague_Students" s where s.id = student_id and s.user_id = auth.uid());
$$;
-- 'active' is a technical access marker, not an institutional review workflow.
create function public.pyr_unibague_is_org_member(organization_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.pyr_unibague_has_role('ORGANIZATION') and exists
 (select 1 from public."PYRUnibague_OrganizationMembers" m
 where m.organization_id = $1 and m.user_id = auth.uid() and m.status = 'active');
$$;
create function public.pyr_unibague_can_manage_org(organization_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.pyr_unibague_has_role('ORGANIZATION') and exists
 (select 1 from public."PYRUnibague_OrganizationMembers" m
 where m.organization_id = $1 and m.user_id = auth.uid() and m.status = 'active' and m.can_manage);
$$;
create function pyr_unibague_private.project_access(project_id uuid, manage boolean) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public."PYRUnibague_Projects" p where p.id = $1 and
 case when manage then public.pyr_unibague_can_manage_org(p.organization_id)
 else public.pyr_unibague_is_org_member(p.organization_id) end);
$$;
create function pyr_unibague_private.position_access(position_id uuid, manage boolean) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public."PYRUnibague_ProjectPositions" p where p.id = $1
 and pyr_unibague_private.project_access(p.project_id, manage));
$$;
create function pyr_unibague_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create function pyr_unibague_private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public."PYRUnibague_UserProfiles" (user_id, display_name)
 values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name'), 200))
 on conflict (user_id) do nothing;
 return new;
end;
$$;
create trigger pyr_unibague_auth_profile after insert on auth.users
for each row execute function pyr_unibague_private.create_profile();
-- Backfill existing identities without deriving any role from their metadata.
insert into public."PYRUnibague_UserProfiles" (user_id, display_name)
select id, left(coalesce(raw_user_meta_data->>'display_name', raw_user_meta_data->>'name'), 200)
from auth.users on conflict (user_id) do nothing;

create function pyr_unibague_private.protect_fields() returns trigger
language plpgsql set search_path = '' as $$
declare field text;
begin
 if current_user in ('postgres', 'service_role', 'supabase_admin') or public.pyr_unibague_has_role('ADMIN') then return new; end if;
 foreach field in array TG_ARGV loop
  if to_jsonb(new)->field is distinct from to_jsonb(old)->field then
   raise exception 'Protected application field' using errcode = '42501';
  end if;
 end loop;
 return new;
end;
$$;
create function pyr_unibague_private.protect_student_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
 if current_user in ('postgres', 'service_role', 'supabase_admin') or public.pyr_unibague_has_role('ADMIN') then return new; end if;
 if not new.is_active then
  raise exception 'Institutional fields require administrator' using errcode = '42501';
 end if;
 return new;
end;
$$;
create trigger protect_student_insert before insert on public."PYRUnibague_Students"
for each row execute function pyr_unibague_private.protect_student_insert();
create trigger protect_student_fields before update on public."PYRUnibague_Students"
for each row execute function pyr_unibague_private.protect_fields('id','user_id','is_active','created_at');
create trigger protect_profile_fields before update on public."PYRUnibague_UserProfiles"
for each row execute function pyr_unibague_private.protect_fields('user_id','created_at');
create trigger protect_organization_fields before update on public."PYRUnibague_Organizations"
for each row execute function pyr_unibague_private.protect_fields('id','status','verified_at','verified_by','created_by','created_at');

create function pyr_unibague_private.validate_document() returns trigger
language plpgsql set search_path = '' as $$
declare parent_id uuid; expected_bucket text;
begin
 if TG_TABLE_NAME = 'PYRUnibague_StudentDocuments' then
  parent_id = new.student_id; expected_bucket = 'pyrunibague-student-documents';
 else parent_id = new.organization_id; expected_bucket = 'pyrunibague-organization-documents'; end if;
 if new.bucket_id <> expected_bucket or split_part(new.object_path, '/', 1) <> parent_id::text
 or split_part(new.object_path, '/', 2) <> new.id::text or split_part(new.object_path, '/', 3) <> new.file_name
 or new.file_name in ('', '.', '..') or new.file_name ~ '[/\\]' or array_length(string_to_array(new.object_path, '/'), 1) <> 3 then
  raise exception 'Invalid private document path' using errcode = '23514';
 end if;
 if current_user not in ('postgres', 'service_role', 'supabase_admin') and not public.pyr_unibague_has_role('ADMIN')
 and new.uploaded_by is distinct from auth.uid() then
  raise exception 'Invalid uploader' using errcode = '42501';
 end if;
 return new;
end;
$$;
create function pyr_unibague_private.audit_operation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare fields text[]; row_id uuid;
begin
 row_id = case when TG_OP = 'DELETE' then old.id else new.id end;
 if TG_OP = 'UPDATE' then
  select coalesce(array_agg(n.key order by n.key), '{}'::text[]) into fields
  from jsonb_each(to_jsonb(new)) n where n.key <> 'updated_at' and n.value is distinct from to_jsonb(old)->n.key;
  if cardinality(fields) = 0 then return null; end if;
 else
  select array_agg(key order by key) into fields from jsonb_object_keys(case when TG_OP = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) key;
 end if;
 insert into public."PYRUnibague_AuditLogs" (actor_user_id, action, entity_table, entity_id, changed_fields)
 values (auth.uid(), TG_OP, TG_TABLE_NAME, row_id, fields);
 return null;
end;
$$;
create function public.pyr_unibague_mark_notification_read(notification_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
 update public."PYRUnibague_Notifications" set read_at = coalesce(read_at, now())
 where id = notification_id and user_id = auth.uid();
 get diagnostics affected = row_count;
 return affected = 1;
end;
$$;


alter table public."PYRUnibague_UserProfiles" enable row level security;

revoke all on public."PYRUnibague_UserProfiles" from anon, authenticated;

grant select on public."PYRUnibague_UserProfiles" to authenticated;

grant insert, update, delete on public."PYRUnibague_UserProfiles" to authenticated;

create policy "admin_manage" on public."PYRUnibague_UserProfiles" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_UserProfiles" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_Roles" enable row level security;

revoke all on public."PYRUnibague_Roles" from anon, authenticated;

grant select on public."PYRUnibague_Roles" to authenticated;

grant insert, update, delete on public."PYRUnibague_Roles" to authenticated;

create policy "admin_manage" on public."PYRUnibague_Roles" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_Roles" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_UserRoles" enable row level security;

revoke all on public."PYRUnibague_UserRoles" from anon, authenticated;

grant select on public."PYRUnibague_UserRoles" to authenticated;

grant insert, update, delete on public."PYRUnibague_UserRoles" to authenticated;

create policy "admin_manage" on public."PYRUnibague_UserRoles" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

alter table public."PYRUnibague_AcademicPeriods" enable row level security;

revoke all on public."PYRUnibague_AcademicPeriods" from anon, authenticated;

grant select on public."PYRUnibague_AcademicPeriods" to authenticated;

grant insert, update, delete on public."PYRUnibague_AcademicPeriods" to authenticated;

create policy "admin_manage" on public."PYRUnibague_AcademicPeriods" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_AcademicPeriods" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_AcademicPrograms" enable row level security;

revoke all on public."PYRUnibague_AcademicPrograms" from anon, authenticated;

grant select on public."PYRUnibague_AcademicPrograms" to authenticated;

grant insert, update, delete on public."PYRUnibague_AcademicPrograms" to authenticated;

create policy "admin_manage" on public."PYRUnibague_AcademicPrograms" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_AcademicPrograms" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_Municipalities" enable row level security;

revoke all on public."PYRUnibague_Municipalities" from anon, authenticated;

grant select on public."PYRUnibague_Municipalities" to authenticated;

grant insert, update, delete on public."PYRUnibague_Municipalities" to authenticated;

create policy "admin_manage" on public."PYRUnibague_Municipalities" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_Municipalities" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_OrganizationTypes" enable row level security;

revoke all on public."PYRUnibague_OrganizationTypes" from anon, authenticated;

grant select on public."PYRUnibague_OrganizationTypes" to authenticated;

grant insert, update, delete on public."PYRUnibague_OrganizationTypes" to authenticated;

create policy "admin_manage" on public."PYRUnibague_OrganizationTypes" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_OrganizationTypes" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_Skills" enable row level security;

revoke all on public."PYRUnibague_Skills" from anon, authenticated;

grant select on public."PYRUnibague_Skills" to authenticated;

grant insert, update, delete on public."PYRUnibague_Skills" to authenticated;

create policy "admin_manage" on public."PYRUnibague_Skills" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_Skills" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_SystemConfigurations" enable row level security;

revoke all on public."PYRUnibague_SystemConfigurations" from anon, authenticated;

grant select on public."PYRUnibague_SystemConfigurations" to authenticated;

grant insert, update, delete on public."PYRUnibague_SystemConfigurations" to authenticated;

create policy "admin_manage" on public."PYRUnibague_SystemConfigurations" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_SystemConfigurations" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_FeatureFlags" enable row level security;

revoke all on public."PYRUnibague_FeatureFlags" from anon, authenticated;

grant select on public."PYRUnibague_FeatureFlags" to authenticated;

grant insert, update, delete on public."PYRUnibague_FeatureFlags" to authenticated;

create policy "admin_manage" on public."PYRUnibague_FeatureFlags" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_FeatureFlags" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_Students" enable row level security;

revoke all on public."PYRUnibague_Students" from anon, authenticated;

grant select on public."PYRUnibague_Students" to authenticated;

grant insert, update, delete on public."PYRUnibague_Students" to authenticated;

create policy "admin_manage" on public."PYRUnibague_Students" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_Students" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_StudentPeriodParticipations" enable row level security;

revoke all on public."PYRUnibague_StudentPeriodParticipations" from anon, authenticated;

grant select on public."PYRUnibague_StudentPeriodParticipations" to authenticated;

grant insert, update, delete on public."PYRUnibague_StudentPeriodParticipations" to authenticated;

create policy "admin_manage" on public."PYRUnibague_StudentPeriodParticipations" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_StudentPeriodParticipations" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_StudentExperiences" enable row level security;

revoke all on public."PYRUnibague_StudentExperiences" from anon, authenticated;

grant select on public."PYRUnibague_StudentExperiences" to authenticated;

grant insert, update, delete on public."PYRUnibague_StudentExperiences" to authenticated;

create policy "admin_manage" on public."PYRUnibague_StudentExperiences" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_StudentExperiences" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_StudentSkills" enable row level security;

revoke all on public."PYRUnibague_StudentSkills" from anon, authenticated;

grant select on public."PYRUnibague_StudentSkills" to authenticated;

grant insert, update, delete on public."PYRUnibague_StudentSkills" to authenticated;

create policy "admin_manage" on public."PYRUnibague_StudentSkills" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_StudentSkills" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_StudentInterests" enable row level security;

revoke all on public."PYRUnibague_StudentInterests" from anon, authenticated;

grant select on public."PYRUnibague_StudentInterests" to authenticated;

grant insert, update, delete on public."PYRUnibague_StudentInterests" to authenticated;

create policy "admin_manage" on public."PYRUnibague_StudentInterests" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_StudentInterests" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_StudentLocationPreferences" enable row level security;

revoke all on public."PYRUnibague_StudentLocationPreferences" from anon, authenticated;

grant select on public."PYRUnibague_StudentLocationPreferences" to authenticated;

grant insert, update, delete on public."PYRUnibague_StudentLocationPreferences" to authenticated;

create policy "admin_manage" on public."PYRUnibague_StudentLocationPreferences" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_StudentLocationPreferences" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_StudentDocuments" enable row level security;

revoke all on public."PYRUnibague_StudentDocuments" from anon, authenticated;

grant select on public."PYRUnibague_StudentDocuments" to authenticated;

grant insert, update, delete on public."PYRUnibague_StudentDocuments" to authenticated;

create policy "admin_manage" on public."PYRUnibague_StudentDocuments" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_StudentDocuments" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_Organizations" enable row level security;

revoke all on public."PYRUnibague_Organizations" from anon, authenticated;

grant select on public."PYRUnibague_Organizations" to authenticated;

grant insert, update, delete on public."PYRUnibague_Organizations" to authenticated;

create policy "admin_manage" on public."PYRUnibague_Organizations" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_Organizations" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_OrganizationMembers" enable row level security;

revoke all on public."PYRUnibague_OrganizationMembers" from anon, authenticated;

grant select on public."PYRUnibague_OrganizationMembers" to authenticated;

grant insert, update, delete on public."PYRUnibague_OrganizationMembers" to authenticated;

create policy "admin_manage" on public."PYRUnibague_OrganizationMembers" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_OrganizationMembers" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_OrganizationDocuments" enable row level security;

revoke all on public."PYRUnibague_OrganizationDocuments" from anon, authenticated;

grant select on public."PYRUnibague_OrganizationDocuments" to authenticated;

grant insert, update, delete on public."PYRUnibague_OrganizationDocuments" to authenticated;

create policy "admin_manage" on public."PYRUnibague_OrganizationDocuments" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_OrganizationDocuments" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_OrganizationReviews" enable row level security;

revoke all on public."PYRUnibague_OrganizationReviews" from anon, authenticated;

grant select on public."PYRUnibague_OrganizationReviews" to authenticated;

grant insert, update, delete on public."PYRUnibague_OrganizationReviews" to authenticated;

create policy "admin_manage" on public."PYRUnibague_OrganizationReviews" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

alter table public."PYRUnibague_Projects" enable row level security;

revoke all on public."PYRUnibague_Projects" from anon, authenticated;

grant select on public."PYRUnibague_Projects" to authenticated;

grant insert, update, delete on public."PYRUnibague_Projects" to authenticated;

create policy "admin_manage" on public."PYRUnibague_Projects" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_Projects" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_ProjectPositions" enable row level security;

revoke all on public."PYRUnibague_ProjectPositions" from anon, authenticated;

grant select on public."PYRUnibague_ProjectPositions" to authenticated;

grant insert, update, delete on public."PYRUnibague_ProjectPositions" to authenticated;

create policy "admin_manage" on public."PYRUnibague_ProjectPositions" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_ProjectPositions" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_ProjectPositionPrograms" enable row level security;

revoke all on public."PYRUnibague_ProjectPositionPrograms" from anon, authenticated;

grant select on public."PYRUnibague_ProjectPositionPrograms" to authenticated;

grant insert, update, delete on public."PYRUnibague_ProjectPositionPrograms" to authenticated;

create policy "admin_manage" on public."PYRUnibague_ProjectPositionPrograms" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_ProjectPositionPrograms" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_ProjectRequirements" enable row level security;

revoke all on public."PYRUnibague_ProjectRequirements" from anon, authenticated;

grant select on public."PYRUnibague_ProjectRequirements" to authenticated;

grant insert, update, delete on public."PYRUnibague_ProjectRequirements" to authenticated;

create policy "admin_manage" on public."PYRUnibague_ProjectRequirements" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_ProjectRequirements" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_ProjectPositionSkills" enable row level security;

revoke all on public."PYRUnibague_ProjectPositionSkills" from anon, authenticated;

grant select on public."PYRUnibague_ProjectPositionSkills" to authenticated;

grant insert, update, delete on public."PYRUnibague_ProjectPositionSkills" to authenticated;

create policy "admin_manage" on public."PYRUnibague_ProjectPositionSkills" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_ProjectPositionSkills" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_MatchingConfigurations" enable row level security;

revoke all on public."PYRUnibague_MatchingConfigurations" from anon, authenticated;

grant select on public."PYRUnibague_MatchingConfigurations" to authenticated;

grant insert, update, delete on public."PYRUnibague_MatchingConfigurations" to authenticated;

create policy "admin_manage" on public."PYRUnibague_MatchingConfigurations" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_MatchingConfigurations" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_MatchingRuns" enable row level security;

revoke all on public."PYRUnibague_MatchingRuns" from anon, authenticated;

grant select on public."PYRUnibague_MatchingRuns" to authenticated;

grant insert, update, delete on public."PYRUnibague_MatchingRuns" to authenticated;

create policy "admin_manage" on public."PYRUnibague_MatchingRuns" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

alter table public."PYRUnibague_MatchCandidates" enable row level security;

revoke all on public."PYRUnibague_MatchCandidates" from anon, authenticated;

grant select on public."PYRUnibague_MatchCandidates" to authenticated;

grant insert, update, delete on public."PYRUnibague_MatchCandidates" to authenticated;

create policy "admin_manage" on public."PYRUnibague_MatchCandidates" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

alter table public."PYRUnibague_Assignments" enable row level security;

revoke all on public."PYRUnibague_Assignments" from anon, authenticated;

grant select on public."PYRUnibague_Assignments" to authenticated;

grant insert, update, delete on public."PYRUnibague_Assignments" to authenticated;

create policy "admin_manage" on public."PYRUnibague_Assignments" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

create trigger touch_updated_at before update on public."PYRUnibague_Assignments" for each row execute function pyr_unibague_private.touch_updated_at();

alter table public."PYRUnibague_AssignmentEvents" enable row level security;

revoke all on public."PYRUnibague_AssignmentEvents" from anon, authenticated;

grant select on public."PYRUnibague_AssignmentEvents" to authenticated;

grant insert, update, delete on public."PYRUnibague_AssignmentEvents" to authenticated;

create policy "admin_manage" on public."PYRUnibague_AssignmentEvents" for all to authenticated using (public.pyr_unibague_has_role('ADMIN')) with check (public.pyr_unibague_has_role('ADMIN'));

alter table public."PYRUnibague_Notifications" enable row level security;

revoke all on public."PYRUnibague_Notifications" from anon, authenticated;

grant select on public."PYRUnibague_Notifications" to authenticated;

create policy "admin_read" on public."PYRUnibague_Notifications" for select to authenticated using (public.pyr_unibague_has_role('ADMIN'));

grant insert, delete on public."PYRUnibague_Notifications" to authenticated;

create policy "admin_create" on public."PYRUnibague_Notifications" for insert to authenticated with check (public.pyr_unibague_has_role('ADMIN'));

create policy "admin_delete" on public."PYRUnibague_Notifications" for delete to authenticated using (public.pyr_unibague_has_role('ADMIN'));

alter table public."PYRUnibague_AuditLogs" enable row level security;

revoke all on public."PYRUnibague_AuditLogs" from anon, authenticated;

grant select on public."PYRUnibague_AuditLogs" to authenticated;

create policy "admin_read" on public."PYRUnibague_AuditLogs" for select to authenticated using (public.pyr_unibague_has_role('ADMIN'));

create trigger audit_operation after insert or update or delete on public."PYRUnibague_UserRoles" for each row execute function pyr_unibague_private.audit_operation();

create trigger audit_operation after insert or update or delete on public."PYRUnibague_Organizations" for each row execute function pyr_unibague_private.audit_operation();

create trigger audit_operation after insert or update or delete on public."PYRUnibague_OrganizationReviews" for each row execute function pyr_unibague_private.audit_operation();

create trigger audit_operation after insert or update or delete on public."PYRUnibague_Projects" for each row execute function pyr_unibague_private.audit_operation();

create trigger audit_operation after insert or update or delete on public."PYRUnibague_ProjectPositions" for each row execute function pyr_unibague_private.audit_operation();

create trigger audit_operation after insert or update or delete on public."PYRUnibague_MatchingConfigurations" for each row execute function pyr_unibague_private.audit_operation();

create trigger audit_operation after insert or update or delete on public."PYRUnibague_Assignments" for each row execute function pyr_unibague_private.audit_operation();

create trigger validate_document before insert or update on public."PYRUnibague_StudentDocuments" for each row execute function pyr_unibague_private.validate_document();

create trigger validate_document before insert or update on public."PYRUnibague_OrganizationDocuments" for each row execute function pyr_unibague_private.validate_document();

create policy "authenticated_catalog" on public."PYRUnibague_AcademicPeriods" for select to authenticated using (true);

create policy "authenticated_catalog" on public."PYRUnibague_AcademicPrograms" for select to authenticated using (true);

create policy "authenticated_catalog" on public."PYRUnibague_Municipalities" for select to authenticated using (true);

create policy "authenticated_catalog" on public."PYRUnibague_OrganizationTypes" for select to authenticated using (true);

create policy "authenticated_catalog" on public."PYRUnibague_Skills" for select to authenticated using (true);

create policy "authenticated_catalog" on public."PYRUnibague_Roles" for select to authenticated using (true);

grant select on public."PYRUnibague_SystemConfigurations" to anon;

create policy public_configuration on public."PYRUnibague_SystemConfigurations" for select to anon, authenticated using (is_public);

grant select on public."PYRUnibague_FeatureFlags" to anon;

create policy public_configuration on public."PYRUnibague_FeatureFlags" for select to anon, authenticated using (is_public);

create policy "own_read" on public."PYRUnibague_UserProfiles" for select to authenticated using (user_id = auth.uid());

create policy "own_update" on public."PYRUnibague_UserProfiles" for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own_roles" on public."PYRUnibague_UserRoles" for select to authenticated using (user_id = auth.uid());

create policy "own_read" on public."PYRUnibague_Students" for select to authenticated using (user_id = auth.uid() and public.pyr_unibague_has_role('STUDENT'));

create policy "own_create" on public."PYRUnibague_Students" for insert to authenticated with check (user_id = auth.uid() and public.pyr_unibague_has_role('STUDENT'));

create policy "own_update" on public."PYRUnibague_Students" for update to authenticated using (user_id = auth.uid() and public.pyr_unibague_has_role('STUDENT')) with check (user_id = auth.uid() and public.pyr_unibague_has_role('STUDENT'));

create policy "own_manage" on public."PYRUnibague_StudentExperiences" for all to authenticated using (public.pyr_unibague_is_student_owner(student_id)) with check (public.pyr_unibague_is_student_owner(student_id));

create policy "own_manage" on public."PYRUnibague_StudentSkills" for all to authenticated using (public.pyr_unibague_is_student_owner(student_id)) with check (public.pyr_unibague_is_student_owner(student_id));

create policy "own_manage" on public."PYRUnibague_StudentInterests" for all to authenticated using (public.pyr_unibague_is_student_owner(student_id)) with check (public.pyr_unibague_is_student_owner(student_id));

create policy "own_manage" on public."PYRUnibague_StudentLocationPreferences" for all to authenticated using (public.pyr_unibague_is_student_owner(student_id)) with check (public.pyr_unibague_is_student_owner(student_id));

create policy "own_manage" on public."PYRUnibague_StudentDocuments" for all to authenticated using (public.pyr_unibague_is_student_owner(student_id)) with check (public.pyr_unibague_is_student_owner(student_id));

create policy "own_read" on public."PYRUnibague_StudentPeriodParticipations" for select to authenticated using (public.pyr_unibague_is_student_owner(student_id));

create policy "member_read" on public."PYRUnibague_Organizations" for select to authenticated using (public.pyr_unibague_is_org_member(id));

create policy "manager_update" on public."PYRUnibague_Organizations" for update to authenticated using (public.pyr_unibague_can_manage_org(id)) with check (public.pyr_unibague_can_manage_org(id));

create policy "member_read" on public."PYRUnibague_OrganizationMembers" for select to authenticated using (public.pyr_unibague_is_org_member(organization_id));

create policy "manager_crud" on public."PYRUnibague_OrganizationDocuments" for all to authenticated using (public.pyr_unibague_can_manage_org(organization_id)) with check (public.pyr_unibague_can_manage_org(organization_id));

create policy "member_read" on public."PYRUnibague_Projects" for select to authenticated using (public.pyr_unibague_is_org_member(organization_id));

create policy "manager_crud" on public."PYRUnibague_Projects" for all to authenticated using (public.pyr_unibague_can_manage_org(organization_id)) with check (public.pyr_unibague_can_manage_org(organization_id));

create policy "member_read" on public."PYRUnibague_ProjectPositions" for select to authenticated using (pyr_unibague_private.project_access(project_id, false));

create policy "manager_crud" on public."PYRUnibague_ProjectPositions" for all to authenticated using (pyr_unibague_private.project_access(project_id, true)) with check (pyr_unibague_private.project_access(project_id, true));

create policy "member_read" on public."PYRUnibague_ProjectPositionPrograms" for select to authenticated using (pyr_unibague_private.position_access(project_position_id, false));

create policy "manager_crud" on public."PYRUnibague_ProjectPositionPrograms" for all to authenticated using (pyr_unibague_private.position_access(project_position_id, true)) with check (pyr_unibague_private.position_access(project_position_id, true));

create policy "member_read" on public."PYRUnibague_ProjectRequirements" for select to authenticated using (pyr_unibague_private.position_access(project_position_id, false));

create policy "manager_crud" on public."PYRUnibague_ProjectRequirements" for all to authenticated using (pyr_unibague_private.position_access(project_position_id, true)) with check (pyr_unibague_private.position_access(project_position_id, true));

create policy "member_read" on public."PYRUnibague_ProjectPositionSkills" for select to authenticated using (pyr_unibague_private.position_access(project_position_id, false));

create policy "manager_crud" on public."PYRUnibague_ProjectPositionSkills" for all to authenticated using (pyr_unibague_private.position_access(project_position_id, true)) with check (pyr_unibague_private.position_access(project_position_id, true));

create policy "participant_read" on public."PYRUnibague_Assignments" for select to authenticated using (public.pyr_unibague_is_student_owner(student_id) or pyr_unibague_private.position_access(project_position_id, false));

create policy "own_read" on public."PYRUnibague_Notifications" for select to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('pyrunibague-student-documents', 'pyrunibague-student-documents', false),
('pyrunibague-organization-documents', 'pyrunibague-organization-documents', false)
on conflict (id) do update set public = false;

create function pyr_unibague_private.storage_access(bucket text, path text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare parts text[]; parent_id uuid; document_id uuid;
begin
 if bucket is null or path is null or bucket not in ('pyrunibague-student-documents', 'pyrunibague-organization-documents') or auth.uid() is null then return false; end if;
 parts = string_to_array(path, '/');
 if cardinality(parts) <> 3 or parts[3] in ('', '.', '..') or parts[3] like '%\\%' then return false; end if;
 begin parent_id = parts[1]::uuid; document_id = parts[2]::uuid;
 exception when invalid_text_representation then return false; end;
 if parts[1] <> parent_id::text or parts[2] <> document_id::text then return false; end if;
 return public.pyr_unibague_has_role('ADMIN') or
 case bucket when 'pyrunibague-student-documents' then public.pyr_unibague_is_student_owner(parent_id)
 else public.pyr_unibague_can_manage_org(parent_id) end;
end;
$$;
create policy pyr_unibague_private_documents_read on storage.objects for select to authenticated
using (pyr_unibague_private.storage_access(bucket_id, name));
create policy pyr_unibague_private_documents_insert on storage.objects for insert to authenticated
with check (pyr_unibague_private.storage_access(bucket_id, name));
create policy pyr_unibague_private_documents_update on storage.objects for update to authenticated
using (pyr_unibague_private.storage_access(bucket_id, name)) with check (pyr_unibague_private.storage_access(bucket_id, name));
create policy pyr_unibague_private_documents_delete on storage.objects for delete to authenticated
using (pyr_unibague_private.storage_access(bucket_id, name));


revoke all on function public.pyr_unibague_has_role(text) from public, anon;

grant execute on function public.pyr_unibague_has_role(text) to authenticated;

revoke all on function public.pyr_unibague_current_roles() from public, anon;

grant execute on function public.pyr_unibague_current_roles() to authenticated;

revoke all on function public.pyr_unibague_is_student_owner(uuid) from public, anon;

grant execute on function public.pyr_unibague_is_student_owner(uuid) to authenticated;

revoke all on function public.pyr_unibague_is_org_member(uuid) from public, anon;

grant execute on function public.pyr_unibague_is_org_member(uuid) to authenticated;

revoke all on function public.pyr_unibague_can_manage_org(uuid) from public, anon;

grant execute on function public.pyr_unibague_can_manage_org(uuid) to authenticated;

revoke all on function public.pyr_unibague_mark_notification_read(uuid) from public, anon;

grant execute on function public.pyr_unibague_mark_notification_read(uuid) to authenticated;

revoke all on all functions in schema pyr_unibague_private from public, anon, authenticated;

grant execute on function pyr_unibague_private.project_access(uuid, boolean) to authenticated;

grant execute on function pyr_unibague_private.position_access(uuid, boolean) to authenticated;

grant execute on function pyr_unibague_private.storage_access(text, text) to authenticated;

commit;
