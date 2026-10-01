begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
-- Test-only identities and data are rolled back; never part of seed.sql.
insert into auth.users (id, email, raw_user_meta_data) values
('00000000-0000-0000-0000-000000000001','student-a@example.test','{"role":"ADMIN"}'),
('00000000-0000-0000-0000-000000000002','student-b@example.test','{}'),
('00000000-0000-0000-0000-000000000003','org-a@example.test','{}'),
('00000000-0000-0000-0000-000000000004','org-b@example.test','{}'),
('00000000-0000-0000-0000-000000000005','admin@example.test','{}');
select is((select count(*)::integer from "PYRUnibague_UserRoles" where user_id='00000000-0000-0000-0000-000000000001'), 0, 'Auth metadata never assigns roles');
select is((select count(*)::integer from "PYRUnibague_UserProfiles" where user_id::text like '00000000-0000-0000-0000-00000000000%'), 5, 'Auth creates profiles');
insert into "PYRUnibague_UserRoles" (user_id,role_id)
select u.id,r.id from auth.users u cross join "PYRUnibague_Roles" r
where (u.id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002') and r.code='STUDENT')
or (u.id in ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004') and r.code='ORGANIZATION')
or (u.id='00000000-0000-0000-0000-000000000005' and r.code='ADMIN');
insert into "PYRUnibague_Students" (id,user_id) values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002');
insert into "PYRUnibague_AcademicPeriods" (id,code,name,status) values ('20000000-0000-0000-0000-000000000001','TEST','Test only','test');
insert into "PYRUnibague_StudentPeriodParticipations" (student_id,academic_period_id,status) values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','test');
insert into "PYRUnibague_Organizations" (id,legal_name,status) values
('30000000-0000-0000-0000-000000000001','Test A','test'),('30000000-0000-0000-0000-000000000002','Test B','test');
insert into "PYRUnibague_OrganizationMembers" (organization_id,user_id,membership_role,can_manage,status) values
('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','test',true,'active'),
('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','test',true,'active');
insert into "PYRUnibague_Projects" (id,organization_id,academic_period_id,name,status) values
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Test','draft');
insert into "PYRUnibague_ProjectPositions" (id,project_id,title,capacity,status) values
('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Test',2,'test');
insert into "PYRUnibague_MatchingConfigurations" (id,name,algorithm_version) values ('60000000-0000-0000-0000-000000000001','Test','test');
insert into "PYRUnibague_MatchingRuns" (id,academic_period_id,matching_configuration_id,status) values ('70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','test');
insert into "PYRUnibague_MatchCandidates" (matching_run_id,student_id,project_position_id,is_eligible,total_score) values ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',true,90);
insert into "PYRUnibague_Assignments" (academic_period_id,student_id,project_position_id,status,source) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','test','MANUAL');
insert into "PYRUnibague_Notifications" (id,user_id,type_code,title) values
('80000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','test','Test A'),
('80000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','test','Test B');
insert into storage.objects (bucket_id,name) values
('pyrunibague-student-documents','10000000-0000-0000-0000-000000000001/90000000-0000-0000-0000-000000000001/a.pdf'),
('pyrunibague-student-documents','10000000-0000-0000-0000-000000000002/90000000-0000-0000-0000-000000000002/b.pdf'),
('pyrunibague-organization-documents','30000000-0000-0000-0000-000000000001/90000000-0000-0000-0000-000000000001/a.pdf'),
('pyrunibague-organization-documents','30000000-0000-0000-0000-000000000002/90000000-0000-0000-0000-000000000002/b.pdf');
create function pg_temp.denied(statement text) returns boolean language plpgsql as $$
begin execute statement; return false; exception when insufficient_privilege or check_violation then return true; end; $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select is((select count(*)::integer from "PYRUnibague_Students"),1,'Student A sees only own Student');
select is((select count(*)::integer from "PYRUnibague_UserProfiles"),1,'Own profile only');
select is((select count(*)::integer from "PYRUnibague_UserRoles"),1,'Own role assignments only');
select ok(pg_temp.denied($$insert into "PYRUnibague_UserRoles" (user_id,role_id) select auth.uid(),id from "PYRUnibague_Roles" where code='ADMIN'$$),'No self-assigned roles');
update "PYRUnibague_StudentPeriodParticipations" set eligible_for_matching=true;
select ok(not (select eligible_for_matching from "PYRUnibague_StudentPeriodParticipations" limit 1),'Student cannot make self eligible');
select ok(pg_temp.denied($$update "PYRUnibague_Students" set is_active=false$$),'Administrative activation protected');
select ok(pg_temp.denied($$update "PYRUnibague_Students" set user_id='00000000-0000-0000-0000-000000000002'$$),'Cannot relink profile identity');
select is((select count(*)::integer from "PYRUnibague_MatchCandidates"),0,'Student cannot read matching');
select is((select count(*)::integer from "PYRUnibague_Projects"),0,'Student has no general project access');
select is((select count(*)::integer from "PYRUnibague_Assignments"),1,'Student sees own assignment');
select ok(pg_temp.denied($$insert into "PYRUnibague_Assignments" (academic_period_id,student_id,project_position_id,status,source) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','test','MANUAL')$$),'No direct Student assignment inserts');
select is((select count(*)::integer from storage.objects),1,'Student Storage isolation');
select ok(pg_temp.denied($$insert into storage.objects (bucket_id,name) values ('pyrunibague-student-documents','10000000-0000-0000-0000-000000000002/90000000-0000-0000-0000-000000000003/x.pdf')$$),'Student cannot upload into other student folder');
select ok(pg_temp.denied($$insert into storage.objects (bucket_id,name) values ('pyrunibague-student-documents','not-a-uuid/x.pdf')$$),'Malformed Storage path denied');
select is((select count(*)::integer from "PYRUnibague_Notifications"),1,'Notifications isolated');
select ok(pg_temp.denied($$update "PYRUnibague_Notifications" set title='forged'$$),'No generic notification UPDATE');
select ok(public.pyr_unibague_mark_notification_read('80000000-0000-0000-0000-000000000001'),'Own notification read RPC');
select ok(not public.pyr_unibague_mark_notification_read('80000000-0000-0000-0000-000000000002'),'Cannot mark other notification read');
select ok(pg_temp.denied($$insert into "PYRUnibague_AuditLogs" (action,entity_table) values ('forged','x')$$),'Cannot forge audit');


select lives_ok($$update "PYRUnibague_Students" set bio='Own profile'$$,'Student can update own professional profile');
select lives_ok($$insert into "PYRUnibague_StudentExperiences" (student_id,title,started_on,ended_on) values ('10000000-0000-0000-0000-000000000001','Own experience','2026-01-01','2026-02-01')$$,'Student creates own experience');
select ok(pg_temp.denied($$insert into "PYRUnibague_StudentExperiences" (student_id,title) values ('10000000-0000-0000-0000-000000000002','Forged')$$),'Student cannot create other experience');
select lives_ok($$insert into "PYRUnibague_StudentDocuments" (id,student_id,category_code,file_name,bucket_id,object_path,status,uploaded_by) values ('90000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','test','a.pdf','pyrunibague-student-documents','10000000-0000-0000-0000-000000000001/90000000-0000-0000-0000-000000000001/a.pdf','test',auth.uid())$$,'Own document metadata valid');
select ok(pg_temp.denied($$update "PYRUnibague_StudentDocuments" set bucket_id='pyrunibague-organization-documents'$$),'Document metadata validates bucket');
select ok(pg_temp.denied($$update "PYRUnibague_StudentDocuments" set object_path='10000000-0000-0000-0000-000000000002/90000000-0000-0000-0000-000000000001/a.pdf'$$),'Document metadata validates parent');
select ok(pg_temp.denied($$update "PYRUnibague_StudentDocuments" set uploaded_by='00000000-0000-0000-0000-000000000002'$$),'Uploader cannot be forged');
update storage.objects set name='10000000-0000-0000-0000-000000000001/90000000-0000-0000-0000-000000000001/own.pdf'
where bucket_id='pyrunibague-student-documents';
select is((select count(*)::integer from storage.objects where name like '%/own.pdf'),1,'Storage update allowed for own object');
select ok(pg_temp.denied($$update storage.objects set name='10000000-0000-0000-0000-000000000002/90000000-0000-0000-0000-000000000001/moved.pdf'$$),'Storage UPDATE cannot move into other owner');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select is((select count(*)::integer from "PYRUnibague_Organizations"),1,'Org A reads only own org');
update "PYRUnibague_Organizations" set legal_name='FORGED' where id='30000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from "PYRUnibague_Organizations" where legal_name='FORGED'),0,'Org A cannot modify B');
select ok(pg_temp.denied($$update "PYRUnibague_Organizations" set verified_at=now()$$),'Manager cannot self-verify');
select ok(pg_temp.denied($$update "PYRUnibague_Organizations" set status='approved'$$),'Manager cannot alter institutional status');
select is((select count(*)::integer from "PYRUnibague_MatchCandidates"),0,'Organization cannot read matching');
select is((select count(*)::integer from "PYRUnibague_Students"),0,'Organization has no global Student access');
select is((select count(*)::integer from "PYRUnibague_Assignments"),1,'Organization sees own project assignment');
select is((select count(*)::integer from storage.objects),1,'Organization Storage isolation');
select ok(pg_temp.denied($$insert into storage.objects (bucket_id,name) values ('pyrunibague-organization-documents','30000000-0000-0000-0000-000000000002/90000000-0000-0000-0000-000000000003/x.pdf')$$),'Org A cannot upload B documents');
select ok(pg_temp.denied($$insert into "PYRUnibague_OrganizationDocuments" (id,organization_id,category_code,file_name,bucket_id,object_path,status,uploaded_by) values ('90000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','test','x.pdf','pyrunibague-organization-documents','30000000-0000-0000-0000-000000000002/90000000-0000-0000-0000-000000000003/x.pdf','test',auth.uid())$$),'Org A cannot create B metadata');
select ok(pg_temp.denied($$insert into "PYRUnibague_OrganizationMembers" (organization_id,user_id,membership_role,can_manage,status) values ('30000000-0000-0000-0000-000000000002',auth.uid(),'test',true,'active')$$),'Membership cannot self-escalate');
select ok(pg_temp.denied($$update "PYRUnibague_Projects" set organization_id='30000000-0000-0000-0000-000000000002'$$),'Cannot transfer project to another org UUID');


select lives_ok($$update "PYRUnibague_Projects" set summary='Manager edit'$$,'Manager updates own project');
select lives_ok($$update "PYRUnibague_ProjectPositions" set description='Manager edit'$$,'Manager updates own position');
select lives_ok($$insert into "PYRUnibague_OrganizationDocuments" (id,organization_id,category_code,file_name,bucket_id,object_path,status,uploaded_by) values ('90000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000001','test','own.pdf','pyrunibague-organization-documents','30000000-0000-0000-0000-000000000001/90000000-0000-0000-0000-000000000004/own.pdf','test',auth.uid())$$,'Manager creates own document metadata');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);

select is((select count(*)::integer from "PYRUnibague_Students"),2,'Admin reads Students');
select is((select count(*)::integer from "PYRUnibague_MatchCandidates"),1,'Admin reads matching');
select ok((select count(*)>0 from "PYRUnibague_AuditLogs"),'Admin reads audit');
select ok(not exists(select 1 from "PYRUnibague_AuditLogs" where context <> '{}'::jsonb),'Audit excludes snapshots and request credentials');
select is((select legal_name from "PYRUnibague_Organizations" where id='30000000-0000-0000-0000-000000000002'),'Test B','Other org unchanged');
select is((select count(*)::integer from storage.objects),4,'Admin Storage access');
update "PYRUnibague_StudentPeriodParticipations" set eligible_for_matching=true;
select ok((select eligible_for_matching from "PYRUnibague_StudentPeriodParticipations" limit 1),'Admin manages eligibility');
select ok(pg_temp.denied($$insert into "PYRUnibague_AuditLogs" (action,entity_table) values ('forged','x')$$),'Admin clients cannot insert audit');
update "PYRUnibague_OrganizationMembers" set can_manage=false where user_id='00000000-0000-0000-0000-000000000003';

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select is((select count(*)::integer from storage.objects),0,'Non-manager has no private documents access');
update "PYRUnibague_Organizations" set legal_name='FORGED' where id='30000000-0000-0000-0000-000000000001';
select is((select legal_name from "PYRUnibague_Organizations"),'Test A','Non-manager cannot update org');

reset role;
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'PYRUnibague\_%' escape '\' and c.relkind='r' and not c.relrowsecurity),0,'Every application table enables RLS');
select is((select count(*)::integer from storage.buckets where id in ('pyrunibague-student-documents','pyrunibague-organization-documents') and public),0,'Both document buckets private');
select ok(not has_function_privilege('anon','public.pyr_unibague_current_roles()','EXECUTE'),'anon cannot call roles RPC');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select ok(pg_temp.denied($$select * from "PYRUnibague_Students"$$),'anon cannot read Students');
select ok(pg_temp.denied($$select * from "PYRUnibague_Organizations"$$),'anon cannot read Organizations');
select ok(pg_temp.denied($$select * from "PYRUnibague_MatchCandidates"$$),'anon cannot read matching');
select is((select count(*)::integer from storage.objects),0,'anon cannot read private Storage');
reset role;
select ok(exists(select 1 from "PYRUnibague_AuditLogs" where entity_table='PYRUnibague_Projects' and action='UPDATE' and changed_fields = array['summary']),'Audit stores field names only for project update');
select throws_ok($$insert into "PYRUnibague_ProjectPositions" (project_id,title,capacity,status) values ('40000000-0000-0000-0000-000000000001','Bad',0,'test')$$,'23514',null,'Capacity must be positive');
select throws_ok($$update "PYRUnibague_MatchCandidates" set total_score=101$$,'23514',null,'Matching score capped at 100');
select throws_ok($$insert into "PYRUnibague_Assignments" (academic_period_id,student_id,project_position_id,status,source) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','test','MANUAL')$$,'23505',null,'At most one active assignment per student period');
select throws_ok($$update "PYRUnibague_StudentExperiences" set ended_on='2025-01-01'$$,'23514',null,'Experience dates coherent');
select * from finish();
rollback;
