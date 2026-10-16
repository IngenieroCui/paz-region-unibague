begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
select set_config('p4.baseline_capacity',(select coalesce(sum(capacity),0)::text from "PYRUnibague_ProjectPositions"),true);
-- Only existing disposable test administrators participate in the last-admin
-- savepoint below. Their persisted roles are restored before the test continues.
create temp table p4_other_test_admins as select ur.user_id from "PYRUnibague_UserRoles" ur
 join "PYRUnibague_Roles" r on r.id=ur.role_id join auth.users u on u.id=ur.user_id
 where r.code='ADMIN' and (u.email like '%@example.test'
  or (u.id='5387d4dc-24a3-4345-a365-ffcbc0740baf' and u.raw_user_meta_data->>'pyr_test_account'='true'));
grant select on pg_temp.p4_other_test_admins to authenticated;
insert into auth.users(id,email) values
 ('04000000-0000-0000-0000-000000000001','p4-admin@example.test'),
 ('04000000-0000-0000-0000-000000000002','p4-manager@example.test'),
 ('04000000-0000-0000-0000-000000000003','p4-member@example.test'),
 ('04000000-0000-0000-0000-000000000004','p4-other@example.test'),
 ('04000000-0000-0000-0000-000000000005','p4-student@example.test');
insert into "PYRUnibague_UserRoles"(user_id,role_id) select u.id,r.id from auth.users u cross join "PYRUnibague_Roles" r where
 (u.id='04000000-0000-0000-0000-000000000001' and r.code='ADMIN') or
 (u.id in ('04000000-0000-0000-0000-000000000002','04000000-0000-0000-0000-000000000003','04000000-0000-0000-0000-000000000004') and r.code='ORGANIZATION') or
 (u.id='04000000-0000-0000-0000-000000000005' and r.code='STUDENT');
insert into "PYRUnibague_AcademicPeriods"(id,code,name,status,is_current) values
 ('14000000-0000-0000-0000-000000000001','P4-A','Test A','test',false),('14000000-0000-0000-0000-000000000002','P4-B','Test B','test',false);
insert into "PYRUnibague_AcademicPrograms"(id,code,name) values('24000000-0000-0000-0000-000000000001','P4','Test program');
insert into "PYRUnibague_Skills"(id,name) values('34000000-0000-0000-0000-000000000001','P4 test skill');
insert into "PYRUnibague_Organizations"(id,legal_name,status) values('44000000-0000-0000-0000-000000000001','P4 Org','pending_review'),('44000000-0000-0000-0000-000000000002','P4 Other','pending_review');
insert into "PYRUnibague_OrganizationMembers"(organization_id,user_id,membership_role,can_manage,status) values
 ('44000000-0000-0000-0000-000000000001','04000000-0000-0000-0000-000000000002','manager',true,'active'),
 ('44000000-0000-0000-0000-000000000001','04000000-0000-0000-0000-000000000003','member',false,'active'),
 ('44000000-0000-0000-0000-000000000002','04000000-0000-0000-0000-000000000004','manager',true,'active');
insert into "PYRUnibague_Students"(id,user_id,student_code) values('84000000-0000-0000-0000-000000000001','04000000-0000-0000-0000-000000000005','P4-S');
create function pg_temp.state_p4(statement text,expected text) returns boolean language plpgsql as $$
declare caught text;
begin begin execute statement; exception when others then get stacked diagnostics caught=returned_sqlstate; end;return caught is not distinct from expected;end;
$$;
select ok(not has_function_privilege('anon','public.pyr_unibague_review_organization(uuid,text,text)','EXECUTE'),'anon cannot review');
select ok(not has_function_privilege('anon','public.pyr_unibague_set_current_academic_period(uuid)','EXECUTE'),'anon cannot set current period');
select ok(not exists(select 1 from pg_proc p,lateral aclexplode(p.proacl) a where p.proname in ('pyr_unibague_review_organization','pyr_unibague_set_current_academic_period','pyr_unibague_admin_dashboard','pyr_unibague_admin_students','pyr_unibague_project_totals') and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC cannot execute P4 RPCs');
select ok((select prosecdef and proconfig=array['search_path=""']::text[] from pg_proc where proname='pyr_unibague_review_organization'),'review definer has empty search_path');
set local role authenticated;
select set_config('request.jwt.claim.sub','04000000-0000-0000-0000-000000000002',true);
select lives_ok($$insert into "PYRUnibague_Projects"(id,organization_id,academic_period_id,name,status,created_by) values('54000000-0000-0000-0000-000000000001','44000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000001','P4 project','draft',auth.uid())$$,'manager creates draft');
select ok(pg_temp.state_p4($$insert into "PYRUnibague_Projects"(organization_id,academic_period_id,name,status,created_by) values('44000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000001','Self approval','approved',auth.uid())$$,'42501'),'manager cannot insert approved project');
select lives_ok($$update "PYRUnibague_Projects" set summary='Edited' where id='54000000-0000-0000-0000-000000000001'$$,'manager edits draft');
select lives_ok($$insert into "PYRUnibague_ProjectPositions"(id,project_id,title,capacity,status) values('64000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','Test plaza',2,'draft')$$,'manager adds position');
select ok(pg_temp.state_p4($$update "PYRUnibague_ProjectPositions" set capacity=0 where id='64000000-0000-0000-0000-000000000001'$$,'23514'),'positive capacity enforced');
select lives_ok($$insert into "PYRUnibague_ProjectPositionPrograms"(project_position_id,academic_program_id,is_required) values('64000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000001',true)$$,'program requirement persisted');
select lives_ok($$insert into "PYRUnibague_ProjectPositionSkills"(project_position_id,skill_id,is_required) values('64000000-0000-0000-0000-000000000001','34000000-0000-0000-0000-000000000001',false)$$,'desirable skill persisted');
select lives_ok($$insert into "PYRUnibague_ProjectRequirements"(project_position_id,label,is_mandatory,sort_order) values('64000000-0000-0000-0000-000000000001','Test req',true,1)$$,'ordered mandatory requirement persisted');
select is((select total_capacity::integer from pyr_unibague_project_totals(array['54000000-0000-0000-0000-000000000001']::uuid[])),2,'aggregate returns real capacity under RLS');
select ok(pg_temp.state_p4($$update "PYRUnibague_Projects" set status='approved' where id='54000000-0000-0000-0000-000000000001'$$,'42501'),'manager cannot self approve');
select ok(pg_temp.state_p4($$update "PYRUnibague_Projects" set organization_id='44000000-0000-0000-0000-000000000002' where id='54000000-0000-0000-0000-000000000001'$$,'42501'),'cannot move project identity');
select lives_ok($$update "PYRUnibague_Projects" set status='submitted' where id='54000000-0000-0000-0000-000000000001'$$,'manager sends for review');
select ok(pg_temp.state_p4($$update "PYRUnibague_ProjectPositions" set capacity=10 where id='64000000-0000-0000-0000-000000000001'$$,'42501'),'submitted plaza frozen');
select ok(pg_temp.state_p4($$delete from "PYRUnibague_ProjectRequirements" where project_position_id='64000000-0000-0000-0000-000000000001'$$,'42501'),'submitted profile frozen');
select ok(pg_temp.state_p4($$delete from "PYRUnibague_Projects" where id='54000000-0000-0000-0000-000000000001'$$,'42501'),'cannot delete submitted project');
select ok(pg_temp.state_p4($$select pyr_unibague_review_organization('44000000-0000-0000-0000-000000000001','approved','self')$$,'42501'),'organization cannot execute admin review');
select ok(pg_temp.state_p4($$select pyr_unibague_set_current_academic_period('14000000-0000-0000-0000-000000000002')$$,'42501'),'organization cannot switch current period');
select ok(pg_temp.state_p4($$select pyr_unibague_admin_dashboard()$$,'42501'),'organization cannot read admin dashboard');
select set_config('request.jwt.claim.sub','04000000-0000-0000-0000-000000000003',true);
select is((select count(*)::integer from "PYRUnibague_Projects"),1,'member reads own project');
update "PYRUnibague_Projects" set name='Stolen' where id='54000000-0000-0000-0000-000000000001';
select is((select name from "PYRUnibague_Projects"),'P4 project','member cannot edit project');
select ok(pg_temp.state_p4($$insert into "PYRUnibague_Projects"(organization_id,academic_period_id,name,status,created_by) values('44000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000001','Member draft','draft',auth.uid())$$,'42501'),'member cannot create project');
select set_config('request.jwt.claim.sub','04000000-0000-0000-0000-000000000004',true);
select is((select count(*)::integer from "PYRUnibague_Projects"),0,'cross organization project isolation');
select is((select count(*)::integer from "PYRUnibague_ProjectPositions"),0,'cross organization plaza isolation');
select is((select count(*)::integer from pyr_unibague_project_totals(array['54000000-0000-0000-0000-000000000001']::uuid[])),0,'capacity RPC respects isolation');
select set_config('request.jwt.claim.sub','04000000-0000-0000-0000-000000000005',true);
select ok(pg_temp.state_p4($$select pyr_unibague_admin_students()$$,'42501'),'student cannot query admin students');
select ok(pg_temp.state_p4($$insert into "PYRUnibague_StudentPeriodParticipations"(student_id,academic_period_id,status,eligible_for_matching) values('84000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000001','active',true)$$,'42501'),'student cannot self assign eligibility');
select set_config('request.jwt.claim.sub','04000000-0000-0000-0000-000000000001',true);
select lives_ok($$select pyr_unibague_review_organization('44000000-0000-0000-0000-000000000001','approved','Reviewed')$$,'admin approves organization transactionally');
select ok((select status='approved' and verified_at is not null and verified_by=auth.uid() from "PYRUnibague_Organizations" where id='44000000-0000-0000-0000-000000000001'),'approval verification coherent');
select is((select count(*)::integer from "PYRUnibague_OrganizationReviews" where organization_id='44000000-0000-0000-0000-000000000001'),1,'review history inserted');
select lives_ok($$select pyr_unibague_review_organization('44000000-0000-0000-0000-000000000001','changes_required','Revoked')$$,'admin revokes approval');
select ok((select verified_at is null and verified_by is null and status='changes_required' from "PYRUnibague_Organizations" where id='44000000-0000-0000-0000-000000000001'),'revocation clears verification');
select ok(pg_temp.state_p4($$select pyr_unibague_review_organization('44000000-0000-0000-0000-000000000001','invented','bad')$$,'22023'),'invalid review rejected');
select is((select count(*)::integer from "PYRUnibague_OrganizationReviews" where organization_id='44000000-0000-0000-0000-000000000001'),2,'invalid review creates no history');
select ok(pg_temp.state_p4($$select pyr_unibague_review_organization('44000000-0000-0000-0000-000000000099','approved')$$,'P0002'),'missing organization rejected');
select lives_ok($$update "PYRUnibague_Projects" set status='changes_required' where id='54000000-0000-0000-0000-000000000001'$$,'admin requests project corrections');
select set_config('request.jwt.claim.sub','04000000-0000-0000-0000-000000000002',true);
select lives_ok($$update "PYRUnibague_ProjectPositions" set capacity=3 where id='64000000-0000-0000-0000-000000000001'$$,'manager can correct returned plaza');
select set_config('request.jwt.claim.sub','04000000-0000-0000-0000-000000000001',true);
select lives_ok($$update "PYRUnibague_Projects" set status='approved' where id='54000000-0000-0000-0000-000000000001'$$,'admin approves project');
select lives_ok($$select pyr_unibague_set_current_academic_period('14000000-0000-0000-0000-000000000002')$$,'current period switched atomically');
select is((select count(*)::integer from "PYRUnibague_AcademicPeriods" where is_current),1,'one current period');
select is((select code from "PYRUnibague_AcademicPeriods" where is_current),'P4-B','requested period is current');
select ok(pg_temp.state_p4($$select pyr_unibague_set_current_academic_period('14000000-0000-0000-0000-000000000099')$$,'P0002'),'nonexistent current period rejected');
select is((select code from "PYRUnibague_AcademicPeriods" where is_current),'P4-B','failed switch preserves current');
select lives_ok($$insert into "PYRUnibague_StudentPeriodParticipations"(student_id,academic_period_id,status,eligible_for_matching) values('84000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000002','reviewed',true)$$,'admin sets participation eligibility');
select is((pyr_unibague_admin_dashboard()->>'eligible')::integer,1,'dashboard real eligible count');
select is((pyr_unibague_admin_dashboard()->>'capacity')::integer,current_setting('p4.baseline_capacity')::integer+3,'dashboard real capacity');
select is((pyr_unibague_admin_students('P4-S',null,'14000000-0000-0000-0000-000000000002',true)->>'count')::integer,1,'student search and participation filter');
select is((pyr_unibague_admin_students('no-result')->>'count')::integer,0,'student search empty');
savepoint p4_last_admin;
delete from "PYRUnibague_UserRoles" where role_id=(select id from "PYRUnibague_Roles" where code='ADMIN') and user_id in(select user_id from pg_temp.p4_other_test_admins);
select ok(pg_temp.state_p4($$delete from "PYRUnibague_UserRoles" where user_id=auth.uid() and role_id=(select id from "PYRUnibague_Roles" where code='ADMIN')$$,'23514'),'last ADMIN deletion prevented');
select ok(pg_temp.state_p4($$update "PYRUnibague_UserRoles" set role_id=(select id from "PYRUnibague_Roles" where code='STUDENT') where user_id=auth.uid() and role_id=(select id from "PYRUnibague_Roles" where code='ADMIN')$$,'23514'),'last ADMIN update prevented');
rollback to savepoint p4_last_admin;
release savepoint p4_last_admin;
select ok(pg_temp.state_p4($$update "PYRUnibague_Roles" set code='RENAMED' where code='ADMIN'$$,'23514'),'cannot bypass by renaming ADMIN');
select lives_ok($$insert into "PYRUnibague_UserRoles"(user_id,role_id) select '04000000-0000-0000-0000-000000000004',id from "PYRUnibague_Roles" where code='ADMIN'$$,'second ADMIN can be assigned');
select lives_ok($$delete from "PYRUnibague_UserRoles" where user_id='04000000-0000-0000-0000-000000000004' and role_id=(select id from "PYRUnibague_Roles" where code='ADMIN')$$,'nonlast ADMIN can be removed');
select ok((select count(*)>0 from "PYRUnibague_AuditLogs" where entity_table='PYRUnibague_OrganizationReviews'),'existing review audit remains active');
select lives_ok($$insert into "PYRUnibague_SystemConfigurations"(key,value,is_public) values('p4_test','{"real":true}',false)$$,'admin saves JSON settings');
select lives_ok($$insert into "PYRUnibague_FeatureFlags"(key,enabled,is_public) values('p4_test',false,false)$$,'admin saves flags');
select lives_ok($$update "PYRUnibague_AcademicPrograms" set active=false where code='P4'$$,'catalog deactivation preserves references');
create function pg_temp.restrict_p4(statement text) returns boolean language plpgsql as $$
begin execute statement; return false; exception when foreign_key_violation or restrict_violation then return true; end;
$$;
select ok(pg_temp.restrict_p4($$delete from "PYRUnibague_AcademicPeriods" where id='14000000-0000-0000-0000-000000000001'$$),'cannot delete historically referenced period');
select * from finish();
rollback;
