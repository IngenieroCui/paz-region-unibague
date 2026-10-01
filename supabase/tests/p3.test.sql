begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
insert into auth.users (id,email) values
('03000000-0000-0000-0000-000000000001','p3-student@example.test'),
('03000000-0000-0000-0000-000000000002','p3-org-a@example.test'),
('03000000-0000-0000-0000-000000000003','p3-org-b@example.test');
insert into "PYRUnibague_UserRoles" (user_id, role_id)
select u.id,r.id from auth.users u cross join "PYRUnibague_Roles" r where
(u.id='03000000-0000-0000-0000-000000000001' and r.code='STUDENT') or
(u.id in ('03000000-0000-0000-0000-000000000002','03000000-0000-0000-0000-000000000003') and r.code='ORGANIZATION');
insert into "PYRUnibague_Students" (id,user_id) values ('13000000-0000-0000-0000-000000000001','03000000-0000-0000-0000-000000000001');
insert into "PYRUnibague_Municipalities" (id,department_code,department_name,municipality_code,municipality_name) values
('23000000-0000-0000-0000-000000000001','TEST','Test','A','A'),('23000000-0000-0000-0000-000000000002','TEST','Test','B','B');
insert into "PYRUnibague_StudentInterests" (id,student_id,label,sort_order) values
('33000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001','A',1),
('33000000-0000-0000-0000-000000000002','13000000-0000-0000-0000-000000000001','B',2);
create function pg_temp.denied_p3(statement text) returns boolean language plpgsql as $$ begin execute statement; return false; exception when insufficient_privilege then return true; end $$;
select ok(not has_function_privilege('anon','public.pyr_unibague_register_organization(text,text,text,text,text,uuid,uuid)','EXECUTE'),'anon has no registration execute');
select ok(not exists (select 1 from pg_proc p, lateral aclexplode(p.proacl) a where p.proname='pyr_unibague_register_organization' and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC has no registration execute');
set local role anon;
select ok(pg_temp.denied_p3($$select public.pyr_unibague_register_organization('A')$$),'anon cannot register');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','03000000-0000-0000-0000-000000000001',true);
select ok(pg_temp.denied_p3($$select public.pyr_unibague_register_organization('Student entity')$$),'STUDENT cannot register');
select lives_ok($$select public.pyr_unibague_set_student_preferences('13000000-0000-0000-0000-000000000001',array['23000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000002']::uuid[])$$,'Create ordered preferences');
select lives_ok($$select public.pyr_unibague_set_student_preferences('13000000-0000-0000-0000-000000000001',array['23000000-0000-0000-0000-000000000002','23000000-0000-0000-0000-000000000001']::uuid[])$$,'Swap avoids immediate unique conflict');
select is((select municipality_id::text from "PYRUnibague_StudentLocationPreferences" where preference_order=1),'23000000-0000-0000-0000-000000000002','Preferred B is first');
select throws_ok($$select public.pyr_unibague_set_student_preferences('13000000-0000-0000-0000-000000000001',array['23000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000001']::uuid[])$$,'22023','Invalid ordered municipalities','Reject duplicate municipalities atomically');
select is((select count(*)::integer from "PYRUnibague_StudentLocationPreferences"),2,'Failed reorder preserves prior data');
select lives_ok($$select public.pyr_unibague_set_student_preferences('13000000-0000-0000-0000-000000000001',array['23000000-0000-0000-0000-000000000001']::uuid[])$$,'Remove preference atomically');
select is((select preference_order from "PYRUnibague_StudentLocationPreferences"),1,'Remaining preference normalized to 1');
select lives_ok($$select public.pyr_unibague_order_student_interests('13000000-0000-0000-0000-000000000001',array['33000000-0000-0000-0000-000000000002','33000000-0000-0000-0000-000000000001']::uuid[])$$,'Order interests');
select is((select label from "PYRUnibague_StudentInterests" where sort_order=1),'B','Interest order persisted');
select throws_ok($$select public.pyr_unibague_order_student_interests('13000000-0000-0000-0000-000000000001',array['33000000-0000-0000-0000-000000000001']::uuid[])$$,'22023','Invalid ordered interests','Reject incomplete interest ordering');
select set_config('request.jwt.claim.sub','03000000-0000-0000-0000-000000000002',true);
select lives_ok($$select public.pyr_unibague_register_organization('P3 A',null,'TEST-A')$$,'ORGANIZATION registers via RPC');
select set_config('p3.org_a', (select id::text from "PYRUnibague_Organizations" where legal_name='P3 A'), true);
select is((select count(*)::integer from "PYRUnibague_Organizations"),1,'Registration exposes own organization');
select is((select status from "PYRUnibague_Organizations" limit 1),'pending_review','Initial technical state');
select ok((select verified_at is null and verified_by is null and created_by=auth.uid() from "PYRUnibague_Organizations" limit 1),'Unverified and created by caller');
select ok((select can_manage and is_primary_contact and status='active' and user_id=auth.uid() from "PYRUnibague_OrganizationMembers" limit 1),'Correct management membership');
select lives_ok($$select public.pyr_unibague_register_organization('P3 A',null,'TEST-A')$$,'Retry is idempotent');
select is((select count(*)::integer from "PYRUnibague_Organizations"),1,'Retry does not duplicate');
select lives_ok($$select public.pyr_unibague_register_organization('P3 A second',null,'TEST-A2')$$,'Future multiple managed organizations remain possible');
select is((select count(*)::integer from "PYRUnibague_Organizations"),2,'Second distinct organization is allowed');
select ok(pg_temp.denied_p3($$update "PYRUnibague_Organizations" set status='approved',verified_at=now(),verified_by=auth.uid()$$),'No self verification');
select ok(pg_temp.denied_p3($$insert into "PYRUnibague_Organizations" (legal_name,status) values ('Direct','approved')$$),'No generic INSERT policy');
select throws_ok($$select public.pyr_unibague_register_organization(' ')$$,'22023','Invalid organization input','Validate legal name');
select throws_ok($$select public.pyr_unibague_register_organization('Bad URL',null,null,null,'javascript:alert(1)')$$,'22023','Invalid organization input','Validate website in database');
select ok(pg_temp.denied_p3($$select public.pyr_unibague_set_student_preferences('13000000-0000-0000-0000-000000000001',array[]::uuid[])$$),'Organization cannot reorder student preferences');
reset role;
insert into "PYRUnibague_OrganizationReviews" (organization_id,decision,notes) select id,'changes_requested','Visible review' from "PYRUnibague_Organizations" where legal_name='P3 A';
set local role authenticated;
select set_config('request.jwt.claim.sub','03000000-0000-0000-0000-000000000002',true);
select is((select count(*)::integer from "PYRUnibague_OrganizationReviews"),1,'Member can read own reviews');
select ok(pg_temp.denied_p3($$insert into "PYRUnibague_OrganizationReviews" (organization_id,decision) select id,'approved' from "PYRUnibague_Organizations" limit 1$$),'Member cannot create reviews');
update "PYRUnibague_OrganizationReviews" set decision='approved';
select is((select decision from "PYRUnibague_OrganizationReviews" limit 1),'changes_requested','Member cannot edit reviews');
select set_config('request.jwt.claim.sub','03000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.pyr_unibague_register_organization('P3 B')$$,'Organization B registers');
select is((select count(*)::integer from "PYRUnibague_OrganizationReviews"),0,'B cannot see A reviews');
update "PYRUnibague_Organizations" set legal_name='Stolen' where legal_name='P3 A';
select is((select count(*)::integer from "PYRUnibague_Organizations" where legal_name='Stolen'),0,'B cannot edit A');
select ok(pg_temp.denied_p3($$insert into "PYRUnibague_OrganizationDocuments" (id,organization_id,category_code,file_name,bucket_id,object_path,status,uploaded_by) values ('93000000-0000-0000-0000-000000000001',current_setting('p3.org_a')::uuid,'test','x.pdf','pyrunibague-organization-documents',current_setting('p3.org_a')||'/93000000-0000-0000-0000-000000000001/x.pdf','uploaded',auth.uid())$$),'Cross-organization document insert denied');
reset role;
select is((select count(*)::integer from storage.buckets where public and id like 'pyrunibague-%-documents'),0,'Buckets remain private');
select * from finish();
rollback;
