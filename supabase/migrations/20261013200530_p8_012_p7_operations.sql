-- P7 operational closure. Append-only; 001-011 may already be applied.
begin;

-- Personal notifications only. Application users cannot manufacture messages.
drop policy "admin_read" on public."PYRUnibague_Notifications";
drop policy "admin_create" on public."PYRUnibague_Notifications";
drop policy "admin_delete" on public."PYRUnibague_Notifications";
revoke insert, delete on public."PYRUnibague_Notifications" from authenticated;
create index pyr_notifications_inbox on public."PYRUnibague_Notifications"(user_id,created_at desc,id);

create function pyr_unibague_private.notify_assignment_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid; period_name text; period_id uuid; removed boolean;
begin
 if new.event_type not in ('ASSIGNED','REASSIGNED_TO','UNASSIGNED','REASSIGNED_FROM') then return new; end if;
 select s.user_id,ap.name,ap.id into strict recipient,period_name,period_id
 from public."PYRUnibague_Assignments" a
 join public."PYRUnibague_Students" s on s.id=a.student_id
 join public."PYRUnibague_AcademicPeriods" ap on ap.id=a.academic_period_id
 where a.id=new.assignment_id;
 removed:=new.event_type in ('UNASSIGNED','REASSIGNED_FROM');
 insert into public."PYRUnibague_Notifications"(user_id,type_code,title,body,link_path)
 values(recipient,'ASSIGNMENT_'||new.event_type,
  case when removed then 'Cambio en tu asignación' else 'Asignación confirmada' end,
  case when removed then 'Se retiró tu asignación anterior en ' else 'Consulta tu asignación en ' end||period_name||'.',
  '/app/student/assignment?period='||period_id::text);
 return new;
end $$;
revoke all on function pyr_unibague_private.notify_assignment_event() from public,anon,authenticated;
create trigger pyr_notify_assignment after insert on public."PYRUnibague_AssignmentEvents"
 for each row execute function pyr_unibague_private.notify_assignment_event();

-- One consistent statement snapshot, no private documents or candidate scores.
create function public.pyr_unibague_operational_summary(p_period_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.pyr_unibague_has_role('ADMIN') then
  raise exception 'ADMIN required' using errcode='42501'; end if;
 if not exists(select 1 from public."PYRUnibague_AcademicPeriods" where id=p_period_id) then
  raise exception 'Unknown period' using errcode='22023'; end if;
 with active_assignments as (
  select * from public."PYRUnibague_Assignments" where academic_period_id=p_period_id
   and is_active and status='confirmed' and unassigned_at is null
 ), valid_advisors as (
  select s.id from public."PYRUnibague_StaffProfiles" s where s.status='active' and exists(
   select 1 from public."PYRUnibague_UserRoles" ur join public."PYRUnibague_Roles" r on r.id=ur.role_id
   where ur.user_id=s.user_id and r.code='ADVISOR')
 ), period_organizations as (
  select distinct organization_id from public."PYRUnibague_Projects" where academic_period_id=p_period_id
 ), positions as (
  select pp.id,pp.capacity,count(a.id)::integer as occupied
  from public."PYRUnibague_ProjectPositions" pp
  join public."PYRUnibague_Projects" p on p.id=pp.project_id
  join public."PYRUnibague_Organizations" o on o.id=p.organization_id
  left join active_assignments a on a.project_position_id=pp.id
  where p.academic_period_id=p_period_id and p.status='approved' and pp.is_active
   and o.status='approved' and o.verified_at is not null
  group by pp.id,pp.capacity
 ) select jsonb_build_object(
  'pendingOrganizations',(select count(*) from public."PYRUnibague_Organizations" where status in ('pending','pending_review','submitted')),
  'pendingProjects',(select count(*) from public."PYRUnibague_Projects" where academic_period_id=p_period_id and status='submitted'),
  'unassignedEligible',(select count(*) from public."PYRUnibague_StudentPeriodParticipations" sp
   join public."PYRUnibague_Students" s on s.id=sp.student_id where sp.academic_period_id=p_period_id
   and sp.eligible_for_matching and s.is_active and not exists(select 1 from active_assignments a where a.student_id=s.id)),
  'vacantPositions',(select count(*) from positions where capacity>occupied),
  'vacantCapacity',coalesce((select sum(greatest(capacity-occupied,0)) from positions),0),
  'organizationsWithoutAdvisor',(select count(*) from period_organizations o where not exists(
   select 1 from public."PYRUnibague_AdvisorOrganizationAssignments" ao join valid_advisors va on va.id=ao.advisor_id
   where ao.organization_id=o.organization_id and ao.academic_period_id=p_period_id and ao.is_current)),
  'assignmentsWithoutAdvisor',(select count(*) from active_assignments a where not exists(
   select 1 from public."PYRUnibague_StudentPeriodParticipations" sp
   join public."PYRUnibague_AdvisorStudentAssignments" ast on ast.participation_id=sp.id
   join valid_advisors va on va.id=ast.advisor_id
   where sp.student_id=a.student_id and sp.academic_period_id=p_period_id and ast.is_current)),
  'assignmentsRequiringReview',(select count(*) from active_assignments a
   join public."PYRUnibague_ProjectPositions" pp on pp.id=a.project_position_id
   join public."PYRUnibague_Projects" p on p.id=pp.project_id
   join public."PYRUnibague_Organizations" o on o.id=p.organization_id
   join public."PYRUnibague_Students" s on s.id=a.student_id
   where a.source='MANUAL' or not s.is_active or not pp.is_active or p.status<>'approved'
    or o.status<>'approved' or o.verified_at is null or not exists(
     select 1 from public."PYRUnibague_StudentPeriodParticipations" sp where sp.student_id=a.student_id
      and sp.academic_period_id=p_period_id and sp.eligible_for_matching))
 ) into result;
 return result;
end $$;
revoke all on function public.pyr_unibague_operational_summary(uuid) from public,anon;
grant execute on function public.pyr_unibague_operational_summary(uuid) to authenticated;

-- Stable keyset pages avoid PostgREST's row cap and offset drift. A single export
-- is a read snapshot per page; ADMIN should rerun it after concurrent changes.
create function public.pyr_unibague_operational_export(p_period_id uuid,p_kind text,p_after_id uuid default null)
 returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.pyr_unibague_has_role('ADMIN') then
  raise exception 'ADMIN required' using errcode='42501'; end if;
 if p_kind not in ('assignments','positions') or p_kind is null or not exists(
  select 1 from public."PYRUnibague_AcademicPeriods" where id=p_period_id) then
  raise exception 'Invalid export request' using errcode='22023'; end if;
 if p_kind='assignments' then
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.id),'[]'::jsonb) into result from (
   select a.id,u.display_name as student,pr.name as program,o.legal_name as organization,p.name as project,
    pp.title as position,a.status,a.is_active,
    (select au.display_name from public."PYRUnibague_AdvisorStudentAssignments" ast
     join public."PYRUnibague_StaffProfiles" st on st.id=ast.advisor_id
     left join public."PYRUnibague_UserProfiles" au on au.user_id=st.user_id
     where ast.participation_id=sp.id and ast.is_current and a.is_active) as advisor,
    (select g.name from public."PYRUnibague_GroupMembers" gm join public."PYRUnibague_Groups" g on g.id=gm.group_id
     where gm.assignment_id=a.id and gm.status='active') as "group"
   from public."PYRUnibague_Assignments" a
   join public."PYRUnibague_Students" s on s.id=a.student_id
   left join public."PYRUnibague_UserProfiles" u on u.user_id=s.user_id
   left join public."PYRUnibague_AcademicPrograms" pr on pr.id=s.academic_program_id
   join public."PYRUnibague_StudentPeriodParticipations" sp on sp.student_id=s.id and sp.academic_period_id=a.academic_period_id
   join public."PYRUnibague_ProjectPositions" pp on pp.id=a.project_position_id
   join public."PYRUnibague_Projects" p on p.id=pp.project_id
   join public."PYRUnibague_Organizations" o on o.id=p.organization_id
   where a.academic_period_id=p_period_id and (p_after_id is null or a.id>p_after_id)
   order by a.id limit 500
  ) rows;
 else
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.id),'[]'::jsonb) into result from (
   select pp.id,o.legal_name as organization,p.name as project,pp.title as position,pp.capacity,
    pp.is_active,p.status as project_status,
    (select count(*) from public."PYRUnibague_Assignments" a where a.project_position_id=pp.id
     and a.academic_period_id=p_period_id and a.is_active and a.status='confirmed' and a.unassigned_at is null) as occupied
   from public."PYRUnibague_ProjectPositions" pp join public."PYRUnibague_Projects" p on p.id=pp.project_id
   join public."PYRUnibague_Organizations" o on o.id=p.organization_id
   where p.academic_period_id=p_period_id and (p_after_id is null or pp.id>p_after_id)
   order by pp.id limit 500
  ) rows;
 end if;
 return result;
end $$;
revoke all on function public.pyr_unibague_operational_export(uuid,text,uuid) from public,anon;
grant execute on function public.pyr_unibague_operational_export(uuid,text,uuid) to authenticated;

-- An organization responsibility allows seeing the project, never foreign
-- students. Teams expose only this advisor's current individual advisees.
create function public.pyr_unibague_advisor_project_team(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.pyr_unibague_has_role('ADVISOR')
  or not pyr_unibague_private.advisor_for_project(p_project_id) then
  raise exception 'Advisor project access required' using errcode='42501'; end if;
 with own_assignments as (
  select a.id,s.id as student_id,u.display_name,pr.name as program_name,pp.title as position_title,
   a.is_active,a.status,a.unassigned_at
  from public."PYRUnibague_Assignments" a
  join public."PYRUnibague_ProjectPositions" pp on pp.id=a.project_position_id
  join public."PYRUnibague_Students" s on s.id=a.student_id
  join public."PYRUnibague_StudentPeriodParticipations" sp on sp.student_id=s.id and sp.academic_period_id=a.academic_period_id
  join public."PYRUnibague_AdvisorStudentAssignments" ast on ast.participation_id=sp.id and ast.is_current
  join public."PYRUnibague_StaffProfiles" st on st.id=ast.advisor_id and st.user_id=auth.uid() and st.status='active'
  left join public."PYRUnibague_UserProfiles" u on u.user_id=s.user_id
  left join public."PYRUnibague_AcademicPrograms" pr on pr.id=s.academic_program_id
  where pp.project_id=p_project_id and a.is_active and a.status='confirmed' and a.unassigned_at is null
 ) select jsonb_build_object(
  'groups',coalesce((select jsonb_agg(to_jsonb(g) order by g.id) from public."PYRUnibague_Groups" g where g.project_id=p_project_id),'[]'::jsonb),
  'members',coalesce((select jsonb_agg(to_jsonb(gm) order by gm.id) from public."PYRUnibague_GroupMembers" gm
   join own_assignments a on a.id=gm.assignment_id where gm.status='active'),'[]'::jsonb),
  'assignments',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from own_assignments a),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.pyr_unibague_advisor_project_team(uuid) from public,anon;
grant execute on function public.pyr_unibague_advisor_project_team(uuid) to authenticated;
create or replace function public.pyr_unibague_student_assignment(p_period_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public."PYRUnibague_Assignments"%rowtype; result jsonb; team_group uuid;
begin
 if auth.uid() is null or not public.pyr_unibague_has_role('STUDENT') then
  raise exception 'STUDENT required' using errcode='42501';
 end if;
 select aa.* into a from public."PYRUnibague_Assignments" aa
  join public."PYRUnibague_Students" s on s.id=aa.student_id
  where s.user_id=auth.uid() and aa.academic_period_id=p_period_id
   and aa.is_active and aa.status='confirmed' and aa.unassigned_at is null;
 if not found then return null; end if;
 select jsonb_build_object('id',a.id,'status',a.status,'municipality',(select municipality_name from public."PYRUnibague_Municipalities" where id=p.municipality_id),'organization',o.legal_name,'project',p.name,'position',pp.title,
  'advisor',(select u.display_name from public."PYRUnibague_AdvisorStudentAssignments" ast
   join public."PYRUnibague_StudentPeriodParticipations" sp on sp.id=ast.participation_id
   join public."PYRUnibague_StaffProfiles" s on s.id=ast.advisor_id
   left join public."PYRUnibague_UserProfiles" u on u.user_id=s.user_id
   where sp.student_id=a.student_id and sp.academic_period_id=a.academic_period_id and ast.is_current)) into result
  from public."PYRUnibague_ProjectPositions" pp join public."PYRUnibague_Projects" p on p.id=pp.project_id
  join public."PYRUnibague_Organizations" o on o.id=p.organization_id where pp.id=a.project_position_id;
 select gm.group_id into team_group from public."PYRUnibague_GroupMembers" gm
  where gm.assignment_id=a.id and gm.status='active';
 return result||jsonb_build_object('group',(select name from public."PYRUnibague_Groups" where id=team_group),
  'teammates',coalesce((select jsonb_agg(jsonb_build_object('id',gm.id,'name',u.display_name,'program',pr.name) order by gm.id)
   from public."PYRUnibague_GroupMembers" gm join public."PYRUnibague_Assignments" aa on aa.id=gm.assignment_id
   join public."PYRUnibague_Students" s on s.id=aa.student_id
   left join public."PYRUnibague_UserProfiles" u on u.user_id=s.user_id
   left join public."PYRUnibague_AcademicPrograms" pr on pr.id=s.academic_program_id
   where gm.group_id=team_group and gm.status='active' and aa.id<>a.id and aa.is_active
    and aa.status='confirmed' and aa.unassigned_at is null),'[]'::jsonb));
end $$;
revoke all on function public.pyr_unibague_student_assignment(uuid) from public,anon;
grant execute on function public.pyr_unibague_student_assignment(uuid) to authenticated;


commit;
