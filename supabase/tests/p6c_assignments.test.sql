-- Disposable fixtures only; all data and temporary helper functions rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function pg_temp.p6id(n integer) returns uuid language sql immutable as $$ select ('66000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid $$;
insert into auth.users(id,email) select pg_temp.p6id(n),'p6c-'||n||'@example.test' from generate_series(1,6) n;
insert into "PYRUnibague_UserRoles"(user_id,role_id) select pg_temp.p6id(n),r.id from generate_series(1,6) n join "PYRUnibague_Roles" r
 on r.code=case when n=1 then 'ADMIN' when n in(2,4,6) then 'STUDENT' else 'ORGANIZATION' end;
insert into "PYRUnibague_AcademicPeriods"(id,code,name,status) values(pg_temp.p6id(10),'P6C-TEST','P6C fixture','test'),(pg_temp.p6id(11),'P6C-OTHER','Other period','test');
insert into "PYRUnibague_Students"(id,user_id) values(pg_temp.p6id(20),pg_temp.p6id(2)),(pg_temp.p6id(21),pg_temp.p6id(4)),(pg_temp.p6id(22),pg_temp.p6id(6));
insert into "PYRUnibague_StudentPeriodParticipations"(student_id,academic_period_id,status,eligible_for_matching)
 select pg_temp.p6id(n),pg_temp.p6id(10),'test',true from generate_series(20,22) n;
insert into "PYRUnibague_Organizations"(id,legal_name,status,verified_at,verified_by) values(pg_temp.p6id(30),'P6C fixture','approved',now(),pg_temp.p6id(1)),(pg_temp.p6id(31),'Unrelated fixture','approved',now(),pg_temp.p6id(1));
insert into "PYRUnibague_OrganizationMembers"(organization_id,user_id,membership_role,can_manage,status) values(pg_temp.p6id(30),pg_temp.p6id(3),'test',true,'active'),(pg_temp.p6id(31),pg_temp.p6id(5),'test',true,'active');
insert into "PYRUnibague_Projects"(id,organization_id,academic_period_id,name,status) values(pg_temp.p6id(40),pg_temp.p6id(30),pg_temp.p6id(10),'P6C project','approved'),(pg_temp.p6id(41),pg_temp.p6id(30),pg_temp.p6id(11),'Other period','approved');
insert into "PYRUnibague_ProjectPositions"(id,project_id,title,capacity,status) values(pg_temp.p6id(50),pg_temp.p6id(40),'A',1,'test'),(pg_temp.p6id(51),pg_temp.p6id(40),'B',1,'test'),(pg_temp.p6id(52),pg_temp.p6id(41),'Wrong period',1,'test');
insert into "PYRUnibague_MatchingConfigurations"(id,name,algorithm_version,minimum_recommended_score,weights,rules,is_active) values(pg_temp.p6id(60),'P6C fixture','hybrid-v0.1',70,
 '{"academic":25,"skills":20,"experience":10,"interests":10,"location":10,"preference":10,"semantic":15}',
 '{"requiredSkillsAreHardConstraint":true,"semanticEnabled":false}',true);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.p6id(1)::text,true);
insert into "PYRUnibague_MatchingRuns"(id,academic_period_id,matching_configuration_id,status) values(pg_temp.p6id(70),pg_temp.p6id(10),pg_temp.p6id(60),'running');
insert into "PYRUnibague_MatchCandidates"(id,matching_run_id,student_id,project_position_id,is_eligible,total_score,blockers) values
 (pg_temp.p6id(80),pg_temp.p6id(70),pg_temp.p6id(20),pg_temp.p6id(50),true,95,'[]'),
 (pg_temp.p6id(81),pg_temp.p6id(70),pg_temp.p6id(20),pg_temp.p6id(51),true,92,'[]'),
 (pg_temp.p6id(82),pg_temp.p6id(70),pg_temp.p6id(21),pg_temp.p6id(50),true,94,'[]'),
 (pg_temp.p6id(83),pg_temp.p6id(70),pg_temp.p6id(21),pg_temp.p6id(51),true,72,'[]'),
 (pg_temp.p6id(84),pg_temp.p6id(70),pg_temp.p6id(22),pg_temp.p6id(50),true,60,'[]'),
 (pg_temp.p6id(85),pg_temp.p6id(70),pg_temp.p6id(22),pg_temp.p6id(51),false,null,'[{"code":"BLOCKED"}]');
update "PYRUnibague_MatchingRuns" set status='completed',completed_at=now() where id=pg_temp.p6id(70);
insert into "PYRUnibague_MatchingRuns"(id,academic_period_id,matching_configuration_id,status) values(pg_temp.p6id(71),pg_temp.p6id(10),pg_temp.p6id(60),'running');
update "PYRUnibague_MatchingRuns" set status='failed',completed_at=now() where id=pg_temp.p6id(71);
insert into "PYRUnibague_MatchingRuns"(id,academic_period_id,matching_configuration_id,status) values(pg_temp.p6id(72),pg_temp.p6id(10),pg_temp.p6id(60),'running');
reset role;
create function pg_temp.p6action(s integer,p integer,c integer,source text default 'MATCHING') returns jsonb language sql as $$
 select jsonb_build_object('kind','confirm','student_id',pg_temp.p6id(s),'position_id',pg_temp.p6id(p),'candidate_id',case when c is null then null else pg_temp.p6id(c) end,'source',source)
$$;
create function pg_temp.p6decide(action jsonb,run_id uuid default pg_temp.p6id(70),revision text default null) returns jsonb language plpgsql as $$
declare rev text;
begin
 rev:=coalesce(revision,public.pyr_unibague_assignment_snapshot(pg_temp.p6id(10),run_id)->>'revision');
 if action->>'kind'='unassign' then return public.pyr_unibague_unassign_assignment(pg_temp.p6id(10),run_id,rev,action);
 elsif action->>'kind'='reassign' then return public.pyr_unibague_reassign_assignment(pg_temp.p6id(10),run_id,rev,action);
 else return public.pyr_unibague_confirm_assignment(pg_temp.p6id(10),run_id,rev,action); end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.p6id(1)::text,true);
select ok(jsonb_array_length(pyr_unibague_assignment_snapshot(pg_temp.p6id(10),pg_temp.p6id(70))->'candidates')=6,'Snapshot contains completed candidates without assignments');
select ok((select count(*)=0 from "PYRUnibague_Assignments"),'Reading a proposal creates no assignments');
select throws_ok($q$select pyr_unibague_assignment_snapshot(pg_temp.p6id(10),pg_temp.p6id(71))$q$,'22023',null,'Failed run cannot supply a proposal');
select throws_ok($q$select pyr_unibague_assignment_snapshot(pg_temp.p6id(10),pg_temp.p6id(72))$q$,'22023',null,'Running run cannot supply a proposal');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(22,50,84))$q$,'23514',null,'Automatic below-threshold candidate rejected');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(22,51,85))$q$,'23514',null,'Blocked candidate rejected');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(20,50,82))$q$,'23514',null,'Candidate identity mismatch rejected');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(20,52,null,'MANUAL')||'{"reason_code":"OTHER","reason_text":"Wrong-period test","allow_unscored":true}')$q$,'23514',null,'Manual cannot bypass period integrity');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(20,50,null,'MANUAL'))$q$,'22023',null,'Manual intervention requires reason');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(22,50,84,'MANUAL')||'{"reason_code":"OTHER","reason_text":"Fixture only"}')$q$,'23514',null,'Manual below threshold requires explicit confirmation');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(22,51,85,'MANUAL')||'{"reason_code":"OTHER","reason_text":"Fixture only","allow_below_threshold":true}')$q$,'23514',null,'Manual cannot bypass blockers');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(22,50,null,'MANUAL')||'{"reason_code":"OTHER","reason_text":"Fixture only","allow_unscored":true}')$q$,'23514',null,'Manual cannot omit an existing candidate in the selected run');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(20,50,80),pg_temp.p6id(70),'old-revision')$q$,'P0001',null,'Stale proposal is rejected entirely');
select set_config('p6c.original_revision',pyr_unibague_assignment_snapshot(pg_temp.p6id(10),pg_temp.p6id(70))->>'revision',true);
select lives_ok($q$select pg_temp.p6decide(pg_temp.p6action(20,51,81))$q$,'Admin confirms individual assignment');
select ok((select count(*)=1 and bool_and(source='MATCHING' and assigned_by=auth.uid() and match_candidate_id=pg_temp.p6id(81)) from "PYRUnibague_Assignments"),'Assignment captures source, actor and candidate');
select ok((select count(*)=1 and bool_and(actor_user_id=auth.uid() and event_type='ASSIGNED') from "PYRUnibague_AssignmentEvents"),'Confirmation event records actor');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(21,50,82),pg_temp.p6id(70),current_setting('p6c.original_revision'))$q$,'P0001',null,'Intervening confirmation invalidates previous revision');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(20,50,80))$q$,'23514',null,'Confirmed student cannot be silently moved');
select throws_ok($q$select pyr_unibague_confirm_assignment_batch(pg_temp.p6id(10),pg_temp.p6id(70),pyr_unibague_assignment_snapshot(pg_temp.p6id(10),pg_temp.p6id(70))->>'revision',jsonb_build_array(pg_temp.p6action(21,50,82),pg_temp.p6action(22,50,84)))$q$,'P0001',null,'Overcapacity batch rejected atomically');
select ok((select count(*)=1 from "PYRUnibague_Assignments"),'Rejected batch retains no partial assignments');
select lives_ok($q$select pg_temp.p6decide(pg_temp.p6action(21,50,82))$q$,'Remaining position can be confirmed');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(22,50,84,'MANUAL')||'{"reason_code":"OTHER","reason_text":"Fixture only","allow_below_threshold":true}')$q$,'P0001',null,'Manual confirmation cannot exceed capacity');
select throws_ok($q$update "PYRUnibague_Assignments" set is_active=false$q$,'42501',null,'Even admin direct assignment writes are revoked');
select throws_ok($q$delete from "PYRUnibague_AssignmentEvents"$q$,'42501',null,'Direct history deletion is revoked');
select throws_ok($q$update "PYRUnibague_ProjectPositions" set capacity=0 where id=pg_temp.p6id(50)$q$,'23514',null,'Capacity reduction below occupancy rejected');
select throws_ok($q$update "PYRUnibague_ProjectPositions" set project_id=pg_temp.p6id(41) where id=pg_temp.p6id(50)$q$,'23514',null,'Position with assignment history cannot move project');
select throws_ok($q$update "PYRUnibague_Projects" set academic_period_id=pg_temp.p6id(11) where id=pg_temp.p6id(40)$q$,'23514',null,'Project with assignment history cannot move period');
select lives_ok($q$select pg_temp.p6decide(jsonb_build_object('kind','unassign','student_id',pg_temp.p6id(21),'assignment_id',(select id from "PYRUnibague_Assignments" where student_id=pg_temp.p6id(21) and is_active),'reason_code','DATA_CORRECTION','reason_text','P6C withdrawal fixture'))$q$,'Withdrawal closes assignment transactionally');
select ok((select count(*)=2 and count(*) filter(where is_active)=1 and count(*) filter(where unassigned_at is not null)=1 from "PYRUnibague_Assignments"),'Withdrawal preserves history and returns capacity');
select lives_ok($q$select pg_temp.p6decide(pg_temp.p6action(20,50,80,'MANUAL')||jsonb_build_object('kind','reassign','assignment_id',(select id from "PYRUnibague_Assignments" where student_id=pg_temp.p6id(20) and is_active),'reason_code','COORDINATION_REQUEST','reason_text','P6C reassignment fixture'))$q$,'Reassignment closes previous and creates new assignment');
select ok((select count(*)=3 and count(*) filter(where is_active)=1 and count(*) filter(where source='MANUAL')=1 from "PYRUnibague_Assignments"),'Reassignment preserves all previous records');
select ok((select count(*)=2 from "PYRUnibague_AssignmentEvents" where event_type in('REASSIGNED_FROM','REASSIGNED_TO')),'Reassignment records both events');
select lives_ok($q$select pg_temp.p6decide(pg_temp.p6action(21,51,83))$q$,'Released previous position is available again');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(21,50,82,'MANUAL')||jsonb_build_object('kind','reassign','assignment_id',(select id from "PYRUnibague_Assignments" where student_id=pg_temp.p6id(21) and is_active),'reason_code','OTHER','reason_text','Full destination fixture'))$q$,'P0001',null,'Failed reassignment rolls back the previous closure');
select ok((select is_active from "PYRUnibague_Assignments" where student_id=pg_temp.p6id(21) order by assigned_at desc limit 1),'Previous assignment stays active after failed reassignment');
select set_config('request.jwt.claim.sub',pg_temp.p6id(2)::text,true);
select ok((select count(*)=2 and bool_and(student_id=pg_temp.p6id(20)) from "PYRUnibague_Assignments"),'Student sees only own current and historical assignments');
select ok((select count(*)=0 from "PYRUnibague_AssignmentEvents"),'Student cannot see administrative reasons');
select throws_ok($q$select pyr_unibague_confirm_assignment(pg_temp.p6id(10),null,'forged','{}')$q$,'42501',null,'Student cannot confirm even through RPC');
select throws_ok($q$select pyr_unibague_assignment_snapshot(pg_temp.p6id(10),pg_temp.p6id(70))$q$,'42501',null,'Student cannot obtain admin proposal snapshot');
select throws_ok($q$insert into "PYRUnibague_Assignments"(academic_period_id,student_id,project_position_id,status,source) values(pg_temp.p6id(10),pg_temp.p6id(20),pg_temp.p6id(50),'confirmed','MANUAL')$q$,'42501',null,'Student cannot directly insert assignment');
select set_config('request.jwt.claim.sub',pg_temp.p6id(3)::text,true);
select ok((select count(*)=4 from "PYRUnibague_Assignments"),'Organization member sees assignments on own positions');
select throws_ok($q$select pyr_unibague_unassign_assignment(pg_temp.p6id(10),null,'forged','{}')$q$,'42501',null,'Organization cannot unassign through RPC');
select throws_ok($q$update "PYRUnibague_Assignments" set notes='forged'$q$,'42501',null,'Organization cannot modify assignments directly');
select set_config('request.jwt.claim.sub',pg_temp.p6id(5)::text,true);
select ok((select count(*)=0 from "PYRUnibague_Assignments"),'Unrelated organization sees no assignments');
reset role;
set local role anon;
select throws_ok($q$select pyr_unibague_assignment_snapshot(pg_temp.p6id(10),null)$q$,'42501',null,'Anonymous snapshot execution denied');
select throws_ok($q$select * from "PYRUnibague_Assignments"$q$,'42501',null,'Anonymous assignment reads denied');
reset role;
-- Legacy missing snapshot fixture created only in this rolled-back test.
alter table "PYRUnibague_MatchingRuns" disable trigger pyr_matching_run_guard;
insert into "PYRUnibague_MatchingRuns"(id,academic_period_id,matching_configuration_id,status,started_at,completed_at,summary) values(pg_temp.p6id(73),pg_temp.p6id(10),pg_temp.p6id(60),'completed',now(),now(),'{}');
alter table "PYRUnibague_MatchingRuns" enable trigger pyr_matching_run_guard;
insert into "PYRUnibague_MatchCandidates"(id,matching_run_id,student_id,project_position_id,is_eligible,total_score) values(pg_temp.p6id(86),pg_temp.p6id(73),pg_temp.p6id(22),pg_temp.p6id(51),true,99);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.p6id(1)::text,true);
-- Free B then verify manual below-threshold, missing snapshot, current institutional checks.
select pg_temp.p6decide(jsonb_build_object('kind','unassign','student_id',pg_temp.p6id(21),'assignment_id',(select id from "PYRUnibague_Assignments" where student_id=pg_temp.p6id(21) and is_active),'reason_code','OTHER','reason_text','Further checks fixture'));
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(22,51,86),pg_temp.p6id(73))$q$,'23514',null,'Missing historical threshold never receives invented default');
update "PYRUnibague_ProjectPositions" set capacity=2 where id=pg_temp.p6id(50);
select lives_ok($q$select pg_temp.p6decide(pg_temp.p6action(22,50,84,'MANUAL')||'{"reason_code":"AUTHORIZED_SPECIAL_CASE","reason_text":"Explicit below threshold fixture","allow_below_threshold":true}')$q$,'Explicit reason and confirmation allow manual below threshold');
select ok((select count(*)<=2 from "PYRUnibague_Assignments" where project_position_id=pg_temp.p6id(50) and is_active),'Multi-capacity position never exceeds its limit');
select set_config('p6c.before_eligibility',pyr_unibague_assignment_snapshot(pg_temp.p6id(10),pg_temp.p6id(70))->>'revision',true);
update "PYRUnibague_StudentPeriodParticipations" set eligible_for_matching=false where student_id=pg_temp.p6id(21);
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(21,51,83),pg_temp.p6id(70),current_setting('p6c.before_eligibility'))$q$,'P0001',null,'Eligibility edit invalidates draft revision');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(21,51,83))$q$,'23514',null,'Fresh draft still cannot bypass institutional eligibility');
update "PYRUnibague_StudentPeriodParticipations" set eligible_for_matching=true where student_id=pg_temp.p6id(21);
update "PYRUnibague_Organizations" set status='pending_review' where id=pg_temp.p6id(30);
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(21,51,83))$q$,'23514',null,'Unvalidated organization blocks automatic assignment');
update "PYRUnibague_Organizations" set status='approved' where id=pg_temp.p6id(30);
update "PYRUnibague_Projects" set status='submitted' where id=pg_temp.p6id(40);
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(21,51,83))$q$,'23514',null,'Unapproved project blocks automatic assignment');
update "PYRUnibague_Projects" set status='approved' where id=pg_temp.p6id(40);
insert into "PYRUnibague_AcademicPrograms"(id,code,name) values(pg_temp.p6id(90),'P6C-PROGRAM','Required program fixture');
insert into "PYRUnibague_ProjectPositionPrograms"(project_position_id,academic_program_id,is_required) values(pg_temp.p6id(51),pg_temp.p6id(90),true);
select ok((select not (x->>'currentEligible')::boolean from jsonb_array_elements(pyr_unibague_assignment_snapshot(pg_temp.p6id(10),pg_temp.p6id(70))->'candidates') x where x->>'id'=pg_temp.p6id(83)::text),'Snapshot excludes historical candidate blocked by current academic requirement');
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(21,51,83))$q$,'23514',null,'Current academic requirement is revalidated at confirmation');
update "PYRUnibague_Students" set academic_program_id=pg_temp.p6id(90) where id=pg_temp.p6id(21);
insert into "PYRUnibague_Skills"(id,name) values(pg_temp.p6id(91),'P6C required skill fixture');
insert into "PYRUnibague_ProjectPositionSkills"(project_position_id,skill_id,is_required) values(pg_temp.p6id(51),pg_temp.p6id(91),true);
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(21,51,83))$q$,'23514',null,'Current hard skill requirement is revalidated at confirmation');
select set_config('p6c.before_skill',pyr_unibague_assignment_snapshot(pg_temp.p6id(10),pg_temp.p6id(70))->>'revision',true);
insert into "PYRUnibague_StudentSkills"(student_id,skill_id) values(pg_temp.p6id(21),pg_temp.p6id(91));
select throws_ok($q$select pg_temp.p6decide(pg_temp.p6action(21,51,83),pg_temp.p6id(70),current_setting('p6c.before_skill'))$q$,'P0001',null,'Child skill edit invalidates draft without relying on parent timestamp');
select ok((select (x->>'currentEligible')::boolean from jsonb_array_elements(pyr_unibague_assignment_snapshot(pg_temp.p6id(10),pg_temp.p6id(70))->'candidates') x where x->>'id'=pg_temp.p6id(83)::text),'Snapshot recognizes satisfied current hard requirements');
select throws_ok($q$select pyr_unibague_confirm_assignment_batch(pg_temp.p6id(10),pg_temp.p6id(70),pyr_unibague_assignment_snapshot(pg_temp.p6id(10),pg_temp.p6id(70))->>'revision',jsonb_build_array(pg_temp.p6action(21,51,83),pg_temp.p6action(21,51,83)))$q$,'22023',null,'Duplicate students in batch rejected');
select throws_ok($q$select pyr_unibague_private.apply_assignments(pg_temp.p6id(10),null,'forged','[]')$q$,'42501',null,'Private write helper cannot be called by authenticated clients');
select lives_ok($q$select pg_temp.p6decide(pg_temp.p6action(21,51,null,'MANUAL')||'{"reason_code":"INSTITUTIONAL_NEED","reason_text":"Unscored manual fixture","allow_unscored":true}',null)$q$,'Explicit unscored manual assignment preserves institutional hard constraints');
select ok((select notes is null from "PYRUnibague_Assignments" where student_id=pg_temp.p6id(21) and is_active),'Private intervention reason stays in admin-only events, not participant-readable notes');
select pg_temp.p6decide(jsonb_build_object('kind','unassign','student_id',pg_temp.p6id(20),'assignment_id',(select id from "PYRUnibague_Assignments" where student_id=pg_temp.p6id(20) and is_active),'reason_code','OTHER','reason_text','Batch success fixture'));
select pg_temp.p6decide(jsonb_build_object('kind','unassign','student_id',pg_temp.p6id(21),'assignment_id',(select id from "PYRUnibague_Assignments" where student_id=pg_temp.p6id(21) and is_active),'reason_code','OTHER','reason_text','Batch success fixture'));
select lives_ok($q$select pyr_unibague_confirm_assignment_batch(pg_temp.p6id(10),pg_temp.p6id(70),pyr_unibague_assignment_snapshot(pg_temp.p6id(10),pg_temp.p6id(70))->>'revision',jsonb_build_array(pg_temp.p6action(20,50,80),pg_temp.p6action(21,51,83)))$q$,'Valid confirmation batch commits all rows');
select ok((select count(*)=3 from "PYRUnibague_Assignments" where is_active),'Successful batch respects existing manual occupancy');
select ok((select bool_and(metadata#>>'{integrations,advisor}'='missing_advisor' and metadata#>>'{integrations,group}'='selection_required') from "PYRUnibague_AssignmentEvents" where event_type='ASSIGNED'),'Integrated confirmation records missing advisor and explicit group selection');
reset role;
select throws_ok($q$delete from "PYRUnibague_Assignments"$q$,'23514',null,'History deletion guarded even for privileged maintenance');
select throws_ok($q$update "PYRUnibague_AssignmentEvents" set reason_text='changed'$q$,'23514',null,'Audit events cannot be rewritten');
select ok(not exists(select 1 from "PYRUnibague_Assignments" a join "PYRUnibague_ProjectPositions" pp on pp.id=a.project_position_id where a.is_active group by pp.id,pp.capacity having count(*)>pp.capacity),'No position exceeds capacity after all operations');
select * from finish();
rollback;
