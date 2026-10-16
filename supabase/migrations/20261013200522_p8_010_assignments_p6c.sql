-- Reserved migration 010. Existing tables only; P5 formulas and completed runs unchanged.
begin;

do $$ begin
 if exists(select 1 from public."PYRUnibague_Assignments" a join public."PYRUnibague_ProjectPositions" pp on pp.id=a.project_position_id
   join public."PYRUnibague_Projects" p on p.id=pp.project_id where a.is_active and a.academic_period_id<>p.academic_period_id)
 or exists(select 1 from public."PYRUnibague_Assignments" a join public."PYRUnibague_ProjectPositions" pp on pp.id=a.project_position_id
   where a.is_active group by pp.id,pp.capacity having count(*)>pp.capacity) then
  raise exception 'Reconcile existing active assignments: inconsistent period or overcapacity. No history was changed.' using errcode='23514';
 end if;
end $$;

-- All browser writes, including ADMIN, go through audited transactional RPCs.
revoke insert, update, delete on public."PYRUnibague_Assignments" from authenticated, anon;
revoke insert, update, delete on public."PYRUnibague_AssignmentEvents" from authenticated, anon;
create index pyr_p6c_active_position on public."PYRUnibague_Assignments"(project_position_id) where is_active;

create function pyr_unibague_private.assignment_state(p_period_id uuid, p_run_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
  'periodId', p_period_id,
  'run', (select jsonb_build_object('id',r.id,'periodId',r.academic_period_id,'status',r.status,
    'configurationId',r.matching_configuration_id,'snapshot',r.summary->'configuration_snapshot',
    'threshold',case when jsonb_typeof(r.summary#>'{configuration_snapshot,minimum_recommended_score}')='number'
      then r.summary#>'{configuration_snapshot,minimum_recommended_score}' else 'null'::jsonb end)
    from public."PYRUnibague_MatchingRuns" r where r.id=p_run_id),
  'students', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'label',coalesce(u.display_name,s.student_code,s.id::text),
    'periodId',sp.academic_period_id,'active',s.is_active,'eligible',sp.eligible_for_matching,
    'studentVersion',s.updated_at,'participationVersion',sp.updated_at) order by s.id)
    from public."PYRUnibague_Students" s join public."PYRUnibague_StudentPeriodParticipations" sp on sp.student_id=s.id
    left join public."PYRUnibague_UserProfiles" u on u.user_id=s.user_id where sp.academic_period_id=p_period_id),'[]'::jsonb),
  'positions', coalesce((select jsonb_agg(jsonb_build_object('id',pp.id,'label',pp.title,'projectId',p.id,
    'projectName',p.name,'organizationId',o.id,'organizationName',o.legal_name,'periodId',p.academic_period_id,
    'capacity',pp.capacity,'active',pp.is_active,'approved',p.status='approved',
    'validated',o.status='approved' and o.verified_at is not null,
    'positionVersion',pp.updated_at,'projectVersion',p.updated_at,'organizationVersion',o.updated_at) order by pp.id)
    from public."PYRUnibague_ProjectPositions" pp join public."PYRUnibague_Projects" p on p.id=pp.project_id
    join public."PYRUnibague_Organizations" o on o.id=p.organization_id where p.academic_period_id=p_period_id),'[]'::jsonb),
  'candidates', coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'runId',c.matching_run_id,'studentId',c.student_id,
    'positionId',c.project_position_id,'eligible',c.is_eligible,'score',c.total_score,'blockers',c.blockers,
    'currentEligible',
      (not exists(select 1 from public."PYRUnibague_ProjectPositionPrograms" x where x.project_position_id=c.project_position_id and x.is_required)
       or exists(select 1 from public."PYRUnibague_ProjectPositionPrograms" x where x.project_position_id=c.project_position_id and x.is_required and x.academic_program_id=s.academic_program_id))
      and (r.summary#>'{configuration_snapshot,rules,requiredSkillsAreHardConstraint}'='false'::jsonb
       or not exists(select 1 from public."PYRUnibague_ProjectPositionSkills" x where x.project_position_id=c.project_position_id and x.is_required
        and not exists(select 1 from public."PYRUnibague_StudentSkills" ss where ss.student_id=c.student_id and ss.skill_id=x.skill_id)))) order by c.id)
    from public."PYRUnibague_MatchCandidates" c join public."PYRUnibague_Students" s on s.id=c.student_id
    join public."PYRUnibague_MatchingRuns" r on r.id=c.matching_run_id where c.matching_run_id=p_run_id),'[]'::jsonb),
  'existing', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'studentId',a.student_id,'positionId',a.project_position_id,
    'periodId',a.academic_period_id,'active',a.is_active) order by a.id)
    from public."PYRUnibague_Assignments" a where a.academic_period_id=p_period_id and a.is_active),'[]'::jsonb),
  -- Current hard constraints are part of the draft revision, even if a child edit did not touch its parent.
  'programs',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public."PYRUnibague_ProjectPositionPrograms" x
    join public."PYRUnibague_ProjectPositions" pp on pp.id=x.project_position_id join public."PYRUnibague_Projects" p on p.id=pp.project_id where p.academic_period_id=p_period_id),'[]'::jsonb),
  'requiredSkills',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public."PYRUnibague_ProjectPositionSkills" x
    join public."PYRUnibague_ProjectPositions" pp on pp.id=x.project_position_id join public."PYRUnibague_Projects" p on p.id=pp.project_id where p.academic_period_id=p_period_id),'[]'::jsonb),
  'studentSkills',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public."PYRUnibague_StudentSkills" x
    join public."PYRUnibague_StudentPeriodParticipations" sp on sp.student_id=x.student_id where sp.academic_period_id=p_period_id),'[]'::jsonb)
 )
$$;
revoke all on function pyr_unibague_private.assignment_state(uuid,uuid) from public,anon,authenticated;

create function public.pyr_unibague_assignment_snapshot(p_period_id uuid, p_run_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare state jsonb;
begin
 if auth.uid() is null or not public.pyr_unibague_has_role('ADMIN') then raise exception 'ADMIN required' using errcode='42501'; end if;
 if not exists(select 1 from public."PYRUnibague_AcademicPeriods" where id=p_period_id) then raise exception 'Invalid period' using errcode='22023'; end if;
 if p_run_id is not null and not exists(select 1 from public."PYRUnibague_MatchingRuns" where id=p_run_id and academic_period_id=p_period_id and status='completed') then
  raise exception 'Completed matching run from this period required' using errcode='22023';
 end if;
 state := pyr_unibague_private.assignment_state(p_period_id,p_run_id);
 return state || jsonb_build_object('revision',md5(state::text));
end $$;
revoke all on function public.pyr_unibague_assignment_snapshot(uuid,uuid) from public,anon;
grant execute on function public.pyr_unibague_assignment_snapshot(uuid,uuid) to authenticated;

-- Immutable history. Actor FK anonymization remains possible when an Auth identity is removed.
create function pyr_unibague_private.assignment_history_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Assignment history cannot be deleted' using errcode='23514'; end if;
 if TG_TABLE_NAME='PYRUnibague_AssignmentEvents' then
  if (to_jsonb(new)-'actor_user_id') is distinct from (to_jsonb(old)-'actor_user_id') or new.actor_user_id is not null then
   raise exception 'Assignment events are immutable' using errcode='23514'; end if;
 else
  if (to_jsonb(new)-array['is_active','status','unassigned_at','updated_at','assigned_by']) is distinct from
     (to_jsonb(old)-array['is_active','status','unassigned_at','updated_at','assigned_by'])
   or (new.assigned_by is distinct from old.assigned_by and new.assigned_by is not null)
   or (new.is_active is distinct from old.is_active and (not old.is_active or new.is_active or new.unassigned_at is null))
   or (not old.is_active and (new.status,new.unassigned_at) is distinct from (old.status,old.unassigned_at))
   or (new.is_active and (new.status,new.unassigned_at) is distinct from (old.status,old.unassigned_at)) then
   raise exception 'Assignment history is immutable; use reassign' using errcode='23514'; end if;
 end if;
 return new;
end $$;
revoke all on function pyr_unibague_private.assignment_history_guard() from public,anon,authenticated;
create trigger p6c_history before update or delete on public."PYRUnibague_Assignments" for each row execute function pyr_unibague_private.assignment_history_guard();
create trigger p6c_history before update or delete on public."PYRUnibague_AssignmentEvents" for each row execute function pyr_unibague_private.assignment_history_guard();

-- Position row lock also serializes capacity edits against confirmations.
create function pyr_unibague_private.assignment_position_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.capacity < (select count(*) from public."PYRUnibague_Assignments" where project_position_id=old.id and is_active) then
  raise exception 'Capacity below active occupancy' using errcode='23514'; end if;
 if (new.id,new.project_id) is distinct from (old.id,old.project_id) and exists(select 1 from public."PYRUnibague_Assignments" where project_position_id=old.id) then
  raise exception 'Cannot move a position with assignment history' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function pyr_unibague_private.assignment_position_guard() from public,anon,authenticated;
create trigger p6c_position_integrity before update on public."PYRUnibague_ProjectPositions" for each row execute function pyr_unibague_private.assignment_position_guard();
create function pyr_unibague_private.assignment_project_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (new.id,new.academic_period_id,new.organization_id) is distinct from (old.id,old.academic_period_id,old.organization_id)
 and exists(select 1 from public."PYRUnibague_Assignments" a join public."PYRUnibague_ProjectPositions" pp on pp.id=a.project_position_id where pp.project_id=old.id) then
  raise exception 'Cannot move a project with assignment history' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function pyr_unibague_private.assignment_project_guard() from public,anon,authenticated;
create trigger p6c_project_integrity before update on public."PYRUnibague_Projects" for each row execute function pyr_unibague_private.assignment_project_guard();

-- Integration seam for A/B: replace in a future coordinated migration, keeping this signature.
-- Called inside the assignment transaction. Never a client-side post-commit historical write.
create function pyr_unibague_private.assignment_integrations(p_operation text,p_assignment_id uuid,p_previous_assignment_id uuid,p_actor_id uuid)
returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('advisor','pending_integration','group','pending_integration')
$$;
revoke all on function pyr_unibague_private.assignment_integrations(text,uuid,uuid,uuid) from public,anon,authenticated;

-- Internal write boundary. No authenticated EXECUTE; public wrappers below check persisted ADMIN here.
create function pyr_unibague_private.apply_assignments(p_period_id uuid,p_run_id uuid,p_revision text,p_actions jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=auth.uid(); action jsonb; prior public."PYRUnibague_Assignments"%rowtype;
 pp public."PYRUnibague_ProjectPositions"%rowtype; project public."PYRUnibague_Projects"%rowtype;
 org public."PYRUnibague_Organizations"%rowtype; student public."PYRUnibague_Students"%rowtype;
 candidate public."PYRUnibague_MatchCandidates"%rowtype; run public."PYRUnibague_MatchingRuns"%rowtype;
 threshold numeric; new_id uuid; student_id uuid; position_id uuid; candidate_id uuid; source text;
 state jsonb; result jsonb:='[]'::jsonb; reason text; kind text; hard_skills boolean; integrations jsonb;
begin
 if actor is null or not public.pyr_unibague_has_role('ADMIN') then raise exception 'ADMIN required' using errcode='42501'; end if;
 if jsonb_typeof(p_actions) is distinct from 'array' then raise exception 'Invalid assignment batch' using errcode='22023'; end if;
 if jsonb_array_length(p_actions) not between 1 and 500 or exists(select 1 from jsonb_array_elements(p_actions) x where jsonb_typeof(x)<>'object' or nullif(x->>'student_id','') is null)
 or (select count(distinct x->>'student_id') from jsonb_array_elements(p_actions) x)<>jsonb_array_length(p_actions) then
  raise exception 'Invalid or duplicate students in batch' using errcode='22023'; end if;
 -- One serialization point per period. Confirm, reassign and unassign use exactly the same lock.
 perform 1 from public."PYRUnibague_AcademicPeriods" where id=p_period_id for update;
 if not found then raise exception 'Invalid period' using errcode='22023'; end if;
 -- Lock current institutional state and destination capacities until commit.
 perform 1 from public."PYRUnibague_Students" s join public."PYRUnibague_StudentPeriodParticipations" sp on sp.student_id=s.id
  where sp.academic_period_id=p_period_id order by s.id for share of s,sp;
 perform 1 from public."PYRUnibague_Projects" p where p.academic_period_id=p_period_id order by p.id for share;
 perform 1 from public."PYRUnibague_Organizations" o where o.id in(select organization_id from public."PYRUnibague_Projects" where academic_period_id=p_period_id) order by o.id for share;
 perform 1 from public."PYRUnibague_ProjectPositions" pp join public."PYRUnibague_Projects" p on p.id=pp.project_id
  where p.academic_period_id=p_period_id order by pp.id for update of pp;
 -- Child edits/inserts can change hard constraints without touching parent.updated_at.
 -- SHARE locks exclude those edits for this short administrative transaction (no DDL/rows persisted).
 lock table public."PYRUnibague_ProjectPositionPrograms",public."PYRUnibague_ProjectPositionSkills",public."PYRUnibague_StudentSkills" in share mode;
 if p_run_id is not null then
  select * into run from public."PYRUnibague_MatchingRuns" where id=p_run_id for share;
  if not found or run.status<>'completed' or run.academic_period_id<>p_period_id then raise exception 'Completed run required' using errcode='22023'; end if;
  perform 1 from public."PYRUnibague_MatchCandidates" where matching_run_id=p_run_id order by id for share;
 end if;
 state:=pyr_unibague_private.assignment_state(p_period_id,p_run_id);
 if p_revision is null or p_revision<>md5(state::text) then raise exception 'ASSIGNMENT_PROPOSAL_STALE: recalcula la propuesta antes de confirmar' using errcode='P0001'; end if;
 -- Close all previous assignments first, allowing an explicit atomic swap in a manual batch.
 for action in select value from jsonb_array_elements(p_actions) loop
  kind:=action->>'kind'; reason:=action->>'reason_code'; student_id:=(action->>'student_id')::uuid;
  if kind is null or kind not in ('confirm','reassign','unassign') then raise exception 'Invalid action' using errcode='22023'; end if;
  if kind<>'confirm' or action->>'source'='MANUAL' then
   if reason is null or reason not in ('INSTITUTIONAL_NEED','AUTHORIZED_SPECIAL_CASE','CONFLICT_OF_INTEREST','COORDINATION_REQUEST','DATA_CORRECTION','OTHER')
    or nullif(btrim(action->>'reason_text'),'') is null or length(action->>'reason_text')>2000 then
    raise exception 'Explicit intervention reason required' using errcode='22023'; end if;
  end if;
  if kind in ('reassign','unassign') then
   select a.* into prior from public."PYRUnibague_Assignments" a where a.id=(action->>'assignment_id')::uuid and a.academic_period_id=p_period_id and a.student_id=student_id and a.is_active for update;
   if not found then raise exception 'ASSIGNMENT_PROPOSAL_STALE: active assignment changed' using errcode='P0001'; end if;
   if kind='reassign' and action->>'source' is distinct from 'MANUAL' then raise exception 'Reassignment requires explicit manual intervention' using errcode='22023'; end if;
   update public."PYRUnibague_Assignments" set is_active=false,status='unassigned',unassigned_at=clock_timestamp() where id=prior.id;
   insert into public."PYRUnibague_AssignmentEvents"(assignment_id,event_type,actor_user_id,reason_code,reason_text,metadata)
    values(prior.id,case when kind='reassign' then 'REASSIGNED_FROM' else 'UNASSIGNED' end,actor,reason,btrim(action->>'reason_text'),jsonb_build_object('next_position_id',action->>'position_id'));
   if kind='unassign' then perform pyr_unibague_private.assignment_integrations('unassign',prior.id,null,actor); end if;
  end if;
 end loop;
 for action in select value from jsonb_array_elements(p_actions) loop
  if action->>'kind'='unassign' then result:=result||jsonb_build_array(jsonb_build_object('closed_id',action->>'assignment_id')); continue; end if;
  student_id:=(action->>'student_id')::uuid; position_id:=(action->>'position_id')::uuid;
  candidate_id:=nullif(action->>'candidate_id','')::uuid; source:=action->>'source'; threshold:=null; hard_skills:=true;
  if source is null or source not in ('MATCHING','MANUAL') then raise exception 'Invalid source' using errcode='22023'; end if;
  select * into student from public."PYRUnibague_Students" where id=student_id;
  if not found or not student.is_active or not exists(select 1 from public."PYRUnibague_StudentPeriodParticipations" sp where sp.student_id=student_id and sp.academic_period_id=p_period_id and sp.eligible_for_matching) then
   raise exception 'Institutional student eligibility required' using errcode='23514'; end if;
  if exists(select 1 from public."PYRUnibague_Assignments" a where a.student_id=student_id and a.academic_period_id=p_period_id and a.is_active) then
   raise exception 'Student already assigned; explicit reassignment required' using errcode='23514'; end if;
  select * into pp from public."PYRUnibague_ProjectPositions" where id=position_id;
  if not found then raise exception 'Invalid position' using errcode='23514'; end if;
  select * into project from public."PYRUnibague_Projects" where id=pp.project_id;
  select * into org from public."PYRUnibague_Organizations" where id=project.organization_id;
  -- Conservative provisional policy for both paths; no institutional exceptions hidden in manual UI.
  if not pp.is_active or pp.capacity<=0 or project.academic_period_id<>p_period_id or project.status<>'approved' or org.status<>'approved' or org.verified_at is null then
   raise exception 'Position, project, organization or period not eligible' using errcode='23514'; end if;
  if (select count(*) from public."PYRUnibague_Assignments" a where a.project_position_id=position_id and a.is_active)>=pp.capacity then
   raise exception 'ASSIGNMENT_PROPOSAL_STALE: position capacity exhausted' using errcode='P0001'; end if;
  if candidate_id is not null then
   select * into candidate from public."PYRUnibague_MatchCandidates" c where c.id=candidate_id;
   if not found or candidate.matching_run_id is distinct from p_run_id or candidate.student_id<>student_id or candidate.project_position_id<>position_id
    or not candidate.is_eligible or jsonb_typeof(candidate.blockers) is distinct from 'array' or candidate.blockers<>'[]'::jsonb
    or candidate.total_score is null or candidate.total_score not between 0 and 100 then
    raise exception 'Eligible completed candidate without blockers required' using errcode='23514'; end if;
   if jsonb_typeof(run.summary#>'{configuration_snapshot,minimum_recommended_score}') is distinct from 'number' then
    raise exception 'Historical matching threshold missing' using errcode='23514'; end if;
   threshold:=(run.summary#>>'{configuration_snapshot,minimum_recommended_score}')::numeric;
   if threshold not between 0 and 100 then raise exception 'Invalid historical threshold' using errcode='23514'; end if;
   hard_skills:=coalesce((run.summary#>>'{configuration_snapshot,rules,requiredSkillsAreHardConstraint}')::boolean,true);
   if candidate.total_score<threshold and (source<>'MANUAL' or coalesce((action->>'allow_below_threshold')::boolean,false)=false) then
    raise exception 'Below threshold requires explicit manual confirmation and reason' using errcode='23514'; end if;
  elsif source='MATCHING' or not coalesce((action->>'allow_unscored')::boolean,false) then
   raise exception 'Candidate required or explicit unscored manual confirmation' using errcode='23514';
  elsif p_run_id is not null and exists(select 1 from public."PYRUnibague_MatchCandidates" c where c.matching_run_id=p_run_id and c.student_id=student_id and c.project_position_id=position_id) then
   raise exception 'Existing compatibility must be reviewed; cannot omit candidate' using errcode='23514';
  end if;
  if exists(select 1 from public."PYRUnibague_ProjectPositionPrograms" x where x.project_position_id=position_id and x.is_required)
   and not exists(select 1 from public."PYRUnibague_ProjectPositionPrograms" x where x.project_position_id=position_id and x.is_required and x.academic_program_id=student.academic_program_id) then
   raise exception 'Current academic program blocks assignment' using errcode='23514'; end if;
  if hard_skills and exists(select 1 from public."PYRUnibague_ProjectPositionSkills" x where x.project_position_id=position_id and x.is_required and not exists(select 1 from public."PYRUnibague_StudentSkills" ss where ss.student_id=student_id and ss.skill_id=x.skill_id)) then
   raise exception 'Current required skill blocks assignment' using errcode='23514'; end if;
  insert into public."PYRUnibague_Assignments"(academic_period_id,student_id,project_position_id,match_candidate_id,status,source,assigned_by,assigned_at,notes)
   values(p_period_id,student_id,position_id,candidate_id,'confirmed',source,actor,clock_timestamp(),null) returning id into new_id;
  integrations:=pyr_unibague_private.assignment_integrations(action->>'kind',new_id,case when action->>'kind'='reassign' then (action->>'assignment_id')::uuid else null end,actor);
  insert into public."PYRUnibague_AssignmentEvents"(assignment_id,event_type,actor_user_id,reason_code,reason_text,metadata)
   values(new_id,case when action->>'kind'='reassign' then 'REASSIGNED_TO' else 'ASSIGNED' end,actor,action->>'reason_code',action->>'reason_text',
    jsonb_build_object('source',source,'candidate_id',candidate_id,'matching_run_id',p_run_id,'threshold',threshold,
     'below_threshold_confirmed',coalesce((action->>'allow_below_threshold')::boolean,false),
     'unscored_confirmed',coalesce((action->>'allow_unscored')::boolean,false),'previous_assignment_id',case when action->>'kind'='reassign' then action->>'assignment_id' else null end,'integrations',integrations));
  result:=result||jsonb_build_array(jsonb_build_object('assignment_id',new_id,'integrations',integrations));
 end loop;
 return result;
end $$;
revoke all on function pyr_unibague_private.apply_assignments(uuid,uuid,text,jsonb) from public,anon,authenticated;

create function public.pyr_unibague_confirm_assignment_batch(p_period_id uuid,p_run_id uuid,p_revision text,p_actions jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from jsonb_array_elements(p_actions) x where x->>'kind' is distinct from 'confirm') then raise exception 'Batch confirmation accepts confirm actions only' using errcode='22023'; end if;
 return pyr_unibague_private.apply_assignments(p_period_id,p_run_id,p_revision,p_actions);
end $$;
create function public.pyr_unibague_confirm_assignment(p_period_id uuid,p_run_id uuid,p_revision text,p_action jsonb)
returns jsonb language sql security definer set search_path='' as $$
 select pyr_unibague_private.apply_assignments(p_period_id,p_run_id,p_revision,jsonb_build_array(p_action||'{"kind":"confirm"}'::jsonb))
$$;
create function public.pyr_unibague_reassign_assignment(p_period_id uuid,p_run_id uuid,p_revision text,p_action jsonb)
returns jsonb language sql security definer set search_path='' as $$
 select pyr_unibague_private.apply_assignments(p_period_id,p_run_id,p_revision,jsonb_build_array(p_action||'{"kind":"reassign"}'::jsonb))
$$;
create function public.pyr_unibague_unassign_assignment(p_period_id uuid,p_run_id uuid,p_revision text,p_action jsonb)
returns jsonb language sql security definer set search_path='' as $$
 select pyr_unibague_private.apply_assignments(p_period_id,p_run_id,p_revision,jsonb_build_array(p_action||'{"kind":"unassign"}'::jsonb))
$$;
revoke all on function public.pyr_unibague_confirm_assignment_batch(uuid,uuid,text,jsonb),public.pyr_unibague_confirm_assignment(uuid,uuid,text,jsonb),public.pyr_unibague_reassign_assignment(uuid,uuid,text,jsonb),public.pyr_unibague_unassign_assignment(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.pyr_unibague_confirm_assignment_batch(uuid,uuid,text,jsonb),public.pyr_unibague_confirm_assignment(uuid,uuid,text,jsonb),public.pyr_unibague_reassign_assignment(uuid,uuid,text,jsonb),public.pyr_unibague_unassign_assignment(uuid,uuid,text,jsonb) to authenticated;
commit;
