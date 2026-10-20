-- Corrective migration: do not alter P11 history when remote history is unavailable.
-- Apply only AFTER 20261016154045 and 20261020122421, through an authorized SQL channel.
begin;
do $$
begin
 if exists(select 1 from public."PYRUnibague_Organizations" group by lower(btrim(legal_name)) having count(*)>1)
 or exists(select 1 from public."PYRUnibague_Organizations"
   where nullif(regexp_replace(lower(btrim(tax_id)),'[[:space:].-]','','g'),'') is not null
   group by regexp_replace(lower(btrim(tax_id)),'[[:space:].-]','','g') having count(*)>1) then
  raise exception 'Normalized organization duplicates require institutional reconciliation before P11.1' using errcode='23505';
 end if;
end $$;

create or replace function pyr_unibague_private.p11_organization_identity() returns trigger
language plpgsql security definer set search_path='' as $$
declare normalized text:=nullif(regexp_replace(lower(btrim(new.tax_id)),'[[:space:].-]','','g'),'');
begin
 if TG_OP='INSERT' and auth.uid() is not null and not public.pyr_unibague_has_role('ADMIN') and
  (select count(*) from public."PYRUnibague_Organizations" where created_by=auth.uid() and created_at>now()-interval '1 hour')>=3 then
  raise exception 'Organization registration rate limit' using errcode='54000';
 end if;
 -- Both INSERT and UPDATE protect legal_name. Lock ordering is consistent.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(btrim(new.legal_name)),110));
 if exists(select 1 from public."PYRUnibague_Organizations" where lower(btrim(legal_name))=lower(btrim(new.legal_name)) and id<>new.id) then
  raise exception 'Organization request cannot be registered; contact coordination' using errcode='23505';
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
drop trigger p11_organization_identity on public."PYRUnibague_Organizations";
create trigger p11_organization_identity before insert or update of legal_name,tax_id on public."PYRUnibague_Organizations"
for each row execute function pyr_unibague_private.p11_organization_identity();
-- Replace the existing lookup indexes: unique enforcement also covers concurrent
-- transactions with old snapshots. Empty tax identifiers remain permitted.
drop index public.p11_organization_legal_trimmed;
create unique index p11_organization_legal_trimmed on public."PYRUnibague_Organizations" ((lower(btrim(legal_name))));
drop index public.p11_organization_tax_normalized;
create unique index p11_organization_tax_normalized on public."PYRUnibague_Organizations" ((regexp_replace(lower(btrim(tax_id)),'[[:space:].-]','','g')))
where nullif(regexp_replace(lower(btrim(tax_id)),'[[:space:].-]','','g'),'') is not null;
commit;
