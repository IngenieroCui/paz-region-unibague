-- Additive conflict-of-interest protection. Does not enable signup or change RLS.
begin;
create function pyr_unibague_private.p11_independent_review() returns trigger
language plpgsql security invoker set search_path='' as $$
declare target_org_id uuid;
begin
 -- Existing policies/guards already deny non-ADMIN reviews and verification.
 if auth.uid() is null or not public.pyr_unibague_has_role('ADMIN') then return new; end if;
 if TG_TABLE_NAME='PYRUnibague_Organizations' then
  if new.status is not distinct from old.status and new.verified_at is not distinct from old.verified_at
   and new.verified_by is not distinct from old.verified_by then return new; end if;
  target_org_id:=new.id;
 else target_org_id:=new.organization_id;
 end if;
 if exists(select 1 from public."PYRUnibague_Organizations" o where o.id=target_org_id and o.created_by=auth.uid())
 or exists(select 1 from public."PYRUnibague_OrganizationMembers" m where m.organization_id=target_org_id and m.user_id=auth.uid()) then
  -- Applicant submission remains permitted; administrative decisions do not.
  if TG_TABLE_NAME='PYRUnibague_Organizations' then
   if new.status='submitted' and new.verified_at is null and new.verified_by is null then return new; end if;
  end if;
  raise exception 'Independent administrative reviewer required' using errcode='42501';
 end if;
 return new;
end;
$$;
revoke all on function pyr_unibague_private.p11_independent_review() from public,anon,authenticated;
create trigger p11_independent_review before insert on public."PYRUnibague_OrganizationReviews"
for each row execute function pyr_unibague_private.p11_independent_review();
create trigger p11_independent_approval before update of status,verified_at,verified_by on public."PYRUnibague_Organizations"
for each row execute function pyr_unibague_private.p11_independent_review();
commit;
