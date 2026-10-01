begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
insert into auth.users (id,email) values
('55000000-0000-0000-0000-000000000001','p5-admin@example.test'),
('55000000-0000-0000-0000-000000000002','p5-student@example.test'),
('55000000-0000-0000-0000-000000000003','p5-org@example.test');
insert into "PYRUnibague_UserRoles" (user_id,role_id)
select u.id,r.id from auth.users u cross join "PYRUnibague_Roles" r where
(u.id='55000000-0000-0000-0000-000000000001' and r.code='ADMIN') or
(u.id='55000000-0000-0000-0000-000000000002' and r.code='STUDENT') or
(u.id='55000000-0000-0000-0000-000000000003' and r.code='ORGANIZATION');
insert into "PYRUnibague_AcademicPeriods"(id,code,name,status) values ('55000000-0000-0000-0000-000000000010','P5-TEST','Test only','test');
insert into "PYRUnibague_Students"(id,user_id) values ('55000000-0000-0000-0000-000000000020','55000000-0000-0000-0000-000000000002');
insert into "PYRUnibague_Organizations"(id,legal_name,status) values ('55000000-0000-0000-0000-000000000030','P5 fixture only','test');
insert into "PYRUnibague_Projects"(id,organization_id,academic_period_id,name,status) values ('55000000-0000-0000-0000-000000000040','55000000-0000-0000-0000-000000000030','55000000-0000-0000-0000-000000000010','P5 fixture','test');
insert into "PYRUnibague_ProjectPositions"(id,project_id,title,capacity,status) values ('55000000-0000-0000-0000-000000000050','55000000-0000-0000-0000-000000000040','P5 fixture',1,'test');
insert into "PYRUnibague_MatchingConfigurations"(id,academic_period_id,name,algorithm_version,minimum_recommended_score,weights,rules,is_active)
values ('55000000-0000-0000-0000-000000000060','55000000-0000-0000-0000-000000000010','P5 test','hybrid-v0.1',70,
'{"academic":25,"skills":20,"experience":10,"interests":10,"location":10,"preference":10,"semantic":15}',
'{"requiredSkillsAreHardConstraint":true,"semanticEnabled":false}',true);
create function pg_temp.denied_p5(statement text) returns boolean language plpgsql as $$ begin execute statement; return false; exception when insufficient_privilege then return true; end $$;
set local role anon;
select ok(pg_temp.denied_p5($q$select * from public."PYRUnibague_MatchCandidates"$q$),'anon cannot read candidates');
select ok(pg_temp.denied_p5($q$insert into public."PYRUnibague_MatchingRuns"(academic_period_id,matching_configuration_id,status) values ('55000000-0000-0000-0000-000000000010','55000000-0000-0000-0000-000000000060','running')$q$),'anon cannot run');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','55000000-0000-0000-0000-000000000002',true);
select ok((select count(*)=0 from "PYRUnibague_MatchCandidates"),'STUDENT sees no candidates');
select ok(pg_temp.denied_p5($q$insert into public."PYRUnibague_MatchingRuns"(academic_period_id,matching_configuration_id,status) values ('55000000-0000-0000-0000-000000000010','55000000-0000-0000-0000-000000000060','running')$q$),'STUDENT cannot run');
select set_config('request.jwt.claim.sub','55000000-0000-0000-0000-000000000003',true);
select ok(pg_temp.denied_p5($q$insert into public."PYRUnibague_MatchingRuns"(academic_period_id,matching_configuration_id,status) values ('55000000-0000-0000-0000-000000000010','55000000-0000-0000-0000-000000000060','running')$q$),'ORGANIZATION cannot run');
select set_config('request.jwt.claim.sub','55000000-0000-0000-0000-000000000001',true);
select lives_ok($q$insert into public."PYRUnibague_MatchingRuns"(id,academic_period_id,matching_configuration_id,status,started_by) values ('55000000-0000-0000-0000-000000000070','55000000-0000-0000-0000-000000000010','55000000-0000-0000-0000-000000000060','running','55000000-0000-0000-0000-000000000003')$q$,'ADMIN can run');
select ok((select started_by=auth.uid() and summary->'configuration_snapshot'->>'minimum_recommended_score'='70' from "PYRUnibague_MatchingRuns" where id='55000000-0000-0000-0000-000000000070'),'Actor and configuration snapshot protected');
select throws_ok($q$insert into public."PYRUnibague_MatchingRuns"(academic_period_id,matching_configuration_id,status) values ('55000000-0000-0000-0000-000000000010','55000000-0000-0000-0000-000000000060','running')$q$,'23505',null,'Two running runs cannot share same combination');
select throws_ok($q$update public."PYRUnibague_MatchingConfigurations" set minimum_recommended_score=71 where id='55000000-0000-0000-0000-000000000060'$q$,'23514',null,'Used threshold immutable');
select throws_ok($q$update public."PYRUnibague_MatchingConfigurations" set algorithm_version='hybrid-v0.2' where id='55000000-0000-0000-0000-000000000060'$q$,'23514',null,'Used version immutable');
select throws_ok($q$update public."PYRUnibague_MatchingConfigurations" set academic_period_id=null where id='55000000-0000-0000-0000-000000000060'$q$,'23514',null,'Used period immutable');
select throws_ok($q$update public."PYRUnibague_MatchingConfigurations" set weights=weights||'{"academic":24,"skills":21}' where id='55000000-0000-0000-0000-000000000060'$q$,'23514',null,'Used weights immutable');
select throws_ok($q$update public."PYRUnibague_MatchingConfigurations" set rules=rules||'{"semanticEnabled":true}' where id='55000000-0000-0000-0000-000000000060'$q$,'23514',null,'Used rules immutable');
select lives_ok($q$update public."PYRUnibague_MatchingConfigurations" set name='Renamed',is_active=false where id='55000000-0000-0000-0000-000000000060'$q$,'Metadata remains manageable');
update "PYRUnibague_MatchingConfigurations" set is_active=true where id='55000000-0000-0000-0000-000000000060';
select throws_ok($q$update public."PYRUnibague_MatchingRuns" set summary='{}' where id='55000000-0000-0000-0000-000000000070'$q$,'23514',null,'Historical snapshot cannot be erased');
select lives_ok($q$insert into public."PYRUnibague_MatchCandidates"(matching_run_id,student_id,project_position_id,is_eligible,total_score) values ('55000000-0000-0000-0000-000000000070','55000000-0000-0000-0000-000000000020','55000000-0000-0000-0000-000000000050',true,80)$q$,'ADMIN writes candidates');
select ok((select count(*)=1 from "PYRUnibague_MatchCandidates"),'ADMIN reads candidates');
select throws_ok($q$update public."PYRUnibague_MatchCandidates" set is_eligible=false where matching_run_id='55000000-0000-0000-0000-000000000070'$q$,'23514',null,'Blocked candidate cannot retain a total score');
update "PYRUnibague_MatchingRuns" set status='completed',completed_at=now() where id='55000000-0000-0000-0000-000000000070';
select lives_ok($q$insert into public."PYRUnibague_MatchingRuns"(id,academic_period_id,matching_configuration_id,status) values ('55000000-0000-0000-0000-000000000071','55000000-0000-0000-0000-000000000010','55000000-0000-0000-0000-000000000060','running')$q$,'Completed run allows rerun');
update "PYRUnibague_MatchingRuns" set status='failed',completed_at=now() where id='55000000-0000-0000-0000-000000000071';
select lives_ok($q$insert into public."PYRUnibague_MatchingRuns"(academic_period_id,matching_configuration_id,status) values ('55000000-0000-0000-0000-000000000010','55000000-0000-0000-0000-000000000060','running')$q$,'Failed run allows rerun');
select throws_ok($q$delete from public."PYRUnibague_MatchingRuns" where id='55000000-0000-0000-0000-000000000071'$q$,'23514',null,'History retained even without candidates');
select lives_ok($q$insert into public."PYRUnibague_MatchingConfigurations"(name,algorithm_version,minimum_recommended_score,weights,rules,is_active) select name||' copy',algorithm_version,minimum_recommended_score,weights,rules,false from public."PYRUnibague_MatchingConfigurations" where id='55000000-0000-0000-0000-000000000060'$q$,'Duplicate configuration is legal');
select throws_ok($q$insert into public."PYRUnibague_MatchingConfigurations"(name,algorithm_version,minimum_recommended_score,weights,rules) values ('Invalid','hybrid-v0.1',70,'{"academic":24,"skills":20,"experience":10,"interests":10,"location":10,"preference":10,"semantic":15}','{"requiredSkillsAreHardConstraint":true,"semanticEnabled":false}')$q$,'22023',null,'Invalid sum rejected in DB');
select set_config('request.jwt.claim.sub','55000000-0000-0000-0000-000000000002',true);
select ok((select count(*)=0 from "PYRUnibague_MatchCandidates"),'STUDENT cannot read actual candidate');
select ok(pg_temp.denied_p5($q$insert into public."PYRUnibague_MatchCandidates"(matching_run_id,student_id,project_position_id,is_eligible) values ('55000000-0000-0000-0000-000000000071','55000000-0000-0000-0000-000000000020','55000000-0000-0000-0000-000000000050',true)$q$),'STUDENT cannot write candidate');
select set_config('request.jwt.claim.sub','55000000-0000-0000-0000-000000000003',true);
select ok((select count(*)=0 from "PYRUnibague_MatchCandidates"),'ORGANIZATION cannot read actual candidate');
select ok(pg_temp.denied_p5($q$insert into public."PYRUnibague_MatchCandidates"(matching_run_id,student_id,project_position_id,is_eligible) values ('55000000-0000-0000-0000-000000000071','55000000-0000-0000-0000-000000000020','55000000-0000-0000-0000-000000000050',true)$q$),'ORGANIZATION cannot write candidate');
reset role;
select * from finish();
rollback;
