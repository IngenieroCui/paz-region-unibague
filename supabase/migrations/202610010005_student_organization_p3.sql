-- P3 only. P2 migrations remain immutable.
begin;

create function public.pyr_unibague_register_organization(
 p_legal_name text, p_display_name text default null, p_tax_id text default null,
 p_description text default null, p_website text default null,
 p_organization_type_id uuid default null, p_municipality_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); organization_id uuid;
begin
 if actor is null or not public.pyr_unibague_has_role('ORGANIZATION') then
  raise exception 'Organization role required' using errcode = '42501';
 end if;
 if p_legal_name is null or btrim(p_legal_name) = '' or length(p_legal_name) > 240
 or length(p_display_name) > 240 or length(p_tax_id) > 80 or length(p_description) > 5000
 or length(p_website) > 2048 or (nullif(btrim(p_website), '') is not null and
 (p_website !~ '^https?://[^/[:space:]@]+([/?#][^[:space:]]*)?$')) then
  raise exception 'Invalid organization input' using errcode = '22023';
 end if;
 if p_organization_type_id is not null and not exists (select 1 from public."PYRUnibague_OrganizationTypes" where id = p_organization_type_id and active) then
  raise exception 'Invalid organization type' using errcode = '22023';
 end if;
 if p_municipality_id is not null and not exists (select 1 from public."PYRUnibague_Municipalities" where id = p_municipality_id and active) then
  raise exception 'Invalid municipality' using errcode = '22023';
 end if;
 -- Serialize retries for this actor; no global one-organization-per-user constraint.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text, 3));
 select o.id into organization_id from public."PYRUnibague_Organizations" o
 join public."PYRUnibague_OrganizationMembers" m on m.organization_id = o.id
 where m.user_id = actor and m.status = 'active' and m.can_manage
 and (lower(btrim(o.legal_name)) = lower(btrim(p_legal_name))
 or (nullif(btrim(p_tax_id), '') is not null and o.tax_id = btrim(p_tax_id)))
 order by o.created_at, o.id limit 1;
 if organization_id is not null then return organization_id; end if;
 insert into public."PYRUnibague_Organizations"
 (legal_name, display_name, tax_id, description, website, organization_type_id, municipality_id, status, created_by)
 values (btrim(p_legal_name), nullif(btrim(p_display_name), ''), nullif(btrim(p_tax_id), ''),
 nullif(btrim(p_description), ''), nullif(btrim(p_website), ''), p_organization_type_id,
 p_municipality_id, 'pending_review', actor) returning id into organization_id;
 insert into public."PYRUnibague_OrganizationMembers"
 (organization_id, user_id, membership_role, can_manage, is_primary_contact, status)
 values (organization_id, actor, 'owner', true, true, 'active');
 return organization_id;
end;
$$;
revoke all on function public.pyr_unibague_register_organization(text,text,text,text,text,uuid,uuid) from public, anon;
grant execute on function public.pyr_unibague_register_organization(text,text,text,text,text,uuid,uuid) to authenticated;

create policy member_read_p3 on public."PYRUnibague_OrganizationReviews" for select to authenticated
using (public.pyr_unibague_is_org_member(organization_id));

create function public.pyr_unibague_set_student_preferences(p_student_id uuid, p_municipality_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare offset_value integer;
begin
 if not public.pyr_unibague_is_student_owner(p_student_id) then
  raise exception 'Student owner required' using errcode = '42501';
 end if;
 perform 1 from public."PYRUnibague_Students" where id = p_student_id for update;
 if p_municipality_ids is null or cardinality(p_municipality_ids) > 100
 or exists (select 1 from unnest(p_municipality_ids) v where v is null)
 or cardinality(p_municipality_ids) <> (select count(distinct v) from unnest(p_municipality_ids) v)
 or exists (select 1 from unnest(p_municipality_ids) v where not exists
 (select 1 from public."PYRUnibague_Municipalities" m where m.id = v and (m.active or exists
 (select 1 from public."PYRUnibague_StudentLocationPreferences" p where p.student_id = p_student_id and p.municipality_id = v)))) then
  raise exception 'Invalid ordered municipalities' using errcode = '22023';
 end if;
 select coalesce(max(preference_order), 0) + cardinality(p_municipality_ids) + 1 into offset_value
 from public."PYRUnibague_StudentLocationPreferences" where student_id = p_student_id;
 -- Positive temporary range avoids P2's immediate unique constraint during swaps.
 update public."PYRUnibague_StudentLocationPreferences" set preference_order = preference_order + offset_value where student_id = p_student_id;
 delete from public."PYRUnibague_StudentLocationPreferences" where student_id = p_student_id and not (municipality_id = any(p_municipality_ids));
 insert into public."PYRUnibague_StudentLocationPreferences" (student_id, municipality_id, preference_order)
 select p_student_id, v, ordinal::integer from unnest(p_municipality_ids) with ordinality as requested(v, ordinal)
 on conflict (student_id, municipality_id) do update set preference_order = excluded.preference_order;
end;
$$;
revoke all on function public.pyr_unibague_set_student_preferences(uuid,uuid[]) from public, anon;
grant execute on function public.pyr_unibague_set_student_preferences(uuid,uuid[]) to authenticated;

create function public.pyr_unibague_order_student_interests(p_student_id uuid, p_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
 if not public.pyr_unibague_is_student_owner(p_student_id) then
  raise exception 'Student owner required' using errcode = '42501';
 end if;
 perform 1 from public."PYRUnibague_Students" where id = p_student_id for update;
 if p_ids is null or exists (select 1 from unnest(p_ids) v where v is null)
 or cardinality(p_ids) <> (select count(distinct v) from unnest(p_ids) v)
 or cardinality(p_ids) <> (select count(*) from public."PYRUnibague_StudentInterests" where student_id = p_student_id)
 or exists (select 1 from unnest(p_ids) v where not exists (select 1 from public."PYRUnibague_StudentInterests" where id = v and student_id = p_student_id)) then
  raise exception 'Invalid ordered interests' using errcode = '22023';
 end if;
 update public."PYRUnibague_StudentInterests" i set sort_order = requested.ordinal::integer
 from unnest(p_ids) with ordinality requested(id, ordinal)
 where i.id = requested.id and i.student_id = p_student_id;
end;
$$;
revoke all on function public.pyr_unibague_order_student_interests(uuid,uuid[]) from public, anon;
grant execute on function public.pyr_unibague_order_student_interests(uuid,uuid[]) to authenticated;

-- Technical upload limits, not institutional document requirements.
update storage.buckets set file_size_limit = 10485760,
 allowed_mime_types = array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg']
where id in ('pyrunibague-student-documents','pyrunibague-organization-documents');
commit;
