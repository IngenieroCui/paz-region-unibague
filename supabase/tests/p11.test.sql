-- Only an isolated disposable database. No hosted Auth accounts are created by this suite.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.p11_id(n integer) returns uuid language sql immutable as $$select ('b1100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.p11_denied(statement text,expected text) returns boolean language plpgsql as $$
declare caught text;
begin begin execute statement; exception when others then get stacked diagnostics caught=returned_sqlstate; end; return caught=expected; end $$;

select ok(not pyr_unibague_external_registration_ready(),'public registration closed by default');
select ok(not has_function_privilege('anon','public.pyr_unibague_start_external_onboarding()','execute'),'anon cannot grant onboarding role');
select ok(not has_function_privilege('authenticated','pyr_unibague_private.before_external_user_created(jsonb)','execute'),'browser cannot call Auth hook');
select ok(has_function_privilege('supabase_auth_admin','pyr_unibague_private.before_external_user_created(jsonb)','execute'),'Auth server can call hook');
select ok(pyr_unibague_private.before_external_user_created('{"user":{"email":"a@external.test","app_metadata":{"provider":"email"}}}') ? 'error','closed hook refuses new accounts');
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (pg_temp.p11_id(1),'p11-admin@external.test',now(),'{}'),
 (pg_temp.p11_id(2),'p11-external@external.test',now(),'{"role":"ADMIN"}'),
 (pg_temp.p11_id(3),'p11-unconfirmed@external.test',null,'{}'),
 (pg_temp.p11_id(4),'p11-student@unibague.edu.co',now(),'{}'),
 (pg_temp.p11_id(5),'p11-other@external.test',now(),'{}');
insert into auth.identities(user_id,provider,provider_id,identity_data)
 select pg_temp.p11_id(n),'email',pg_temp.p11_id(n)::text,'{}' from generate_series(1,5) n;
insert into "PYRUnibague_UserRoles"(user_id,role_id)
 select pg_temp.p11_id(1),id from "PYRUnibague_Roles" where code='ADMIN';
insert into "PYRUnibague_UserRoles"(user_id,role_id)
 select pg_temp.p11_id(4),id from "PYRUnibague_Roles" where code='STUDENT';
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.p11_id(2)::text,true);
select is((select count(*)::integer from pyr_unibague_current_roles()),0,'metadata does not grant ADMIN');
select ok(pg_temp.p11_denied('select pyr_unibague_start_external_onboarding()','42501'),'closed onboarding does not grant role');
reset role;
update "PYRUnibague_SystemConfigurations" set value=jsonb_build_object('enabled',true,'smtp_verified',true,'captcha_enabled',true,'hook_installed',true,'terms_approved',true,'activated_at',now()-interval '1 day') where key='p11_external_registration';
select ok(pyr_unibague_external_registration_ready(),'all server prerequisites are necessary');
update auth.users set created_at=now()-interval '2 days' where id=pg_temp.p11_id(5);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.p11_id(5)::text,true);
select ok(pg_temp.p11_denied('select pyr_unibague_start_external_onboarding()','42501'),'accounts predating safe registration cannot use prior autoconfirmation');
reset role;
update auth.users set created_at=now() where id=pg_temp.p11_id(5);
insert into auth.identities(user_id,provider,provider_id,identity_data) values(pg_temp.p11_id(2),'google','p11-google-identity','{}');
select is((select count(*)::integer from "PYRUnibague_UserProfiles" where user_id=pg_temp.p11_id(2)),1,'an additional provider identity does not create a second profile');
select ok(not(pyr_unibague_private.before_external_user_created('{"user":{"email":"a@external.test","is_anonymous":false,"app_metadata":{"provider":"email"},"user_metadata":{"display_name":"Persona Prueba","role":"ADMIN"}}}') ? 'error'),'external email hook grants no privileges');
select ok(pyr_unibague_private.before_external_user_created('{"user":{"email":"a@unibague.edu.co","app_metadata":{"provider":"email"}}}') ? 'error','institutional self signup denied');
select ok(pyr_unibague_private.before_external_user_created('{"user":{"email":"a@sub.unibague.edu.co","app_metadata":{"provider":"email"}}}') ? 'error','institutional subdomain denied');
select ok(pyr_unibague_private.before_external_user_created('{"user":{"email":"a@external.test","app_metadata":{"provider":"google"}}}') ? 'error','new OAuth identity gets no university role');
select ok(pyr_unibague_private.before_external_user_created('{"user":{"email":"bad","app_metadata":{"provider":"email"}}}') ? 'error','malformed email denied');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.p11_id(3)::text,true);
select ok(pg_temp.p11_denied('select pyr_unibague_start_external_onboarding()','42501'),'unconfirmed email cannot onboard');
select set_config('request.jwt.claim.sub',pg_temp.p11_id(4)::text,true);
select ok(pg_temp.p11_denied('select pyr_unibague_start_external_onboarding()','42501'),'STUDENT cannot become an organization by visiting external login');
select set_config('request.jwt.claim.sub',pg_temp.p11_id(2)::text,true);
select lives_ok('select pyr_unibague_start_external_onboarding()','verified external identity obtains minimal pending capabilities');
select lives_ok('select pyr_unibague_start_external_onboarding()','onboarding retries are idempotent');
select is((select count(*)::integer from pyr_unibague_current_roles()),1,'only one persisted role');
select is((select * from pyr_unibague_current_roles()),'ORGANIZATION','role is never ADMIN ADVISOR or STUDENT');
select set_config('p11.organization',pyr_unibague_register_organization('P11 Organización externa',p_tax_id=>'P11-123')::text,true);
select is((select status from "PYRUnibague_Organizations" where id=current_setting('p11.organization')::uuid),'pending_review','P3 creates a pending organization');
select is(pyr_unibague_register_organization('P11 Organización externa',p_tax_id=>'P11-123')::text,current_setting('p11.organization'),'registration retries reuse organization and membership');
select ok((select can_manage and membership_role='owner' from "PYRUnibague_OrganizationMembers" where organization_id=current_setting('p11.organization')::uuid),'owner membership is restricted to the new organization');
select ok(pg_temp.p11_denied($$update "PYRUnibague_Organizations" set status='approved' where id=current_setting('p11.organization')::uuid$$,'42501'),'no self approval');
select ok(pg_temp.p11_denied($$update "PYRUnibague_Organizations" set verified_at=now() where id=current_setting('p11.organization')::uuid$$,'42501'),'no self verification');
select ok(pg_temp.p11_denied($$select pyr_unibague_submit_organization(current_setting('p11.organization')::uuid)$$,'23514'),'incomplete request cannot submit');
select ok(pg_temp.p11_denied($$select pyr_unibague_review_organization(current_setting('p11.organization')::uuid,'approved')$$,'42501'),'only ADMIN reviews');
reset role;
insert into "PYRUnibague_OrganizationTypes"(id,code,name) values(pg_temp.p11_id(20),'P11','Tipo P11');
insert into "PYRUnibague_Municipalities"(id,country_code,department_code,department_name,municipality_code,municipality_name) values(pg_temp.p11_id(21),'CO','P11','Departamento P11','P11','Municipio P11');
insert into "PYRUnibague_AcademicPeriods"(id,code,name,status) values(pg_temp.p11_id(22),'P11','Periodo P11','test');
set local role authenticated;
update "PYRUnibague_Organizations" set organization_type_id=pg_temp.p11_id(20),municipality_id=pg_temp.p11_id(21),description='Descripción P11' where id=current_setting('p11.organization')::uuid;
select lives_ok($$select pyr_unibague_save_organization_contact(current_setting('p11.organization')::uuid,'Responsable P11',p_email=>'p11-external@external.test',p_is_primary=>true)$$,'primary interlocutor uses P6 RPC');
select lives_ok($$select pyr_unibague_submit_organization(current_setting('p11.organization')::uuid)$$,'complete organization submits');
select lives_ok($$select pyr_unibague_submit_organization(current_setting('p11.organization')::uuid)$$,'submission is idempotent');
select is((select status from "PYRUnibague_Organizations" where id=current_setting('p11.organization')::uuid),'submitted','valid submitted state');
select is((select count(*)::integer from "PYRUnibague_OrganizationReviews"),0,'submission does not fabricate an administrative review');
select set_config('request.jwt.claim.sub',pg_temp.p11_id(5)::text,true);
select lives_ok('select pyr_unibague_start_external_onboarding()','second verified external identity can start its own application');
select is((select count(*)::integer from "PYRUnibague_Organizations"),0,'no cross organization read');
select is((select count(*)::integer from "PYRUnibague_OrganizationContacts"),0,'no cross contact read');
select is((select count(*)::integer from "PYRUnibague_OrganizationDocuments"),0,'no cross private document metadata read');
select is((select count(*)::integer from "PYRUnibague_OrganizationReviews"),0,'no cross review read');
select ok(pg_temp.p11_denied($$select pyr_unibague_submit_organization(current_setting('p11.organization')::uuid)$$,'42501'),'no cross submission');
select ok(pg_temp.p11_denied($$select pyr_unibague_register_organization('Different name',p_tax_id=>'P11.123')$$,'23505'),'normalized tax duplicate denied across actors');
select ok(pg_temp.p11_denied($$insert into "PYRUnibague_OrganizationMembers"(organization_id,user_id,membership_role,can_manage,status) values(current_setting('p11.organization')::uuid,auth.uid(),'owner',true,'active')$$,'42501'),'cannot invent privileged memberships');
select set_config('request.jwt.claim.sub',pg_temp.p11_id(1)::text,true);
select lives_ok($$select pyr_unibague_review_organization(current_setting('p11.organization')::uuid,'changes_required','Corrige el soporte')$$,'ADMIN requests corrections using P4');
select set_config('request.jwt.claim.sub',pg_temp.p11_id(2)::text,true);
select is((select notes from "PYRUnibague_OrganizationReviews"),'Corrige el soporte','applicant reads own observations');
select lives_ok($$update "PYRUnibague_Organizations" set description='Corregida' where id=current_setting('p11.organization')::uuid$$,'correction keeps organization identity');
select lives_ok($$select pyr_unibague_submit_organization(current_setting('p11.organization')::uuid)$$,'applicant resubmits permitted corrections');
select is((select count(*)::integer from "PYRUnibague_OrganizationReviews"),1,'resubmission preserves review history');
reset role;
insert into "PYRUnibague_Projects"(id,organization_id,academic_period_id,name,status) values(pg_temp.p11_id(30),current_setting('p11.organization')::uuid,pg_temp.p11_id(22),'Proyecto P11','draft');
insert into "PYRUnibague_ProjectPositions"(id,project_id,title,capacity,status) values(pg_temp.p11_id(31),pg_temp.p11_id(30),'Plaza P11',1,'open');
insert into "PYRUnibague_Calls"(id,organization_id,academic_period_id,title) values(pg_temp.p11_id(32),current_setting('p11.organization')::uuid,pg_temp.p11_id(22),'Convocatoria P11');
insert into "PYRUnibague_CallPositions"(call_id,project_position_id) values(pg_temp.p11_id(32),pg_temp.p11_id(31));
set local role authenticated;
select ok(pg_temp.p11_denied($$update "PYRUnibague_Calls" set status='open' where id=pg_temp.p11_id(32)$$,'42501'),'pending organization cannot publish a call');
select set_config('request.jwt.claim.sub',pg_temp.p11_id(1)::text,true);
select lives_ok($$select pyr_unibague_review_organization(current_setting('p11.organization')::uuid,'approved','Aprobada')$$,'ADMIN approves');
select ok((select verified_at is not null and verified_by=auth.uid() from "PYRUnibague_Organizations" where id=current_setting('p11.organization')::uuid),'approval records reviewer and timestamp');
select is((select count(*)::integer from "PYRUnibague_AuditLogs" where action='ORGANIZATION_SUBMITTED'),2,'request dates are persisted once per transition');
select set_config('request.jwt.claim.sub',pg_temp.p11_id(2)::text,true);
select lives_ok($$update "PYRUnibague_Calls" set status='open' where id=pg_temp.p11_id(32)$$,'approval unlocks publication');
select ok(pg_temp.p11_denied($$select pyr_unibague_submit_organization(current_setting('p11.organization')::uuid)$$,'23514'),'approved organization cannot reset its own status');
select set_config('request.jwt.claim.sub',pg_temp.p11_id(1)::text,true);
select lives_ok($$select pyr_unibague_review_organization(current_setting('p11.organization')::uuid,'rejected','No procede')$$,'ADMIN rejects without destroying history');
select set_config('request.jwt.claim.sub',pg_temp.p11_id(2)::text,true);
select is((select count(*)::integer from "PYRUnibague_OrganizationReviews"),3,'all three administrative decisions remain visible');
select ok(pg_temp.p11_denied($$select pyr_unibague_submit_organization(current_setting('p11.organization')::uuid)$$,'23514'),'rejected organization cannot reset its workflow');
reset role;
-- Even a persisted ADMIN must not approve an organization they belong to.
reset role;
insert into "PYRUnibague_OrganizationMembers"(organization_id,user_id,membership_role,can_manage,status)
values(current_setting('p11.organization')::uuid,pg_temp.p11_id(1),'owner',true,'active');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.p11_id(1)::text,true);
select ok(pg_temp.p11_denied($$select pyr_unibague_review_organization(current_setting('p11.organization')::uuid,'approved','Own organization')$$,'42501'),'multirole ADMIN cannot review own membership');
select ok(pg_temp.p11_denied($$update "PYRUnibague_Organizations" set status='approved',verified_at=now(),verified_by=auth.uid() where id=current_setting('p11.organization')::uuid$$,'42501'),'multirole ADMIN cannot bypass review by direct approval');
select is((select count(*)::integer from "PYRUnibague_OrganizationReviews"),3,'denied self approval creates no review history');
reset role;
select * from finish();
rollback;
