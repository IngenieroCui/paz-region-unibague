-- P4 additive protections and administrative transactions. No matching/assignments.
begin;

create function pyr_unibague_private.protect_project_state() returns trigger
language plpgsql set search_path = '' as $$
begin
 if current_user in ('postgres','service_role','supabase_admin') or public.pyr_unibague_has_role('ADMIN') then
  if TG_OP='DELETE' then return old; else return new; end if;
 end if;
 if TG_OP='DELETE' then
  if old.status not in ('draft','changes_required') then raise exception 'Project is under administrative review' using errcode='42501'; end if;
  return old;
 end if;
 if TG_OP = 'INSERT' then
  if new.status <> 'draft' then raise exception 'Create projects as drafts' using errcode='42501'; end if;
  if new.created_by is distinct from auth.uid() then raise exception 'Invalid creator' using errcode='42501'; end if;
 else
  if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id
   or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
   raise exception 'Protected project identity' using errcode='42501';
  end if;
  if old.status not in ('draft','changes_required') then raise exception 'Project is under administrative review' using errcode='42501'; end if;
  if new.status not in ('draft','submitted') and new.status <> old.status then raise exception 'Administrative project state' using errcode='42501'; end if;
 end if;
 return new;
end;
$$;
create trigger p4_project_state before insert or update or delete on public."PYRUnibague_Projects"
for each row execute function pyr_unibague_private.protect_project_state();

-- Lock the parent for every child mutation; concurrent submission cannot race a profile edit.
create function pyr_unibague_private.protect_project_child() returns trigger
language plpgsql set search_path = '' as $$
declare parent uuid; previous_parent uuid; project_state text; org uuid;
begin
 if current_user in ('postgres','service_role','supabase_admin') or public.pyr_unibague_has_role('ADMIN') then
  if TG_OP='DELETE' then return old; else return new; end if;
 end if;
 if TG_TABLE_NAME='PYRUnibague_ProjectPositions' then
  if TG_OP='DELETE' then parent=old.project_id; else parent=new.project_id; end if;
  if TG_OP='UPDATE' then previous_parent=old.project_id; end if;
 else
  if TG_OP='DELETE' then
   select project_id into parent from public."PYRUnibague_ProjectPositions" where id=old.project_position_id;
  else
   select project_id into parent from public."PYRUnibague_ProjectPositions" where id=new.project_position_id;
  end if;
  if TG_OP='UPDATE' then select project_id into previous_parent from public."PYRUnibague_ProjectPositions" where id=old.project_position_id; end if;
 end if;
 if TG_OP='UPDATE' and parent is distinct from previous_parent then raise exception 'Cannot move project children' using errcode='42501'; end if;
 select status, organization_id into project_state,org from public."PYRUnibague_Projects" where id=parent for update;
 if TG_OP='DELETE' and not found then return old; end if; -- FK cascade from an authorized parent deletion.
 if parent is null or not public.pyr_unibague_can_manage_org(org) or project_state not in ('draft','changes_required') then
  raise exception 'Project profile cannot be edited' using errcode='42501';
 end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end;
$$;
create trigger p4_edit_guard before insert or update or delete on public."PYRUnibague_ProjectPositions" for each row execute function pyr_unibague_private.protect_project_child();
create trigger p4_edit_guard before insert or update or delete on public."PYRUnibague_ProjectPositionPrograms" for each row execute function pyr_unibague_private.protect_project_child();
create trigger p4_edit_guard before insert or update or delete on public."PYRUnibague_ProjectPositionSkills" for each row execute function pyr_unibague_private.protect_project_child();
create trigger p4_edit_guard before insert or update or delete on public."PYRUnibague_ProjectRequirements" for each row execute function pyr_unibague_private.protect_project_child();

create function public.pyr_unibague_review_organization(p_organization_id uuid,p_decision text,p_notes text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.pyr_unibague_has_role('ADMIN') then raise exception 'ADMIN required' using errcode='42501'; end if;
 if p_decision not in ('changes_required','approved','rejected') or p_decision is null then raise exception 'Invalid review decision' using errcode='22023'; end if;
 perform 1 from public."PYRUnibague_Organizations" where id=p_organization_id for update;
 if not found then raise exception 'Organization not found' using errcode='P0002'; end if;
 insert into public."PYRUnibague_OrganizationReviews"(organization_id,reviewer_id,decision,notes) values(p_organization_id,auth.uid(),p_decision,nullif(btrim(p_notes),''));
 update public."PYRUnibague_Organizations" set status=p_decision,
 verified_at=case when p_decision='approved' then now() else null end,
 verified_by=case when p_decision='approved' then auth.uid() else null end where id=p_organization_id;
end;
$$;

create function public.pyr_unibague_set_current_academic_period(p_period_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.pyr_unibague_has_role('ADMIN') then raise exception 'ADMIN required' using errcode='42501'; end if;
 -- Serialize with direct catalog writes too; respect the existing partial unique index.
 lock table public."PYRUnibague_AcademicPeriods" in share row exclusive mode;
 perform 1 from public."PYRUnibague_AcademicPeriods" where id=p_period_id;
 if not found then raise exception 'Academic period not found' using errcode='P0002'; end if;
 update public."PYRUnibague_AcademicPeriods" set is_current=false where is_current;
 update public."PYRUnibague_AcademicPeriods" set is_current=true where id=p_period_id;
end;
$$;

-- A role-row lock serializes membership changes under READ COMMITTED. Every operation,
-- including cascades and direct SQL updates, participates. No privilege bypass.
create function pyr_unibague_private.keep_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare admin_role uuid;
begin
 update public."PYRUnibague_Roles" set updated_at=clock_timestamp() where code='ADMIN' returning id into admin_role;
 if TG_OP='DELETE' or (TG_OP='UPDATE' and (old.role_id is distinct from new.role_id or old.user_id is distinct from new.user_id)) then
  if old.role_id=admin_role and not exists(select 1 from public."PYRUnibague_UserRoles" where role_id=admin_role and id<>old.id) then
   raise exception 'Cannot remove the last ADMIN' using errcode='23514';
  end if;
 end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end;
$$;
create trigger p4_last_admin before insert or update or delete on public."PYRUnibague_UserRoles" for each row execute function pyr_unibague_private.keep_last_admin();
create function pyr_unibague_private.keep_system_roles() returns trigger
language plpgsql set search_path = '' as $$
begin
 if old.code in ('ADMIN','STUDENT','ORGANIZATION') and (TG_OP='DELETE' or new.code is distinct from old.code or new.id is distinct from old.id) then
  raise exception 'System role identity is immutable' using errcode='23514';
 end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end;
$$;
create trigger p4_system_roles before update or delete on public."PYRUnibague_Roles" for each row execute function pyr_unibague_private.keep_system_roles();

create function public.pyr_unibague_admin_dashboard() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare period_id uuid; result jsonb;
begin
 if not public.pyr_unibague_has_role('ADMIN') then raise exception 'ADMIN required' using errcode='42501'; end if;
 select id into period_id from public."PYRUnibague_AcademicPeriods" where is_current;
 select jsonb_build_object(
 'period',(select to_jsonb(p) from public."PYRUnibague_AcademicPeriods" p where id=period_id),
 'students',(select count(*) from public."PYRUnibague_Students"),
 'participating',(select count(*) from public."PYRUnibague_StudentPeriodParticipations" where academic_period_id=period_id),
 'eligible',(select count(*) from public."PYRUnibague_StudentPeriodParticipations" where academic_period_id=period_id and eligible_for_matching),
 'organizations',(select count(*) from public."PYRUnibague_Organizations"),
 'pendingOrganizations',(select count(*) from public."PYRUnibague_Organizations" where status in ('pending_review','submitted')),
 'projects',(select count(*) from public."PYRUnibague_Projects"),
 'pendingProjects',(select count(*) from public."PYRUnibague_Projects" where status='submitted'),
 'positions',(select count(*) from public."PYRUnibague_ProjectPositions"),
 'capacity',(select coalesce(sum(capacity),0) from public."PYRUnibague_ProjectPositions"),
 'programs',(select count(*) from public."PYRUnibague_AcademicPrograms" where active),
 'municipalities',(select count(*) from public."PYRUnibague_Municipalities" where active),
 'types',(select count(*) from public."PYRUnibague_OrganizationTypes" where active),
 'skills',(select count(*) from public."PYRUnibague_Skills" where active)) into result;
 return result;
end;
$$;

-- Identity search cannot use a PostgREST embed: Students and UserProfiles reference auth.users separately.
create function public.pyr_unibague_admin_students(p_search text default '',p_program uuid default null,p_period uuid default null,p_eligible boolean default null,p_active boolean default null,p_status text default null,p_semester integer default null,p_page integer default 0) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
 if not public.pyr_unibague_has_role('ADMIN') then raise exception 'ADMIN required' using errcode='42501'; end if;
 if p_page<0 or p_page>1000000 then raise exception 'Invalid page' using errcode='22023'; end if;
 with filtered as (
 select s.*,u.display_name,u.institutional_email from public."PYRUnibague_Students" s left join public."PYRUnibague_UserProfiles" u on u.user_id=s.user_id
 where (p_search='' or position(lower(p_search) in lower(concat_ws(' ',s.student_code,u.display_name,u.institutional_email)))>0)
 and (p_program is null or s.academic_program_id=p_program) and (p_active is null or s.is_active=p_active)
 and (p_semester is null or s.current_semester=p_semester)
 and ((p_period is null and p_eligible is null and p_status is null) or exists(select 1 from public."PYRUnibague_StudentPeriodParticipations" sp where sp.student_id=s.id and (p_period is null or sp.academic_period_id=p_period) and (p_eligible is null or sp.eligible_for_matching=p_eligible) and (p_status is null or sp.status=p_status)))
 ), paged as (select * from filtered order by created_at desc,id limit 25 offset p_page*25)
 select jsonb_build_object('count',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(p)) from paged p),'[]'::jsonb)) into result;
 return result;
end;
$$;

create function public.pyr_unibague_project_totals(p_project_ids uuid[]) returns table(project_id uuid,total_capacity bigint)
language sql stable security invoker set search_path = '' as $$
 select project_id,sum(capacity)::bigint from public."PYRUnibague_ProjectPositions"
 where project_id=any(p_project_ids[1:25]) group by project_id;
$$;
revoke all on function public.pyr_unibague_project_totals(uuid[]) from public,anon;
grant execute on function public.pyr_unibague_project_totals(uuid[]) to authenticated;
revoke all on function public.pyr_unibague_review_organization(uuid,text,text) from public,anon;
grant execute on function public.pyr_unibague_review_organization(uuid,text,text) to authenticated;
revoke all on function public.pyr_unibague_set_current_academic_period(uuid) from public,anon;
grant execute on function public.pyr_unibague_set_current_academic_period(uuid) to authenticated;
revoke all on function public.pyr_unibague_admin_dashboard() from public,anon;
grant execute on function public.pyr_unibague_admin_dashboard() to authenticated;
revoke all on function public.pyr_unibague_admin_students(text,uuid,uuid,boolean,boolean,text,integer,integer) from public,anon;
grant execute on function public.pyr_unibague_admin_students(text,uuid,uuid,boolean,boolean,text,integer,integer) to authenticated;
revoke all on function pyr_unibague_private.protect_project_state(),pyr_unibague_private.protect_project_child(),pyr_unibague_private.keep_last_admin(),pyr_unibague_private.keep_system_roles() from public,anon,authenticated;
commit;
