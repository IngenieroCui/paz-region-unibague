-- P7: connect A/B/C after the reserved 001-010 sequence. No model tables added.
begin;

create or replace function pyr_unibague_private.assignment_integrations(
 p_operation text,p_assignment_id uuid,p_previous_assignment_id uuid,p_actor_id uuid
) returns jsonb language plpgsql set search_path='' as $$
declare a public."PYRUnibague_Assignments"%rowtype;
 part_id uuid; org_id uuid; advisor uuid; responsibility uuid; advisor_state text;
begin
 if auth.uid() is null or p_actor_id is distinct from auth.uid() or not public.pyr_unibague_has_role('ADMIN') then
  raise exception 'ADMIN required' using errcode='42501';
 end if;
 if p_operation not in ('confirm','reassign','unassign') then raise exception 'Invalid integration operation' using errcode='22023'; end if;
 select * into strict a from public."PYRUnibague_Assignments" where id=p_assignment_id;
 select id into strict part_id from public."PYRUnibague_StudentPeriodParticipations"
  where student_id=a.student_id and academic_period_id=a.academic_period_id for update;
 -- C already holds the period, project/organization and position locks. A changes
 -- organization responsibility under an UPDATE lock on the same organization.
 select p.organization_id into strict org_id from public."PYRUnibague_ProjectPositions" pp
  join public."PYRUnibague_Projects" p on p.id=pp.project_id where pp.id=a.project_position_id;
 if p_operation in ('reassign','unassign') then
  -- Responsibilities are independent historical rows; never repoint their source.
  perform public.pyr_unibague_change_student_advisor(part_id,null,current_date,null,null);
 end if;
 if p_operation='unassign' then
  return jsonb_build_object('advisor','retired','group','retired');
 end if;
 select ao.advisor_id into advisor from public."PYRUnibague_AdvisorOrganizationAssignments" ao
  join public."PYRUnibague_StaffProfiles" s on s.id=ao.advisor_id
  where ao.organization_id=org_id and ao.academic_period_id=a.academic_period_id and ao.is_current
   and s.status='active' and exists(select 1 from public."PYRUnibague_UserRoles" ur
    join public."PYRUnibague_Roles" r on r.id=ur.role_id where ur.user_id=s.user_id and r.code='ADVISOR')
  for share of ao,s;
 if advisor is not null then
  responsibility:=public.pyr_unibague_change_student_advisor(part_id,advisor,current_date,
   'Vinculación al confirmar asignación administrativa',a.id);
  advisor_state:='linked';
 else
  -- A valid student assignment remains confirmed. ADMIN resolves the missing link
  -- in its existing advisor workspace; a previously assigned manual advisor stays.
  advisor_state:=case when exists(select 1 from public."PYRUnibague_AdvisorStudentAssignments"
   where participation_id=part_id and is_current) then 'retained_manual' else 'missing_advisor' end;
 end if;
 return jsonb_build_object('advisor',advisor_state,'advisor_student_assignment_id',responsibility,
  'group','selection_required');
end $$;
revoke all on function pyr_unibague_private.assignment_integrations(text,uuid,uuid,uuid) from public,anon,authenticated;

-- Ficha: a narrow projection avoids opening UserProfiles/Staff to organizations.
create function public.pyr_unibague_project_institutional(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public."PYRUnibague_Projects"%rowtype;
begin
 select * into p from public."PYRUnibague_Projects" where id=p_project_id;
 if auth.uid() is null or p.id is null or not (public.pyr_unibague_has_role('ADMIN')
  or public.pyr_unibague_is_org_member(p.organization_id)
  or pyr_unibague_private.advisor_for_project(p.id)) then
  raise exception 'Project access required' using errcode='42501';
 end if;
 return jsonb_build_object('availability','available',
  'interlocutors',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'displayName',c.full_name)
   order by i.is_primary_for_project desc,c.full_name,c.id) from public."PYRUnibague_ProjectInterlocutors" i
   join public."PYRUnibague_OrganizationContacts" c on c.id=i.organization_contact_id where i.project_id=p.id),'[]'::jsonb),
  'advisors',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'displayName',u.display_name) order by s.id)
   from public."PYRUnibague_AdvisorOrganizationAssignments" ao
   join public."PYRUnibague_StaffProfiles" s on s.id=ao.advisor_id
   left join public."PYRUnibague_UserProfiles" u on u.user_id=s.user_id
   where ao.organization_id=p.organization_id and ao.academic_period_id=p.academic_period_id and ao.is_current),'[]'::jsonb),
  'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'displayName',o.legal_name) order by o.legal_name,o.id)
   from public."PYRUnibague_ProjectParticipatingOrganizations" po
   join public."PYRUnibague_Organizations" o on o.id=po.organization_id where po.project_id=p.id),'[]'::jsonb));
end $$;
revoke all on function public.pyr_unibague_project_institutional(uuid) from public,anon;
grant execute on function public.pyr_unibague_project_institutional(uuid) to authenticated;

-- Students see only their confirmed assignment and minimal active teammates from
-- their selected group. No candidates, scores, reasons, emails or Auth IDs.
create function public.pyr_unibague_student_assignment(p_period_id uuid) returns jsonb
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
 select jsonb_build_object('id',a.id,'organization',o.legal_name,'project',p.name,'position',pp.title,
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
  'teammates',coalesce((select jsonb_agg(jsonb_build_object('id',gm.id,'name',u.display_name) order by gm.id)
   from public."PYRUnibague_GroupMembers" gm join public."PYRUnibague_Assignments" aa on aa.id=gm.assignment_id
   join public."PYRUnibague_Students" s on s.id=aa.student_id
   left join public."PYRUnibague_UserProfiles" u on u.user_id=s.user_id
   where gm.group_id=team_group and gm.status='active' and aa.id<>a.id and aa.is_active
    and aa.status='confirmed' and aa.unassigned_at is null),'[]'::jsonb));
end $$;
revoke all on function public.pyr_unibague_student_assignment(uuid) from public,anon;
grant execute on function public.pyr_unibague_student_assignment(uuid) to authenticated;

-- The original 009 parent guard ran as invoker: RLS could hide a foreign call
-- referencing the position while its owner edited the parent. Keep its predicates
-- and validation, but let this private trigger see all dependent rows.
alter function pyr_unibague_private.p6b_parent_guard() security definer;
revoke all on function pyr_unibague_private.p6b_parent_guard() from public,anon,authenticated;
commit;
