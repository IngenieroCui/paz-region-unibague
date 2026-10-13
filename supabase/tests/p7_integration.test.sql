-- Six integrated flows. Disposable fixtures; run against 001-011, rollback all data.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.p7id(n integer) returns uuid language sql immutable as $$select ('77000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
insert into auth.users(id,email,raw_user_meta_data) select pg_temp.p7id(n),'p7-'||n||'@example.test',jsonb_build_object('display_name','Persona P7 '||n) from generate_series(1,8) n;
insert into "PYRUnibague_UserRoles"(user_id,role_id) select pg_temp.p7id(n),r.id from generate_series(1,8) n join "PYRUnibague_Roles" r
 on r.code=case when n=1 then 'ADMIN' when n in(2,7) then 'ORGANIZATION' when n in(5,6) then 'ADVISOR' else 'STUDENT' end;
insert into "PYRUnibague_StaffProfiles"(id,user_id,status) values(pg_temp.p7id(5),pg_temp.p7id(5),'active'),(pg_temp.p7id(6),pg_temp.p7id(6),'active');
insert into "PYRUnibague_AcademicPeriods"(id,code,name,status) values(pg_temp.p7id(10),'P7','P7 period','test'),(pg_temp.p7id(11),'P7-OTHER','Other period','test');
insert into "PYRUnibague_Organizations"(id,legal_name,status,verified_at) values(pg_temp.p7id(20),'Institución P7','approved',now()),(pg_temp.p7id(21),'Otra institución','approved',now());
insert into "PYRUnibague_OrganizationMembers"(organization_id,user_id,membership_role,can_manage,status) values(pg_temp.p7id(20),pg_temp.p7id(2),'manager',true,'active'),(pg_temp.p7id(21),pg_temp.p7id(7),'manager',true,'active');
insert into "PYRUnibague_Students"(id,user_id) select pg_temp.p7id(n),pg_temp.p7id(n) from unnest(array[3,4,8]) n;
insert into "PYRUnibague_StudentPeriodParticipations"(id,student_id,academic_period_id,status,eligible_for_matching) select pg_temp.p7id(100+n),pg_temp.p7id(n),pg_temp.p7id(10),'test',true from unnest(array[3,4,8]) n;

-- 1: Organization -> project -> two positions -> call -> administrative review.
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.p7id(2)::text,true);
insert into "PYRUnibague_Projects"(id,organization_id,academic_period_id,name,status,zone_type,created_by) values(pg_temp.p7id(30),pg_temp.p7id(20),pg_temp.p7id(10),'Proyecto P7','draft','urban',auth.uid());
insert into "PYRUnibague_ProjectPositions"(id,project_id,title,capacity,status) values(pg_temp.p7id(40),pg_temp.p7id(30),'Sistemas',2,'active'),(pg_temp.p7id(41),pg_temp.p7id(30),'Otra carrera',1,'active');
insert into "PYRUnibague_OrganizationContacts"(id,organization_id,full_name,is_primary) values(pg_temp.p7id(50),pg_temp.p7id(20),'Interlocutor operativo',true);
insert into "PYRUnibague_ProjectInterlocutors"(project_id,organization_contact_id,is_primary_for_project) values(pg_temp.p7id(30),pg_temp.p7id(50),true);
insert into "PYRUnibague_Calls"(id,organization_id,academic_period_id,title) values(pg_temp.p7id(60),pg_temp.p7id(20),pg_temp.p7id(10),'Convocatoria P7'),(pg_temp.p7id(61),pg_temp.p7id(20),pg_temp.p7id(10),'Mismas plazas');
insert into "PYRUnibague_CallPositions"(call_id,project_position_id) values(pg_temp.p7id(60),pg_temp.p7id(40)),(pg_temp.p7id(60),pg_temp.p7id(41)),(pg_temp.p7id(61),pg_temp.p7id(40));
update "PYRUnibague_Calls" set status='submitted' where id=pg_temp.p7id(60);
update "PYRUnibague_Projects" set status='submitted' where id=pg_temp.p7id(30);
select ok((select count(*)=0 from "PYRUnibague_Assignments"),'Call creation/submission creates no assignment');
select set_config('request.jwt.claim.sub',pg_temp.p7id(1)::text,true);
update "PYRUnibague_Projects" set status='approved' where id=pg_temp.p7id(30);
update "PYRUnibague_Calls" set status='open' where id=pg_temp.p7id(60);
insert into "PYRUnibague_ProjectParticipatingOrganizations"(project_id,organization_id) values(pg_temp.p7id(30),pg_temp.p7id(21));
select ok((select sum(capacity)=3 from "PYRUnibague_ProjectPositions" where project_id=pg_temp.p7id(30)),'2+1 real slots regardless of duplicate calls');
select public.pyr_unibague_change_organization_advisor(pg_temp.p7id(20),pg_temp.p7id(10),pg_temp.p7id(5));
insert into "PYRUnibague_Groups"(id,project_id,name) values(pg_temp.p7id(70),pg_temp.p7id(30),'Equipo A'),(pg_temp.p7id(71),pg_temp.p7id(30),'Equipo B');

-- 2: Eligible student -> completed matching -> reviewed global proposal -> confirm.
insert into "PYRUnibague_MatchingConfigurations"(id,name,algorithm_version,minimum_recommended_score,weights,rules,is_active) values(pg_temp.p7id(80),'P7','hybrid-v0.1',70,
 '{"academic":25,"skills":20,"experience":10,"interests":10,"location":10,"preference":10,"semantic":15}','{"requiredSkillsAreHardConstraint":true,"semanticEnabled":false}',true);
insert into "PYRUnibague_MatchingRuns"(id,academic_period_id,matching_configuration_id,status) values(pg_temp.p7id(81),pg_temp.p7id(10),pg_temp.p7id(80),'running');
insert into "PYRUnibague_MatchCandidates"(id,matching_run_id,student_id,project_position_id,is_eligible,total_score,blockers) values
 (pg_temp.p7id(90),pg_temp.p7id(81),pg_temp.p7id(3),pg_temp.p7id(40),true,92,'[]'),(pg_temp.p7id(91),pg_temp.p7id(81),pg_temp.p7id(4),pg_temp.p7id(40),true,94,'[]');
update "PYRUnibague_MatchingRuns" set status='completed',completed_at=now() where id=pg_temp.p7id(81);
select ok((pyr_unibague_assignment_snapshot(pg_temp.p7id(10),pg_temp.p7id(81))->'existing')='[]'::jsonb,'Snapshot/recommendation still consumes no slots');
select lives_ok($q$select pyr_unibague_confirm_assignment_batch(pg_temp.p7id(10),pg_temp.p7id(81),pyr_unibague_assignment_snapshot(pg_temp.p7id(10),pg_temp.p7id(81))->>'revision',jsonb_build_array(
 jsonb_build_object('kind','confirm','student_id',pg_temp.p7id(3),'position_id',pg_temp.p7id(40),'candidate_id',pg_temp.p7id(90),'source','MATCHING'),
 jsonb_build_object('kind','confirm','student_id',pg_temp.p7id(4),'position_id',pg_temp.p7id(40),'candidate_id',pg_temp.p7id(91),'source','MATCHING')))$q$,'Reviewed batch confirms both students transactionally');
select ok((select count(*)=2 from "PYRUnibague_AdvisorStudentAssignments" where advisor_id=pg_temp.p7id(5) and is_current and source_assignment_id is not null),'Each confirmed student links to advisor with assignment source');
select ok((select bool_and(metadata#>>'{integrations,advisor}'='linked') from "PYRUnibague_AssignmentEvents"),'Advisor integration recorded in immutable events');
select ok((select count(*)=0 from "PYRUnibague_GroupMembers"),'Multiple groups never cause arbitrary membership');

-- 3: Assignment -> individual advisor -> explicitly selected group -> ficha.
insert into "PYRUnibague_GroupMembers"(group_id,assignment_id) select pg_temp.p7id(70),id from "PYRUnibague_Assignments" where academic_period_id=pg_temp.p7id(10) and is_active;
select throws_ok($q$insert into "PYRUnibague_GroupMembers"(group_id,assignment_id) select pg_temp.p7id(71),id from "PYRUnibague_Assignments" where student_id=pg_temp.p7id(3) and is_active$q$,'23505',null,'Cannot join two groups with the same assignment');
select is(pyr_unibague_project_institutional(pg_temp.p7id(30))->'interlocutors'->0->>'displayName','Interlocutor operativo','Ficha reads linked operational contact');
select is(pyr_unibague_project_institutional(pg_temp.p7id(30))->'advisors'->0->>'displayName','Persona P7 5','Ficha reads regional advisor');
select is(pyr_unibague_project_institutional(pg_temp.p7id(30))->'organizations'->0->>'displayName','Otra institución','Ficha reads participating institutions through relations');
select ok(jsonb_array_length(pyr_unibague_project_team(pg_temp.p7id(30))->'members')=2,'Ficha team derives from actual GroupMembers');
select set_config('request.jwt.claim.sub',pg_temp.p7id(3)::text,true);
select is(pyr_unibague_student_assignment(pg_temp.p7id(10))->>'advisor','Persona P7 5','Student sees individual advisor');
select is(pyr_unibague_student_assignment(pg_temp.p7id(10))->'teammates'->0->>'name','Persona P7 4','Student sees only linked teammate');
select ok(not (pyr_unibague_student_assignment(pg_temp.p7id(10)) ?| array['candidate_id','score','reason_text','student_id']),'Student projection contains no internal matching/private data');
select set_config('request.jwt.claim.sub',pg_temp.p7id(8)::text,true);
select ok(pyr_unibague_student_assignment(pg_temp.p7id(10)) is null,'Unassigned student sees no other assignment');

-- 5: Organization advisor changes; individual responsibilities stay independent.
select set_config('request.jwt.claim.sub',pg_temp.p7id(1)::text,true);
select pyr_unibague_change_organization_advisor(pg_temp.p7id(20),pg_temp.p7id(10),pg_temp.p7id(6));
select ok((select count(*)=2 from "PYRUnibague_AdvisorStudentAssignments" where advisor_id=pg_temp.p7id(5) and is_current),'Organization change leaves assigned students with previous advisor');
select is(pyr_unibague_project_institutional(pg_temp.p7id(30))->'advisors'->0->>'displayName','Persona P7 6','Regional advisor projection changes independently');

-- 4: Reassignment and withdrawal free slots and close links, preserving histories.
reset role;
create function pg_temp.fail_integration() returns trigger language plpgsql as $$begin raise exception 'Integration fixture failure' using errcode='P0001';end$$;
create trigger p7_fail_integration before insert on "PYRUnibague_AdvisorStudentAssignments" for each row execute function pg_temp.fail_integration();
set local role authenticated;
select throws_ok($q$select pyr_unibague_reassign_assignment(pg_temp.p7id(10),null,pyr_unibague_assignment_snapshot(pg_temp.p7id(10),null)->>'revision',jsonb_build_object(
 'student_id',pg_temp.p7id(3),'assignment_id',(select id from "PYRUnibague_Assignments" where student_id=pg_temp.p7id(3) and is_active),
 'position_id',pg_temp.p7id(41),'source','MANUAL','allow_unscored',true,'reason_code','OTHER','reason_text','Failure must roll back'))$q$,'P0001',null,'Integration failure rolls back entire reassignment');
select ok((select count(*)=1 from "PYRUnibague_Assignments" where student_id=pg_temp.p7id(3) and is_active and project_position_id=pg_temp.p7id(40)),'Failed integration preserves original assignment and capacity');
select ok((select count(*)=1 from "PYRUnibague_AdvisorStudentAssignments" where participation_id=pg_temp.p7id(103) and advisor_id=pg_temp.p7id(5) and is_current),'Failed integration preserves current advisor');
select ok((select count(*)=2 from "PYRUnibague_GroupMembers" where status='active'),'Failed integration rolls back membership retirement');
reset role;
drop trigger p7_fail_integration on "PYRUnibague_AdvisorStudentAssignments";
set local role authenticated;
select lives_ok($q$select pyr_unibague_reassign_assignment(pg_temp.p7id(10),null,pyr_unibague_assignment_snapshot(pg_temp.p7id(10),null)->>'revision',jsonb_build_object(
 'student_id',pg_temp.p7id(3),'assignment_id',(select id from "PYRUnibague_Assignments" where student_id=pg_temp.p7id(3) and is_active),
 'position_id',pg_temp.p7id(41),'source','MANUAL','allow_unscored',true,'reason_code','OTHER','reason_text','P7 reassignment'))$q$,'Reassignment closes old advisor/membership and links current organization advisor');
select ok((select count(*)=2 and count(*) filter(where is_current)=1 from "PYRUnibague_AdvisorStudentAssignments" where participation_id=pg_temp.p7id(103)),'Advisor history retains old source and one current link');
select ok((select count(*)=1 from "PYRUnibague_GroupMembers" gm join "PYRUnibague_Assignments" a on a.id=gm.assignment_id where a.student_id=pg_temp.p7id(3) and gm.status='inactive'),'Reassignment closes former group membership without deleting it');
select ok((select count(*)=1 from "PYRUnibague_Assignments" where project_position_id=pg_temp.p7id(40) and is_active),'Old position immediately regains a slot');
select lives_ok($q$select pyr_unibague_unassign_assignment(pg_temp.p7id(10),null,pyr_unibague_assignment_snapshot(pg_temp.p7id(10),null)->>'revision',jsonb_build_object(
 'student_id',pg_temp.p7id(4),'assignment_id',(select id from "PYRUnibague_Assignments" where student_id=pg_temp.p7id(4) and is_active),'reason_code','OTHER','reason_text','P7 withdrawal'))$q$,'Withdrawal closes all integrated current responsibilities');
select ok(not exists(select 1 from "PYRUnibague_AdvisorStudentAssignments" where participation_id=pg_temp.p7id(104) and is_current),'No active advisor remains for withdrawn participation');
select ok((select count(*)=2 and bool_and(status='inactive') from "PYRUnibague_GroupMembers"),'All group histories survive retirement');
select pyr_unibague_change_organization_advisor(pg_temp.p7id(20),pg_temp.p7id(10),null);
select lives_ok($q$select pyr_unibague_confirm_assignment(pg_temp.p7id(10),null,pyr_unibague_assignment_snapshot(pg_temp.p7id(10),null)->>'revision',jsonb_build_object(
 'student_id',pg_temp.p7id(8),'position_id',pg_temp.p7id(40),'source','MANUAL','allow_unscored',true,'reason_code','OTHER','reason_text','No organization advisor'))$q$,'Missing advisor never invalidates valid student assignment');
select ok((select metadata#>>'{integrations,advisor}'='missing_advisor' from "PYRUnibague_AssignmentEvents" e join "PYRUnibague_Assignments" a on a.id=e.assignment_id where a.student_id=pg_temp.p7id(8)),'Missing advisor is explicitly recorded for manual ADMIN resolution');
select pyr_unibague_change_student_advisor(pg_temp.p7id(108),pg_temp.p7id(5),current_date,'Manual resolution',(select id from "PYRUnibague_Assignments" where student_id=pg_temp.p7id(8) and is_active));
select ok((select count(*)=1 from "PYRUnibague_AdvisorStudentAssignments" where participation_id=pg_temp.p7id(108) and is_current),'Existing ADMIN operation resolves missing advisor');

-- 6: Persisted roles, scoped projections and protected mutations.
select set_config('request.jwt.claim.sub',pg_temp.p7id(3)::text,true);
select throws_ok($q$select pyr_unibague_project_institutional(pg_temp.p7id(30))$q$,'42501',null,'Student cannot query institutional projection');
select throws_ok($q$select pyr_unibague_assignment_snapshot(pg_temp.p7id(10),null)$q$,'42501',null,'Student cannot see admin pool');
select throws_ok($q$update "PYRUnibague_Assignments" set is_active=false$q$,'42501',null,'Student cannot alter assignments');
select set_config('request.jwt.claim.sub',pg_temp.p7id(7)::text,true);
select throws_ok($q$select pyr_unibague_project_institutional(pg_temp.p7id(30))$q$,'42501',null,'Foreign organization cannot see ficha identities');
select ok((select count(*)=0 from "PYRUnibague_Projects" where id=pg_temp.p7id(30)),'Foreign organization project hidden by RLS');
select set_config('request.jwt.claim.sub',pg_temp.p7id(6)::text,true);
select ok(jsonb_array_length(pyr_unibague_advisor_workspace(pg_temp.p7id(10))->'students')=1,'Advisor sees only its individually assigned student');
select throws_ok($q$select pyr_unibague_student_assignment(pg_temp.p7id(10))$q$,'42501',null,'Advisor cannot impersonate student projection');
select throws_ok($q$select pyr_unibague_assignment_snapshot(pg_temp.p7id(10),null)$q$,'42501',null,'Advisor cannot access matching/assignment pool');
select set_config('request.jwt.claim.sub',pg_temp.p7id(1)::text,true);
select ok(not exists(select 1 from "PYRUnibague_Assignments" a join "PYRUnibague_ProjectPositions" pp on pp.id=a.project_position_id where a.is_active group by pp.id,pp.capacity having count(*)>pp.capacity),'Integrated operations preserve real position capacity');
select ok(exists(select 1 from "PYRUnibague_AuditLogs" where entity_table='PYRUnibague_AdvisorStudentAssignments' and actor_user_id=pg_temp.p7id(1)),'Advisor integration retains ADMIN actor in audit log');
reset role;
select finish();
rollback;
