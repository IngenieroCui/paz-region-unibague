-- P11 preparation only. Do not apply to a hosted project without its verified admin connection.
begin;

insert into public."PYRUnibague_SystemConfigurations"(key,value,description,is_public)
values ('p11_external_registration', '{"enabled":false,"smtp_verified":false,"captcha_enabled":false,"hook_installed":false,"terms_approved":false}',
 'Enable only after institutional approval, delivered SMTP/PKCE tests, Auth CAPTCHA and Before User Created Hook installation.', false)
on conflict (key) do nothing;

create function public.pyr_unibague_external_registration_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select value @> '{"enabled":true,"smtp_verified":true,"captcha_enabled":true,"hook_installed":true,"terms_approved":true}'::jsonb
 and (value->>'activated_at')::timestamptz <= now()
 from public."PYRUnibague_SystemConfigurations" where key='p11_external_registration'),false);
$$;
revoke all on function public.pyr_unibague_external_registration_ready() from public;
grant execute on function public.pyr_unibague_external_registration_ready() to anon,authenticated,supabase_auth_admin;

-- Invoked by Auth only. A new email identity gets no role from this hook.
-- Existing authorized Google accounts may sign in/link through Supabase; new Google users are refused.
create function pyr_unibague_private.before_external_user_created(event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare email text:=lower(btrim(event->'user'->>'email')); display_name text:=event->'user'->'user_metadata'->>'display_name';
begin
 if not public.pyr_unibague_external_registration_ready()
 or coalesce(event->'user'->'app_metadata'->>'provider','')<>'email'
 or coalesce(event->'user'->>'is_anonymous','false')<>'false'
 or email is null or length(email)>254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or display_name is null or length(btrim(display_name)) not between 1 and 201
 or email ~ '@([^.@]+\.)*(unibague\.edu\.co|estudiantesunibague\.edu\.co)$' then
  return '{"error":{"http_code":403,"message":"No pudimos recibir la solicitud de registro."}}'::jsonb;
 end if;
 return '{}'::jsonb;
end;
$$;
grant usage on schema pyr_unibague_private to supabase_auth_admin;
revoke all on function pyr_unibague_private.before_external_user_created(jsonb) from public,anon,authenticated;
grant execute on function pyr_unibague_private.before_external_user_created(jsonb) to supabase_auth_admin;

create function public.pyr_unibague_start_external_onboarding() returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); identity auth.users; activation timestamptz;
begin
 if actor is null or not public.pyr_unibague_external_registration_ready() then
  raise exception 'External onboarding unavailable' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,11));
 select * into identity from auth.users where id=actor;
 select (value->>'activated_at')::timestamptz into activation from public."PYRUnibague_SystemConfigurations" where key='p11_external_registration';
 if identity.email_confirmed_at is null or identity.is_anonymous is true or identity.email is null
 or activation is null or identity.created_at is null or identity.created_at < activation
 or lower(identity.email) ~ '@([^.@]+\.)*(unibague\.edu\.co|estudiantesunibague\.edu\.co)$'
 or not exists(select 1 from auth.identities where user_id=actor and provider='email')
 or exists(select 1 from public."PYRUnibague_UserRoles" ur join public."PYRUnibague_Roles" r on r.id=ur.role_id where ur.user_id=actor and r.code<>'ORGANIZATION') then
  raise exception 'Verified external email identity required' using errcode='42501';
 end if;
 -- The only possible self-service role. Membership and administrative approval remain separate.
 insert into public."PYRUnibague_UserRoles"(user_id,role_id,assigned_by)
 select actor,id,actor from public."PYRUnibague_Roles" where code='ORGANIZATION'
 on conflict(user_id,role_id) do nothing;
end;
$$;
revoke all on function public.pyr_unibague_start_external_onboarding() from public,anon;
grant execute on function public.pyr_unibague_start_external_onboarding() to authenticated;

-- Keep P3 registration and P4 decisions. Serialize duplicate identities across applicants.
create function pyr_unibague_private.p11_organization_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare normalized text:=nullif(regexp_replace(lower(btrim(new.tax_id)),'[[:space:].-]','','g'),'');
begin
 if TG_OP='INSERT' then
  if auth.uid() is not null and not public.pyr_unibague_has_role('ADMIN') and
   (select count(*) from public."PYRUnibague_Organizations" where created_by=auth.uid() and created_at>now()-interval '1 hour')>=3 then
   raise exception 'Organization registration rate limit' using errcode='54000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(btrim(new.legal_name)),110));
  if exists(select 1 from public."PYRUnibague_Organizations" where lower(btrim(legal_name))=lower(btrim(new.legal_name)) and id<>new.id) then
   raise exception 'Organization request cannot be registered; contact coordination' using errcode='23505';
  end if;
 end if;
 if normalized is not null then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized,111));
  if exists(select 1 from public."PYRUnibague_Organizations" where regexp_replace(lower(btrim(tax_id)),'[[:space:].-]','','g')=normalized and id<>new.id) then
   raise exception 'Organization request cannot be registered; contact coordination' using errcode='23505';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function pyr_unibague_private.p11_organization_identity() from public,anon,authenticated;
create index p11_organization_tax_normalized on public."PYRUnibague_Organizations" ((regexp_replace(lower(btrim(tax_id)),'[[:space:].-]','','g')));
create index p11_organization_legal_trimmed on public."PYRUnibague_Organizations" ((lower(btrim(legal_name))));
create trigger p11_organization_identity before insert or update of tax_id on public."PYRUnibague_Organizations"
for each row execute function pyr_unibague_private.p11_organization_identity();

-- Submission timestamps use existing AuditLogs, preserving all P4 review records.
create function public.pyr_unibague_submit_organization(p_organization_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare organization public."PYRUnibague_Organizations";
begin
 if auth.uid() is null or not public.pyr_unibague_can_manage_org(p_organization_id) then
  raise exception 'Organization manager required' using errcode='42501';
 end if;
 select * into organization from public."PYRUnibague_Organizations" where id=p_organization_id for update;
 if organization.status='submitted' then return; end if;
 if organization.status not in ('pending_review','changes_required','changes_requested') then
  raise exception 'Organization cannot be submitted in this state' using errcode='23514';
 end if;
 if organization.organization_type_id is null or organization.municipality_id is null
 or nullif(btrim(organization.description),'') is null
 or not exists(select 1 from public."PYRUnibague_OrganizationContacts" where organization_id=p_organization_id and is_primary) then
  raise exception 'Complete organization profile and primary contact' using errcode='23514';
 end if;
 update public."PYRUnibague_Organizations" set status='submitted' where id=p_organization_id;
 insert into public."PYRUnibague_AuditLogs"(actor_user_id,action,entity_table,entity_id,changed_fields)
 values(auth.uid(),'ORGANIZATION_SUBMITTED','PYRUnibague_Organizations',p_organization_id,array['status']);
end;
$$;
revoke all on function public.pyr_unibague_submit_organization(uuid) from public,anon;
grant execute on function public.pyr_unibague_submit_organization(uuid) to authenticated;

-- Approval is required before publishing calls. Drafts/submission remain possible;
-- P5/P6 separately exclude unverified organizations from matching and assignments.
create function pyr_unibague_private.p11_offer_gate() returns trigger
language plpgsql security invoker set search_path='' as $$
declare organization public."PYRUnibague_Organizations";
begin
 if new.status='open' then
  select * into organization from public."PYRUnibague_Organizations" where id=new.organization_id for share;
  if organization.status is distinct from 'approved' or organization.verified_at is null then
   raise exception 'Verified organization required before offering positions' using errcode='42501';
  end if;
 end if;
 return new;
end;
$$;
create trigger p11_offer_gate before insert or update on public."PYRUnibague_Calls" for each row execute function pyr_unibague_private.p11_offer_gate();
commit;
