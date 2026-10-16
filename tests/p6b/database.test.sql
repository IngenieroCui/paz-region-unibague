-- Execute on an isolated Supabase test database with the integrated 001-011 schema.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.id(n integer) returns uuid language sql immutable as $$ select ('b6000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid $$;
insert into auth.users(id,email,raw_user_meta_data)
select pg_temp.id(n),'p6b-'||n||'@example.test',jsonb_build_object('display_name','Persona de prueba '||n) from generate_series(1,8) n;
insert into public."PYRUnibague_UserRoles"(user_id,role_id)
select pg_temp.id(1),id from public."PYRUnibague_Roles" where code='ADMIN';
insert into public."PYRUnibague_UserRoles"(user_id,role_id)
select pg_temp.id(n),r.id from generate_series(2,4) n cross join public."PYRUnibague_Roles" r where r.code='ORGANIZATION';
insert into public."PYRUnibague_UserRoles"(user_id,role_id)
select pg_temp.id(n),r.id from generate_series(5,8) n cross join public."PYRUnibague_Roles" r where r.code='STUDENT';
insert into public."PYRUnibague_AcademicPeriods"(id,code,name,status) values(pg_temp.id(10),'P6B-A','Periodo A','test'),(pg_temp.id(11),'P6B-B','Periodo B','test');
insert into public."PYRUnibague_AcademicPrograms"(id,code,name) values(pg_temp.id(12),'P6B-S','Sistemas'),(pg_temp.id(13),'P6B-M','Mecánica');
insert into public."PYRUnibague_Organizations"(id,legal_name,status) values(pg_temp.id(20),'Institución A','approved'),(pg_temp.id(21),'Institución B','approved');
insert into public."PYRUnibague_OrganizationMembers"(organization_id,user_id,membership_role,can_manage,status) values
 (pg_temp.id(20),pg_temp.id(2),'manager',true,'active'),(pg_temp.id(21),pg_temp.id(3),'manager',true,'active'),(pg_temp.id(20),pg_temp.id(4),'reader',false,'active');
insert into public."PYRUnibague_Projects"(id,organization_id,academic_period_id,name,status,zone_type) values
 (pg_temp.id(30),pg_temp.id(20),pg_temp.id(10),'Proyecto Sistemas','draft','rural'),
 (pg_temp.id(31),pg_temp.id(20),pg_temp.id(10),'Proyecto Mecánica','draft','urban'),
 (pg_temp.id(32),pg_temp.id(21),pg_temp.id(10),'Proyecto otra institución','draft',null),
 (pg_temp.id(33),pg_temp.id(20),pg_temp.id(11),'Proyecto otro periodo','draft',null);
insert into public."PYRUnibague_ProjectPositions"(id,project_id,title,capacity,status) values
 (pg_temp.id(40),pg_temp.id(30),'Sistemas',2,'open'),(pg_temp.id(41),pg_temp.id(31),'Mecánica',1,'open'),
 (pg_temp.id(42),pg_temp.id(32),'Otra institución',1,'open'),(pg_temp.id(43),pg_temp.id(33),'Otro periodo',1,'open');
insert into public."PYRUnibague_ProjectPositionPrograms"(project_position_id,academic_program_id) values
 (pg_temp.id(40),pg_temp.id(12)),(pg_temp.id(41),pg_temp.id(13));
insert into public."PYRUnibague_Students"(id,user_id,academic_program_id) select pg_temp.id(100+n),pg_temp.id(n),pg_temp.id(12) from generate_series(5,8) n;
insert into public."PYRUnibague_StudentPeriodParticipations"(student_id,academic_period_id,status,eligible_for_matching) select id,pg_temp.id(10),'test',true from public."PYRUnibague_Students" where id in (pg_temp.id(105),pg_temp.id(106),pg_temp.id(107),pg_temp.id(108));
insert into public."PYRUnibague_Assignments"(id,student_id,project_position_id,academic_period_id,status,source) values
 (pg_temp.id(50),pg_temp.id(105),pg_temp.id(40),pg_temp.id(10),'confirmed','MANUAL'),
 (pg_temp.id(51),pg_temp.id(106),pg_temp.id(42),pg_temp.id(10),'confirmed','MANUAL'),
 (pg_temp.id(52),pg_temp.id(107),pg_temp.id(41),pg_temp.id(10),'confirmed','MANUAL'),
 (pg_temp.id(53),pg_temp.id(108),pg_temp.id(40),pg_temp.id(10),'pending','MANUAL');
insert into public."PYRUnibague_Groups"(id,project_id,name,status) values
 (pg_temp.id(60),pg_temp.id(30),'Equipo Sistemas 1','active'),(pg_temp.id(61),pg_temp.id(30),'Equipo Sistemas 2','active'),
 (pg_temp.id(62),pg_temp.id(31),'Equipo Mecánica','active'),(pg_temp.id(63),pg_temp.id(32),'Equipo institución B','active');
insert into public."PYRUnibague_Calls"(id,organization_id,academic_period_id,title) values
 (pg_temp.id(70),pg_temp.id(20),pg_temp.id(10),'Convocatoria A'),(pg_temp.id(71),pg_temp.id(20),pg_temp.id(10),'Convocatoria A2'),
 (pg_temp.id(72),pg_temp.id(21),pg_temp.id(10),'Convocatoria B');
select is((select count(*)::integer from information_schema.columns where table_name='PYRUnibague_Calls'),10,'Calls has exactly v0.4 columns');
select is((select count(*)::integer from information_schema.columns where table_name='PYRUnibague_CallPositions'),5,'CallPositions does not store capacity');
select is((select count(*)::integer from information_schema.columns where table_name='PYRUnibague_Groups'),7,'Groups has exactly v0.4 columns');
select is((select count(*)::integer from information_schema.columns where table_name='PYRUnibague_GroupMembers'),8,'GroupMembers has exactly v0.4 columns');
select throws_ok($$update public."PYRUnibague_Projects" set zone_type='remote' where id=pg_temp.id(30)$$,'23514',null,'Only rural/urban/null zones');
select is((select zone_type from public."PYRUnibague_Projects" where id=pg_temp.id(30)),'rural','Rural persisted');
select is((select zone_type from public."PYRUnibague_Projects" where id=pg_temp.id(31)),'urban','Urban persisted');
select is((select count(*)::integer from public."PYRUnibague_Groups" where project_id=pg_temp.id(30)),2,'Multiple groups per project');
select set_config('request.jwt.claim.sub',pg_temp.id(2)::text,true);
set local role authenticated;
select is((select count(*)::integer from public."PYRUnibague_Calls"),2,'Organization only sees own calls');
select is((select count(*)::integer from public."PYRUnibague_Groups"),3,'Organization only sees own project teams');
select throws_ok($$insert into public."PYRUnibague_Groups"(project_id,name) values(pg_temp.id(32),'Foreign team')$$,'42501',null,'Cannot create teams for another organization');
select throws_ok($$insert into public."PYRUnibague_Calls"(organization_id,academic_period_id,title) values(pg_temp.id(21),pg_temp.id(10),'Foreign call')$$,'42501',null,'Cannot create calls for another organization');
select throws_ok($$update public."PYRUnibague_Calls" set status='open' where id=pg_temp.id(71)$$,'23514',null,'Cannot publish a call without positions');
select lives_ok($$insert into public."PYRUnibague_CallPositions"(call_id,project_position_id) values(pg_temp.id(70),pg_temp.id(40)),(pg_temp.id(70),pg_temp.id(41)),(pg_temp.id(71),pg_temp.id(40))$$,'One call spans distinct projects in the same institution');
select is((select pp.capacity from public."PYRUnibague_ProjectPositions" pp join public."PYRUnibague_ProjectPositionPrograms" pr on pr.project_position_id=pp.id where pp.id=pg_temp.id(40) and pr.academic_program_id=pg_temp.id(12)),2,'Systems profile has two slots in its own position');
select is((select pp.capacity from public."PYRUnibague_ProjectPositions" pp join public."PYRUnibague_ProjectPositionPrograms" pr on pr.project_position_id=pp.id where pp.id=pg_temp.id(41) and pr.academic_program_id=pg_temp.id(13)),1,'Mechanical profile has one slot in a distinct position');
insert into public."PYRUnibague_ProjectPositionPrograms"(project_position_id,academic_program_id) values(pg_temp.id(40),pg_temp.id(13));
select is((select sum(pp.capacity)::integer from public."PYRUnibague_ProjectPositions" pp where exists(select 1 from public."PYRUnibague_CallPositions" cp where cp.project_position_id=pp.id)),3,'Unique capacity remains 2+1 across repeated calls and compatible programs');
select throws_ok($$insert into public."PYRUnibague_CallPositions"(call_id,project_position_id) values(pg_temp.id(70),pg_temp.id(40))$$,'23505',null,'Duplicate call-position rejected');
select throws_ok($$insert into public."PYRUnibague_CallPositions"(call_id,project_position_id) values(pg_temp.id(70),pg_temp.id(42))$$,'23514',null,'Cross-organization call position rejected');
select throws_ok($$insert into public."PYRUnibague_CallPositions"(call_id,project_position_id) values(pg_temp.id(70),pg_temp.id(43))$$,'23514',null,'Wrong period rejected');
select throws_ok($$update public."PYRUnibague_Calls" set academic_period_id=pg_temp.id(11) where id=pg_temp.id(70)$$,'23514',null,'Linked call period cannot drift');
select throws_ok($$update public."PYRUnibague_Projects" set academic_period_id=pg_temp.id(11) where id=pg_temp.id(30)$$,'23514',null,'Linked project period cannot drift');
select lives_ok($$update public."PYRUnibague_Calls" set status='open' where id=pg_temp.id(70)$$,'Organization publishes linked call');
select throws_ok($$update public."PYRUnibague_Calls" set title='Late edit' where id=pg_temp.id(70)$$,'42501',null,'Published call content frozen');
select lives_ok($$update public."PYRUnibague_Calls" set status='closed' where id=pg_temp.id(70)$$,'Organization closes published call');
select throws_ok($$insert into public."PYRUnibague_Calls"(organization_id,academic_period_id,title,status) values(pg_temp.id(20),pg_temp.id(10),'Injected','open')$$,'42501',null,'Cannot bypass draft creation');
select throws_ok($$insert into public."PYRUnibague_Calls"(organization_id,academic_period_id,title,opens_at,closes_at) values(pg_temp.id(20),pg_temp.id(10),'Dates','2026-10-20','2026-10-19')$$,'23514',null,'Call dates coherent');
select lives_ok($$insert into public."PYRUnibague_GroupMembers"(id,group_id,assignment_id,joined_on) values(pg_temp.id(90),pg_temp.id(60),pg_temp.id(50),'2026-10-01')$$,'Manager links existing confirmed assignment');
select throws_ok($$insert into public."PYRUnibague_GroupMembers"(group_id,assignment_id) values(pg_temp.id(60),pg_temp.id(51))$$,'23514',null,'Assignment from another institution rejected');
select throws_ok($$insert into public."PYRUnibague_GroupMembers"(group_id,assignment_id) values(pg_temp.id(60),pg_temp.id(52))$$,'23514',null,'Assignment from another project of same institution rejected');
select throws_ok($$insert into public."PYRUnibague_GroupMembers"(group_id,assignment_id) values(pg_temp.id(61),pg_temp.id(50))$$,'23505',null,'One active group per assignment');
select throws_ok($$insert into public."PYRUnibague_GroupMembers"(group_id,assignment_id) values(pg_temp.id(60),pg_temp.id(53))$$,'23514',null,'Unconfirmed assignment cannot join');
select throws_ok($$insert into public."PYRUnibague_GroupMembers"(group_id,assignment_id) values(pg_temp.id(63),pg_temp.id(51))$$,'42501',null,'Cannot write memberships of another institution');
select throws_ok($$update public."PYRUnibague_Groups" set project_id=pg_temp.id(31) where id=pg_temp.id(60)$$,'23514',null,'Cannot move a group and reinterpret membership history');
select is(jsonb_array_length(public.pyr_unibague_project_team(pg_temp.id(30))->'assignments'),1,'Team RPC exposes only confirmed or historical project identities');
select throws_ok($$select public.pyr_unibague_project_team(pg_temp.id(32))$$,'42501',null,'Team RPC denies foreign project');
select is(public.pyr_unibague_project_team(pg_temp.id(30))->'assignments'->0->>'display_name','Persona de prueba 5','Names are derived from existing identity');
select lives_ok($$update public."PYRUnibague_GroupMembers" set status='inactive',left_on='2026-10-02' where id=pg_temp.id(90)$$,'Retire membership without deletion');
select throws_ok($$update public."PYRUnibague_GroupMembers" set status='active',left_on=null where id=pg_temp.id(90)$$,'23514',null,'Historical membership cannot be reactivated');
select lives_ok($$insert into public."PYRUnibague_GroupMembers"(id,group_id,assignment_id,joined_on) values(pg_temp.id(91),pg_temp.id(61),pg_temp.id(50),'2026-10-03')$$,'Rejoining creates a new history row');
select is((select count(*)::integer from public."PYRUnibague_GroupMembers" where assignment_id=pg_temp.id(50)),2,'Prior membership is preserved');
select set_config('request.jwt.claim.sub',pg_temp.id(4)::text,true);
select throws_ok($$insert into public."PYRUnibague_Groups"(project_id,name) values(pg_temp.id(30),'Forbidden')$$,'42501',null,'Read-only organization member cannot create groups');
select throws_ok($$insert into public."PYRUnibague_GroupMembers"(group_id,assignment_id) values(pg_temp.id(60),pg_temp.id(50))$$,'42501',null,'Read-only member cannot add memberships');
select set_config('request.jwt.claim.sub',pg_temp.id(1)::text,true);
select throws_ok($$update public."PYRUnibague_Assignments" set project_position_id=pg_temp.id(41) where id=pg_temp.id(50)$$,'42501',null,'Integrated schema denies direct assignment mutation even to ADMIN');
select throws_ok($$delete from public."PYRUnibague_GroupMembers" where id=pg_temp.id(90)$$,'42501',null,'Membership deletion privilege absent even for app ADMIN');
select lives_ok($$select public.pyr_unibague_unassign_assignment(pg_temp.id(10),null,public.pyr_unibague_assignment_snapshot(pg_temp.id(10),null)->>'revision',jsonb_build_object('student_id',pg_temp.id(105),'assignment_id',pg_temp.id(50),'reason_code','OTHER','reason_text','P6B integration regression'))$$,'Releasing assignment retires current membership transactionally');
select is((select count(*)::integer from public."PYRUnibague_GroupMembers" where assignment_id=pg_temp.id(50) and status='active'),0,'No active membership survives release');
select is((select count(*)::integer from public."PYRUnibague_GroupMembers" where assignment_id=pg_temp.id(50)),2,'Release retains all historical memberships');
select throws_ok($$insert into public."PYRUnibague_GroupMembers"(group_id,assignment_id) values(pg_temp.id(60),pg_temp.id(50))$$,'23514',null,'Released assignment cannot rejoin');
select lives_ok($$update public."PYRUnibague_Calls" set status='changes_required' where id=pg_temp.id(70)$$,'Admin can review call state');
select is((select count(*)::integer from public."PYRUnibague_Calls" where id in (pg_temp.id(70),pg_temp.id(71),pg_temp.id(72))),3,'ADMIN can consult calls globally');
reset role;
set local role anon;
select throws_ok($$select * from public."PYRUnibague_Calls"$$,'42501',null,'Anon cannot read calls');
select throws_ok($$select public.pyr_unibague_project_team(pg_temp.id(30))$$,'42501',null,'Anon cannot call identity reader');
reset role;
select finish();
rollback;
