-- P6-B, reserved 009. Exact v0.4 columns; no A/C tables or assignment creation.
begin;
alter table public."PYRUnibague_Projects" add column zone_type text
  check (zone_type is null or zone_type in ('rural','urban'));

create table public."PYRUnibague_Calls" (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public."PYRUnibague_Organizations"(id) on delete restrict,
 academic_period_id uuid not null references public."PYRUnibague_AcademicPeriods"(id) on delete restrict,
 title text not null check (length(btrim(title)) between 1 and 240), details text,
 opens_at timestamptz, closes_at timestamptz,
 status text not null default 'draft' check (status in ('draft','submitted','changes_required','open','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (opens_at is null or closes_at is null or closes_at >= opens_at)
);
create index on public."PYRUnibague_Calls"(organization_id,academic_period_id,status);
create index on public."PYRUnibague_Calls"(academic_period_id);
create table public."PYRUnibague_CallPositions" (
 id uuid primary key default gen_random_uuid(),
 call_id uuid not null references public."PYRUnibague_Calls"(id) on delete restrict,
 project_position_id uuid not null references public."PYRUnibague_ProjectPositions"(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(call_id,project_position_id)
);
create index on public."PYRUnibague_CallPositions"(project_position_id);
create table public."PYRUnibague_Groups" (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public."PYRUnibague_Projects"(id) on delete restrict,
 name text not null check (length(btrim(name)) between 1 and 240),
 status text not null default 'active' check (status in ('active','closed')),
 started_on date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index p6b_group_name on public."PYRUnibague_Groups"(project_id,lower(btrim(name)));
create table public."PYRUnibague_GroupMembers" (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public."PYRUnibague_Groups"(id) on delete restrict,
 assignment_id uuid not null references public."PYRUnibague_Assignments"(id) on delete restrict,
 joined_on date, left_on date,
 status text not null default 'active' check(status in ('active','inactive')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (left_on is null or joined_on is null or left_on >= joined_on),
 check ((status='active' and left_on is null) or (status='inactive' and left_on is not null))
);
create index on public."PYRUnibague_GroupMembers"(group_id);
create index on public."PYRUnibague_GroupMembers"(assignment_id);
create unique index p6b_one_active_group on public."PYRUnibague_GroupMembers"(assignment_id) where status='active';

create function pyr_unibague_private.p6b_call_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.id<>old.id or new.organization_id<>old.organization_id or new.created_at<>old.created_at then
   raise exception 'Immutable call identity' using errcode='23514';
  end if;
  if new.academic_period_id<>old.academic_period_id and exists(select 1 from public."PYRUnibague_CallPositions" where call_id=old.id) then
   raise exception 'Detach positions before changing period' using errcode='23514';
  end if;
 end if;
 if current_user not in ('postgres','service_role','supabase_admin') and not public.pyr_unibague_has_role('ADMIN') then
  if TG_OP='INSERT' and new.status<>'draft' then raise exception 'Create a draft' using errcode='42501'; end if;
  if TG_OP='UPDATE' then
   if old.status in ('draft','changes_required') then
    if new.status not in ('draft','submitted','open','closed',old.status) then raise exception 'Administrative state' using errcode='42501'; end if;
   elsif new.status<>'closed' or (to_jsonb(new)-'status'-'updated_at') is distinct from (to_jsonb(old)-'status'-'updated_at') then
    raise exception 'Only closing is allowed after publication/submission' using errcode='42501';
   end if;
  end if;
 end if;
 if new.status in ('submitted','open') and (TG_OP='INSERT' or new.status is distinct from old.status)
 and not exists(select 1 from public."PYRUnibague_CallPositions" where call_id=new.id) then
  raise exception 'A call needs at least one position' using errcode='23514';
 end if;
 return new;
end $$;
create trigger p6b_call_guard before insert or update on public."PYRUnibague_Calls"
for each row execute function pyr_unibague_private.p6b_call_guard();

create function pyr_unibague_private.p6b_call_position_guard() returns trigger
language plpgsql set search_path='' as $$
declare c public."PYRUnibague_Calls"; p public."PYRUnibague_Projects"; pos uuid;
begin
 if TG_OP='UPDATE' and (new.id<>old.id or new.call_id<>old.call_id or new.project_position_id<>old.project_position_id or new.created_at<>old.created_at) then
  raise exception 'Replace call links explicitly' using errcode='23514';
 end if;
 select * into c from public."PYRUnibague_Calls" where id=case when TG_OP='DELETE' then old.call_id else new.call_id end for update;
 if current_user not in ('postgres','service_role','supabase_admin') and not public.pyr_unibague_has_role('ADMIN') and c.status not in ('draft','changes_required') then
  raise exception 'Call is frozen' using errcode='42501';
 end if;
 if TG_OP='DELETE' then
  if c.status in ('submitted','open') and not exists(select 1 from public."PYRUnibague_CallPositions" where call_id=c.id and id<>old.id) then
   raise exception 'A published/submitted call needs a position' using errcode='23514';
  end if;
  return old;
 end if;
 select project_id into pos from public."PYRUnibague_ProjectPositions" where id=new.project_position_id for share;
 select * into p from public."PYRUnibague_Projects" where id=pos for share;
 if p.id is null or c.id is null or p.organization_id<>c.organization_id or p.academic_period_id<>c.academic_period_id then
  raise exception 'Call position organization/period mismatch' using errcode='23514';
 end if;
 return new;
end $$;
create trigger p6b_call_position_guard before insert or update or delete on public."PYRUnibague_CallPositions"
for each row execute function pyr_unibague_private.p6b_call_position_guard();

-- Reverse guards prevent later parent edits from invalidating previously valid links.
create function pyr_unibague_private.p6b_parent_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if TG_TABLE_NAME='PYRUnibague_Projects' then
  if (new.organization_id<>old.organization_id or new.academic_period_id<>old.academic_period_id) and
   (exists(select 1 from public."PYRUnibague_Groups" where project_id=old.id) or
    exists(select 1 from public."PYRUnibague_CallPositions" cp join public."PYRUnibague_ProjectPositions" pp on pp.id=cp.project_position_id where pp.project_id=old.id)) then
   raise exception 'Project has call/team history' using errcode='23514';
  end if;
 elsif TG_TABLE_NAME='PYRUnibague_ProjectPositions' then
  if new.project_id<>old.project_id and
   (exists(select 1 from public."PYRUnibague_CallPositions" where project_position_id=old.id) or
    exists(select 1 from public."PYRUnibague_Assignments" where project_position_id=old.id)) then
   raise exception 'Position has call/assignment history' using errcode='23514';
  end if;
 else
  perform 1 from public."PYRUnibague_Projects" where id=new.project_id for share;
  if TG_OP='UPDATE' and (new.id<>old.id or new.project_id<>old.project_id or new.created_at<>old.created_at) then
   raise exception 'Immutable group identity' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
create trigger p6b_project_links before update on public."PYRUnibague_Projects" for each row execute function pyr_unibague_private.p6b_parent_guard();
create trigger p6b_position_links before update on public."PYRUnibague_ProjectPositions" for each row execute function pyr_unibague_private.p6b_parent_guard();
create trigger p6b_group_identity before insert or update on public."PYRUnibague_Groups" for each row execute function pyr_unibague_private.p6b_parent_guard();

-- Definer is required to lock Assignments: Organization has SELECT but no UPDATE policy.
-- Private trigger, not a REST endpoint, authorizes the caller before crossing that boundary.
create function pyr_unibague_private.p6b_member_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public."PYRUnibague_Assignments"; g public."PYRUnibague_Groups"; p public."PYRUnibague_Projects"; pos_project uuid;
begin
 if TG_OP='DELETE' then raise exception 'Membership history cannot be deleted' using errcode='23514'; end if;
 select * into g from public."PYRUnibague_Groups" where id=new.group_id;
 select * into p from public."PYRUnibague_Projects" where id=g.project_id;
 if current_setting('role') not in ('none','postgres','service_role','supabase_admin') and
  (auth.uid() is null or not (public.pyr_unibague_has_role('ADMIN') or public.pyr_unibague_can_manage_org(p.organization_id))) then
  raise exception 'Team manager required' using errcode='42501';
 end if;
 if TG_OP='UPDATE' then
  if new.id<>old.id or new.group_id<>old.group_id or new.assignment_id<>old.assignment_id or new.created_at<>old.created_at or new.joined_on is distinct from old.joined_on or old.status='inactive' then
   raise exception 'Membership history is immutable' using errcode='23514';
  end if;
  if new.status='inactive' then return new; end if;
 end if;
 if new.status<>'active' then raise exception 'Create active memberships, then retire them' using errcode='23514'; end if;
 -- Assignment lock serializes membership insertion against release and competing groups.
 select * into a from public."PYRUnibague_Assignments" where id=new.assignment_id for update;
 select * into g from public."PYRUnibague_Groups" where id=new.group_id for update;
 select * into p from public."PYRUnibague_Projects" where id=g.project_id for share;
 select project_id into pos_project from public."PYRUnibague_ProjectPositions" where id=a.project_position_id for share;
 if a.id is null or g.id is null or not a.is_active or a.status<>'confirmed' or a.unassigned_at is not null or
  pos_project<>g.project_id or a.academic_period_id<>p.academic_period_id or g.status<>'active' then
  raise exception 'Only confirmed assignments from this project/period can join an active group' using errcode='23514';
 end if;
 return new;
end $$;
create trigger p6b_member_guard before insert or update or delete on public."PYRUnibague_GroupMembers"
for each row execute function pyr_unibague_private.p6b_member_guard();

create function pyr_unibague_private.p6b_assignment_history_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if (new.student_id<>old.student_id or new.project_position_id<>old.project_position_id or new.academic_period_id<>old.academic_period_id)
 and exists(select 1 from public."PYRUnibague_GroupMembers" where assignment_id=old.id) then
  raise exception 'Assignment identity has membership history' using errcode='23514';
 end if;
 return new;
end $$;
create trigger p6b_assignment_history before update on public."PYRUnibague_Assignments"
for each row execute function pyr_unibague_private.p6b_assignment_history_guard();
create function pyr_unibague_private.p6b_retire_members() returns trigger
language plpgsql set search_path='' as $$
begin
 if not new.is_active or new.status<>'confirmed' or new.unassigned_at is not null then
  update public."PYRUnibague_GroupMembers" set status='inactive',
   left_on=greatest(coalesce(joined_on,current_date),coalesce(new.unassigned_at::date,current_date))
  where assignment_id=new.id and status='active';
 end if;
 return new;
end $$;
create trigger p6b_assignment_release after update on public."PYRUnibague_Assignments"
for each row execute function pyr_unibague_private.p6b_retire_members();

do $$ declare t text; predicate text; begin
 foreach t in array array['Calls','CallPositions','Groups','GroupMembers'] loop
  execute format('alter table public.%I enable row level security','PYRUnibague_'||t);
  execute format('revoke all on public.%I from public, anon, authenticated','PYRUnibague_'||t);
  execute format('grant select, insert, update on public.%I to authenticated','PYRUnibague_'||t);
  execute format('grant select, insert, update on public.%I to service_role','PYRUnibague_'||t);
  if t='CallPositions' then execute format('grant delete on public.%I to authenticated','PYRUnibague_'||t); end if;
  execute format('create policy admin_manage on public.%I for all to authenticated using (public.pyr_unibague_has_role(''ADMIN'')) with check (public.pyr_unibague_has_role(''ADMIN''))','PYRUnibague_'||t);
  if t='Calls' then predicate='public.pyr_unibague_is_org_member(organization_id)';
  elsif t='CallPositions' then predicate='exists(select 1 from public."PYRUnibague_Calls" c where c.id=call_id and public.pyr_unibague_is_org_member(c.organization_id))';
  elsif t='Groups' then predicate='pyr_unibague_private.project_access(project_id,false)';
  else predicate='exists(select 1 from public."PYRUnibague_Groups" g where g.id=group_id and pyr_unibague_private.project_access(g.project_id,false))'; end if;
  execute format('create policy member_read on public.%I for select to authenticated using (%s)','PYRUnibague_'||t,predicate);
  predicate=replace(replace(predicate,'pyr_unibague_is_org_member','pyr_unibague_can_manage_org'),',false)',',true)');
  execute format('create policy manager_insert on public.%I for insert to authenticated with check (%s)','PYRUnibague_'||t,predicate);
  execute format('create policy manager_update on public.%I for update to authenticated using (%s) with check (%s)','PYRUnibague_'||t,predicate,predicate);
  if t='CallPositions' then execute format('create policy manager_delete on public.%I for delete to authenticated using (%s)','PYRUnibague_'||t,predicate); end if;
  execute format('create trigger touch_updated_at before update on public.%I for each row execute function pyr_unibague_private.touch_updated_at()','PYRUnibague_'||t);
  execute format('create trigger audit_operation after insert or update or delete on public.%I for each row execute function pyr_unibague_private.audit_operation()','PYRUnibague_'||t);
 end loop;
end $$;

-- Narrow identity read for teams; existing Students/UserProfiles policies stay unchanged.
create function pyr_unibague_private.p6b_project_team(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not (public.pyr_unibague_has_role('ADMIN') or pyr_unibague_private.project_access(p_project_id,false)) then
  raise exception 'Project access required' using errcode='42501';
 end if;
 select jsonb_build_object(
  'groups',coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at,g.id) from public."PYRUnibague_Groups" g where g.project_id=p_project_id),'[]'::jsonb),
  'members',coalesce((select jsonb_agg(to_jsonb(gm) order by gm.created_at,gm.id) from public."PYRUnibague_GroupMembers" gm join public."PYRUnibague_Groups" g on g.id=gm.group_id where g.project_id=p_project_id),'[]'::jsonb),
  'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'student_id',s.id,'display_name',u.display_name,'program_name',pr.name,'position_title',pp.title,'is_active',a.is_active,'status',a.status,'unassigned_at',a.unassigned_at) order by a.id)
   from public."PYRUnibague_Assignments" a join public."PYRUnibague_ProjectPositions" pp on pp.id=a.project_position_id
   join public."PYRUnibague_Projects" p on p.id=pp.project_id join public."PYRUnibague_Students" s on s.id=a.student_id
   left join public."PYRUnibague_UserProfiles" u on u.user_id=s.user_id left join public."PYRUnibague_AcademicPrograms" pr on pr.id=s.academic_program_id
   where pp.project_id=p_project_id and a.academic_period_id=p.academic_period_id and
    ((a.is_active and a.status='confirmed' and a.unassigned_at is null) or exists(select 1 from public."PYRUnibague_GroupMembers" gm join public."PYRUnibague_Groups" g on g.id=gm.group_id where gm.assignment_id=a.id and g.project_id=p_project_id))),'[]'::jsonb)) into result;
 return result;
end $$;
create function public.pyr_unibague_project_team(p_project_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select pyr_unibague_private.p6b_project_team(p_project_id); $$;
revoke all on function pyr_unibague_private.p6b_project_team(uuid), public.pyr_unibague_project_team(uuid) from public,anon;
grant execute on function pyr_unibague_private.p6b_project_team(uuid), public.pyr_unibague_project_team(uuid) to authenticated;
revoke all on function pyr_unibague_private.p6b_member_guard() from public,anon,authenticated;
revoke all on function pyr_unibague_private.p6b_call_guard(), pyr_unibague_private.p6b_call_position_guard(),
 pyr_unibague_private.p6b_parent_guard(), pyr_unibague_private.p6b_assignment_history_guard(),
 pyr_unibague_private.p6b_retire_members() from public,anon,authenticated;
commit;
