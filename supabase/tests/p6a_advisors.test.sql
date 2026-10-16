-- Run only in a disposable Supabase test instance. All fixtures are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function pg_temp.p6id(n integer) returns uuid language sql immutable as $$
 select ('66000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
$$;
insert into auth.users(id,email,raw_user_meta_data)
 select pg_temp.p6id(n),'p6a-'||n||'@example.test','{"role":"ADVISOR"}'::jsonb from generate_series(1,8) n;
update "PYRUnibague_UserProfiles" set display_name='Account '||right(user_id::text,3),institutional_email='private@example.test' where user_id::text like '66000000%';
insert into "PYRUnibague_UserRoles"(user_id,role_id)
 select pg_temp.p6id(n),r.id from generate_series(1,8) n cross join "PYRUnibague_Roles" r
 where (n=1 and r.code='ADMIN') or (n in (2,3,8) and r.code='ADVISOR') or (n in (4,5) and r.code='STUDENT') or (n=6 and r.code='ORGANIZATION');
insert into "PYRUnibague_StaffProfiles"(id,user_id,status) values
 (pg_temp.p6id(101),pg_temp.p6id(2),'active'),(pg_temp.p6id(102),pg_temp.p6id(3),'active'),
 (pg_temp.p6id(103),pg_temp.p6id(7),'active'),(pg_temp.p6id(104),pg_temp.p6id(8),'inactive');
insert into "PYRUnibague_AcademicPeriods"(id,code,name,status) values
 (pg_temp.p6id(301),'P6A-1','P6A test period','test'),(pg_temp.p6id(302),'P6A-2','P6A other period','test');
insert into "PYRUnibague_Organizations"(id,legal_name,status,tax_id) values
 (pg_temp.p6id(201),'Organization A','test','private-tax-a'),(pg_temp.p6id(202),'Organization B','test','private-tax-b');
insert into "PYRUnibague_OrganizationMembers"(organization_id,user_id,membership_role,can_manage,status)
 values(pg_temp.p6id(201),pg_temp.p6id(6),'manager',true,'active');
insert into "PYRUnibague_Students"(id,user_id,bio,desired_work_description,student_code,current_semester)
 values(pg_temp.p6id(401),pg_temp.p6id(4),'Professional A','Work A','private-code-a',6),(pg_temp.p6id(402),pg_temp.p6id(5),'Professional B','Work B','private-code-b',7);
insert into "PYRUnibague_StudentPeriodParticipations"(id,student_id,academic_period_id,status) values
 (pg_temp.p6id(501),pg_temp.p6id(401),pg_temp.p6id(301),'test'),(pg_temp.p6id(502),pg_temp.p6id(402),pg_temp.p6id(301),'test'),
 (pg_temp.p6id(503),pg_temp.p6id(401),pg_temp.p6id(302),'test');
insert into "PYRUnibague_Projects"(id,organization_id,academic_period_id,name,status) values
 (pg_temp.p6id(601),pg_temp.p6id(201),pg_temp.p6id(301),'Project A','draft'),(pg_temp.p6id(602),pg_temp.p6id(202),pg_temp.p6id(301),'Project B','draft');
insert into "PYRUnibague_ProjectPositions"(id,project_id,title,capacity,status) values
 (pg_temp.p6id(801),pg_temp.p6id(601),'Position A',2,'test'),(pg_temp.p6id(802),pg_temp.p6id(602),'Position B',2,'test');
insert into "PYRUnibague_Assignments"(id,student_id,academic_period_id,project_position_id,status,source) values
 (pg_temp.p6id(901),pg_temp.p6id(401),pg_temp.p6id(301),pg_temp.p6id(801),'test','MANUAL'),
 (pg_temp.p6id(902),pg_temp.p6id(402),pg_temp.p6id(301),pg_temp.p6id(802),'test','MANUAL');
insert into "PYRUnibague_StudentDocuments"(id,student_id,category_code,file_name,bucket_id,object_path,status)
 values(pg_temp.p6id(1001),pg_temp.p6id(401),'cv','cv.pdf','pyrunibague-student-documents',pg_temp.p6id(401)||'/'||pg_temp.p6id(1001)||'/cv.pdf','test');

set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.p6id(1)::text,true);
select lives_ok($q$select public.pyr_unibague_change_organization_advisor(pg_temp.p6id(201),pg_temp.p6id(301),pg_temp.p6id(101))$q$,'ADMIN manually assigns organization A');
select lives_ok($q$select public.pyr_unibague_change_organization_advisor(pg_temp.p6id(202),pg_temp.p6id(301),pg_temp.p6id(102))$q$,'ADMIN assigns organization B independently');
select lives_ok($q$select public.pyr_unibague_change_organization_advisor(pg_temp.p6id(201),pg_temp.p6id(302),pg_temp.p6id(102))$q$,'Organization responsibility is period-specific');
select lives_ok($q$select public.pyr_unibague_change_student_advisor(pg_temp.p6id(501),pg_temp.p6id(101),current_date,'Individual A',pg_temp.p6id(901))$q$,'Student assignment accepts matching source');
select lives_ok($q$select public.pyr_unibague_change_student_advisor(pg_temp.p6id(502),pg_temp.p6id(102))$q$,'Student B assigned independently');
select lives_ok($q$select public.pyr_unibague_change_student_advisor(pg_temp.p6id(503),pg_temp.p6id(102))$q$,'Student responsibility is period-specific');
select public.pyr_unibague_change_student_advisor(pg_temp.p6id(501),pg_temp.p6id(101),current_date,'Administrative source correction',pg_temp.p6id(901));
select ok((select count(*)=2 and count(*) filter(where is_current)=1 from "PYRUnibague_AdvisorStudentAssignments" where participation_id=pg_temp.p6id(501)),'Same-advisor source or reason correction retains history');
select public.pyr_unibague_change_student_advisor(pg_temp.p6id(501),pg_temp.p6id(101),current_date,'Administrative source correction',pg_temp.p6id(901));
select ok((select count(*)=2 from "PYRUnibague_AdvisorStudentAssignments" where participation_id=pg_temp.p6id(501)),'Identical individual correction is idempotent');
select lives_ok($q$select public.pyr_unibague_change_organization_advisor(pg_temp.p6id(201),pg_temp.p6id(301),pg_temp.p6id(102))$q$,'Organization advisor can change');
select ok((select count(*)=2 and count(*) filter(where is_current)=1 from "PYRUnibague_AdvisorOrganizationAssignments" where organization_id=pg_temp.p6id(201) and academic_period_id=pg_temp.p6id(301)),'Change retains history and one current advisor');
select ok((select advisor_id=pg_temp.p6id(101) from "PYRUnibague_AdvisorStudentAssignments" where participation_id=pg_temp.p6id(501) and is_current),'Organization change does not propagate to student');
select ok(pyr_unibague_private.advisor_for_project(pg_temp.p6id(601))=false,'Unrelated ADMIN without ADVISOR is not an advisor for project');
select ok((select bool_and(assigned_by=auth.uid()) from "PYRUnibague_AdvisorOrganizationAssignments" where organization_id=pg_temp.p6id(201) and academic_period_id=pg_temp.p6id(301)),'Organization change actor is persisted ADMIN');
select public.pyr_unibague_change_organization_advisor(pg_temp.p6id(201),pg_temp.p6id(301),pg_temp.p6id(102));
select ok((select count(*)=2 from "PYRUnibague_AdvisorOrganizationAssignments" where organization_id=pg_temp.p6id(201) and academic_period_id=pg_temp.p6id(301)),'Same advisor request is idempotent');
select throws_ok($q$select public.pyr_unibague_change_student_advisor(pg_temp.p6id(501),pg_temp.p6id(102),current_date,null,pg_temp.p6id(902))$q$,'23514',null,'Source must belong to the same student and period');
select throws_ok($q$select public.pyr_unibague_change_student_advisor(pg_temp.p6id(503),pg_temp.p6id(101),current_date,null,pg_temp.p6id(901))$q$,'23514',null,'Source in another period is rejected');
select throws_ok($q$select public.pyr_unibague_change_organization_advisor(pg_temp.p6id(201),pg_temp.p6id(301),pg_temp.p6id(103))$q$,'23514',null,'Staff profile plus editable metadata does not grant ADVISOR');
select throws_ok($q$select public.pyr_unibague_change_organization_advisor(pg_temp.p6id(201),pg_temp.p6id(301),pg_temp.p6id(104))$q$,'23514',null,'Inactive staff cannot receive a responsibility');
select throws_ok($q$select public.pyr_unibague_change_student_advisor(pg_temp.p6id(501),pg_temp.p6id(101),current_date+1)$q$,'22023',null,'Future current responsibility cannot be created');
select throws_ok($q$insert into "PYRUnibague_AdvisorStudentAssignments"(advisor_id,participation_id,starts_on) values(pg_temp.p6id(101),pg_temp.p6id(501),current_date)$q$,'42501',null,'ADMIN must use transactional history RPC');
select public.pyr_unibague_change_organization_advisor(pg_temp.p6id(201),pg_temp.p6id(301),null);
select ok((select count(*)=0 from "PYRUnibague_AdvisorOrganizationAssignments" where organization_id=pg_temp.p6id(201) and academic_period_id=pg_temp.p6id(301) and is_current),'Withdrawal finalizes current organization responsibility');
select set_config('request.jwt.claim.sub',pg_temp.p6id(2)::text,true);
select ok(jsonb_array_length(public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))->'projects')=1,'Individual advisor retains student project after organization withdrawal');
select ok(jsonb_array_length(public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))->'organizations')=0,'Student project access does not grant organization responsibility');
select set_config('request.jwt.claim.sub',pg_temp.p6id(1)::text,true);
select public.pyr_unibague_change_organization_advisor(pg_temp.p6id(201),pg_temp.p6id(301),pg_temp.p6id(101));
select ok(exists(select 1 from "PYRUnibague_AuditLogs" where entity_table='PYRUnibague_AdvisorStudentAssignments' and actor_user_id=pg_temp.p6id(1) and action='INSERT'),'Student history change actor retained in audit');

reset role;
select throws_ok($q$insert into "PYRUnibague_AdvisorOrganizationAssignments"(advisor_id,organization_id,academic_period_id,starts_on) values(pg_temp.p6id(102),pg_temp.p6id(201),pg_temp.p6id(301),current_date)$q$,'23505',null,'Database enforces one current organization advisor');
select throws_ok($q$insert into "PYRUnibague_AdvisorStudentAssignments"(advisor_id,participation_id,starts_on) values(pg_temp.p6id(102),pg_temp.p6id(501),current_date)$q$,'23505',null,'Database enforces one current student advisor');
select throws_ok($q$update "PYRUnibague_AdvisorOrganizationAssignments" set advisor_id=pg_temp.p6id(101) where not is_current$q$,'23514',null,'Closed responsibility cannot be rewritten');
select throws_ok($q$delete from "PYRUnibague_AdvisorStudentAssignments"$q$,'23514',null,'Student history cannot be deleted');
select throws_ok($q$insert into "PYRUnibague_AdvisorStudentAssignments"(advisor_id,participation_id,starts_on,source_assignment_id) values(pg_temp.p6id(101),pg_temp.p6id(503),current_date,pg_temp.p6id(901))$q$,'23514',null,'Even privileged imports reject contradictory source assignment');
select throws_ok($q$insert into "PYRUnibague_AdvisorOrganizationAssignments"(advisor_id,organization_id,academic_period_id,starts_on) values(pg_temp.p6id(103),pg_temp.p6id(202),pg_temp.p6id(302),current_date)$q$,'23514',null,'Even privileged imports require legitimate current ADVISOR');
select throws_ok($q$update "PYRUnibague_StaffProfiles" set user_id=pg_temp.p6id(6) where id=pg_temp.p6id(101)$q$,'23514',null,'Staff identity cannot be transferred');
select throws_ok($q$update "PYRUnibague_StudentPeriodParticipations" set academic_period_id=pg_temp.p6id(302) where id=pg_temp.p6id(502)$q$,'23514',null,'Participation period cannot move referenced advisor history');
select throws_ok($q$update "PYRUnibague_Assignments" set student_id=pg_temp.p6id(402) where id=pg_temp.p6id(901)$q$,'23514',null,'Assignment student cannot contradict historical advisor source');

set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.p6id(1)::text,true);
select public.pyr_unibague_save_organization_contact(pg_temp.p6id(201),'Contact A',null,'Manager','a@example.test','123',null,true);
select public.pyr_unibague_save_organization_contact(pg_temp.p6id(201),'Contact A2',null,null,null,null,null,true);
select public.pyr_unibague_save_organization_contact(pg_temp.p6id(202),'Contact B',null,null,null,null,null,true);
select ok((select count(*)=2 and count(*) filter(where is_primary)=1 from "PYRUnibague_OrganizationContacts" where organization_id=pg_temp.p6id(201)),'Primary replacement retains other organization contacts');
select lives_ok($q$insert into "PYRUnibague_ProjectInterlocutors"(project_id,organization_contact_id,is_primary_for_project) select pg_temp.p6id(601),id,true from "PYRUnibague_OrganizationContacts" where full_name='Contact A'$q$,'Project operational contact can differ from organization primary');
select throws_ok($q$insert into "PYRUnibague_ProjectInterlocutors"(project_id,organization_contact_id) select pg_temp.p6id(601),id from "PYRUnibague_OrganizationContacts" where full_name='Contact B'$q$,'23514',null,'Project rejects contact from another organization');
select throws_ok($q$insert into "PYRUnibague_ProjectInterlocutors"(project_id,organization_contact_id,is_primary_for_project) select pg_temp.p6id(601),id,true from "PYRUnibague_OrganizationContacts" where full_name='Contact A2'$q$,'23505',null,'Project has at most one operational primary');
select throws_ok($q$insert into "PYRUnibague_ProjectParticipatingOrganizations"(project_id,organization_id) values(pg_temp.p6id(601),pg_temp.p6id(201))$q$,'23514',null,'Additional participant cannot duplicate owner');
select lives_ok($q$insert into "PYRUnibague_ProjectParticipatingOrganizations"(project_id,organization_id) values(pg_temp.p6id(601),pg_temp.p6id(202))$q$,'Additional participating organization is optional');
select throws_ok($q$insert into "PYRUnibague_ProjectParticipatingOrganizations"(project_id,organization_id) values(pg_temp.p6id(601),pg_temp.p6id(202))$q$,'23505',null,'Participating organization cannot duplicate relation');
select throws_ok($q$update "PYRUnibague_Projects" set organization_id=pg_temp.p6id(202) where id=pg_temp.p6id(601)$q$,'23514',null,'Parent owner edit cannot contradict interlocutors or participants');
select ok((select count(*)=0 from "PYRUnibague_ProjectTechnicalTeachers"),'Projects and assignments exist without a technical teacher');
select lives_ok($q$insert into "PYRUnibague_ProjectTechnicalTeachers"(project_id,teacher_id) values(pg_temp.p6id(601),pg_temp.p6id(102))$q$,'Optional technical teacher can be linked');
select throws_ok($q$insert into "PYRUnibague_ProjectTechnicalTeachers"(project_id,teacher_id) values(pg_temp.p6id(601),pg_temp.p6id(102))$q$,'23505',null,'Technical teacher duplicate rejected');
select lives_ok($q$insert into "PYRUnibague_StudentSpecialCases"(participation_id,case_type_code,status,reviewed_by,decision_notes) values(pg_temp.p6id(501),'manual-request','under_review',pg_temp.p6id(7),'Administrative basis only')$q$,'ADMIN manages minimal special case with open code');
select ok((select reviewed_by=pg_temp.p6id(1) from "PYRUnibague_StudentSpecialCases" where participation_id=pg_temp.p6id(501)),'Reviewer cannot be spoofed');
update "PYRUnibague_StudentPeriodParticipations" set arl_provider_name='Test ARL' where id=pg_temp.p6id(501);

reset role;
select throws_ok($q$insert into "PYRUnibague_OrganizationContacts"(organization_id,full_name,is_primary) values(pg_temp.p6id(201),'Duplicate primary',true)$q$,'23505',null,'Partial index enforces one organization primary');
select throws_ok($q$update "PYRUnibague_OrganizationContacts" set organization_id=pg_temp.p6id(202) where full_name='Contact A'$q$,'23514',null,'Contact cannot move to another organization');

set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.p6id(2)::text,true);
select ok(public.pyr_unibague_has_role('ADVISOR'),'ADVISOR role comes from UserRoles');
select ok((select count(*)=1 from "PYRUnibague_StaffProfiles"),'Advisor reads own staff profile only');
select ok((select count(*)=1 from "PYRUnibague_AdvisorOrganizationAssignments"),'Advisor reads only current own organization responsibility');
select ok((select count(*)=1 from "PYRUnibague_AdvisorStudentAssignments"),'Advisor reads only current own student responsibility');
select ok((select count(*)=0 from "PYRUnibague_OrganizationContacts"),'Advisor contacts are projected without raw linked Auth identifiers');
select ok(jsonb_array_length(public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))->'organizations')=1,'Workspace selects responsible organizations');
select ok(jsonb_array_length(public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))->'students')=1,'Workspace selects responsible students');
select ok(public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))->'students'->0->>'bio'='Professional A','Advisor reads necessary professional profile');
select ok(public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))->'projects'->0->>'name'='Project A','Advisor sees only associated projects');
select ok(public.pyr_unibague_advisor_workspace(pg_temp.p6id(302))='{"organizations":[],"students":[],"projects":[]}'::jsonb,'Selected period never leaks another period');
select ok(public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))::text not like '%private-%','Projection omits private student code and tax IDs');
select ok(not (public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))->'students'->0 ?| array['user_id','student_code','arl_provider_name','decision_notes','documents','institutional_email']),'Projection omits private administrative and identity fields');
select ok((select count(*)=0 from "PYRUnibague_StudentDocuments"),'Advisor gets no private student documents');
select ok((select count(*)=0 from "PYRUnibague_StudentSpecialCases"),'Advisor gets no confidential case notes');
select ok((select count(*)=0 from "PYRUnibague_Students"),'RPC does not broaden underlying student table access');
select throws_ok($q$select public.pyr_unibague_change_student_advisor(pg_temp.p6id(501),pg_temp.p6id(102))$q$,'42501',null,'Advisor cannot self-assign or change responsibilities');
select throws_ok($q$insert into "PYRUnibague_StudentSpecialCases"(participation_id,case_type_code,status) values(pg_temp.p6id(501),'test','test')$q$,'42501',null,'Advisor cannot review special cases');
select set_config('request.jwt.claim.sub',pg_temp.p6id(3)::text,true);
select ok(public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))->'students'->0->>'bio'='Professional B','Second advisor sees only own student');
select ok(public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))->'organizations'->0->>'name'='Organization B','Second advisor sees only own organization');
select set_config('request.jwt.claim.sub',pg_temp.p6id(4)::text,true);
select throws_ok($q$select public.pyr_unibague_change_organization_advisor(pg_temp.p6id(201),pg_temp.p6id(301),pg_temp.p6id(101))$q$,'42501',null,'Student cannot alter administrative responsibility');
select throws_ok($q$select public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))$q$,'42501',null,'Student cannot invoke advisor projection');
update "PYRUnibague_StudentPeriodParticipations" set arl_provider_name='Spoofed ARL' where id=pg_temp.p6id(501);
select ok((select arl_provider_name='Test ARL' from "PYRUnibague_StudentPeriodParticipations" where id=pg_temp.p6id(501)),'Student cannot edit ARL');
select ok((select count(*)=0 from "PYRUnibague_StudentSpecialCases"),'Student cannot read confidential case decisions');
select set_config('request.jwt.claim.sub',pg_temp.p6id(6)::text,true);
select ok((select count(*)=2 from "PYRUnibague_OrganizationContacts"),'Organization reads only own contacts');
select lives_ok($q$select public.pyr_unibague_save_organization_contact(pg_temp.p6id(201),'Manager contact')$q$,'Active manager can create own contact');
select throws_ok($q$select public.pyr_unibague_save_organization_contact(pg_temp.p6id(202),'Foreign contact')$q$,'42501',null,'Manager cannot create contact in another organization');
select throws_ok($q$insert into "PYRUnibague_UserRoles"(user_id,role_id) select auth.uid(),id from "PYRUnibague_Roles" where code='ADVISOR'$q$,'42501',null,'Contact manager cannot elevate to ADVISOR');
select set_config('request.jwt.claim.sub',pg_temp.p6id(7)::text,true);
select ok(not public.pyr_unibague_has_role('ADVISOR'),'Editable ADVISOR metadata never grants role');
select throws_ok($q$select public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))$q$,'42501',null,'Staff row plus metadata cannot invoke workspace');
select set_config('request.jwt.claim.sub',pg_temp.p6id(8)::text,true);
select throws_ok($q$select public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))$q$,'42501',null,'Inactive advisor profile fails closed');
select set_config('request.jwt.claim.sub',pg_temp.p6id(1)::text,true);
select public.pyr_unibague_change_student_advisor(pg_temp.p6id(501),pg_temp.p6id(102),current_date,'Individual correction');
select ok((select count(*)=3 and count(*) filter(where is_current)=1 from "PYRUnibague_AdvisorStudentAssignments" where participation_id=pg_temp.p6id(501)),'Individual correction retains student history');
select ok((select advisor_id=pg_temp.p6id(101) from "PYRUnibague_AdvisorOrganizationAssignments" where organization_id=pg_temp.p6id(201) and academic_period_id=pg_temp.p6id(301) and is_current),'Individual correction does not change organization advisor');
select set_config('request.jwt.claim.sub',pg_temp.p6id(2)::text,true);
select ok(jsonb_array_length(public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))->'students')=0,'Former student advisor loses access immediately');
reset role;
delete from "PYRUnibague_UserRoles" where user_id=pg_temp.p6id(2);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.p6id(2)::text,true);
select throws_ok($q$select public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))$q$,'42501',null,'Revoked persisted role invalidates workspace immediately');
select ok((select count(*)=0 from "PYRUnibague_AdvisorOrganizationAssignments"),'Revoked advisor loses assignment row access');
reset role;
set local role anon;
select throws_ok($q$select public.pyr_unibague_advisor_workspace(pg_temp.p6id(301))$q$,'42501',null,'Anonymous cannot execute advisor RPC');
select throws_ok($q$select * from "PYRUnibague_OrganizationContacts"$q$,'42501',null,'Anonymous cannot read contacts');
reset role;
select * from finish();
rollback;
