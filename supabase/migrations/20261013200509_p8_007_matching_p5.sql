-- P5 additive guards. No seeds, assignments, new columns, grants or RLS changes.
begin;
create unique index "pyr_matching_one_running_configuration"
  on public."PYRUnibague_MatchingRuns" (academic_period_id, matching_configuration_id)
  where status = 'running';
create index "pyr_matching_candidates_ranking"
  on public."PYRUnibague_MatchCandidates" (matching_run_id, total_score desc nulls last, id);
-- Enforce future candidate writes without rewriting any pre-P5 historical rows.
alter table public."PYRUnibague_MatchCandidates" add constraint "pyr_matching_eligibility_total"
  check (is_eligible = (total_score is not null)) not valid;

create function pyr_unibague_private.matching_configuration_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare key text; weight numeric; total numeric := 0;
begin
  if TG_OP = 'UPDATE' then
    if (NEW.algorithm_version, NEW.minimum_recommended_score, NEW.weights, NEW.rules, NEW.academic_period_id)
       is distinct from (OLD.algorithm_version, OLD.minimum_recommended_score, OLD.weights, OLD.rules, OLD.academic_period_id)
       and exists (select 1 from public."PYRUnibague_MatchingRuns" where matching_configuration_id = OLD.id) then
      raise exception 'Used matching configuration is immutable; duplicate it' using errcode = '23514';
    end if;
    -- Legacy placeholders retain metadata management without being made executable.
    if (NEW.algorithm_version, NEW.minimum_recommended_score, NEW.weights, NEW.rules, NEW.academic_period_id)
       is not distinct from (OLD.algorithm_version, OLD.minimum_recommended_score, OLD.weights, OLD.rules, OLD.academic_period_id) then return NEW; end if;
  end if;
  if NEW.algorithm_version <> 'hybrid-v0.1' or NEW.minimum_recommended_score is null
     or NEW.minimum_recommended_score not between 0 and 100 then
    raise exception 'Invalid matching configuration' using errcode = '22023';
  end if;
  if jsonb_typeof(NEW.weights) <> 'object' or (select count(*) from jsonb_object_keys(NEW.weights)) <> 7 then
    raise exception 'Invalid matching weights' using errcode = '22023';
  end if;
  foreach key in array array['academic','skills','experience','interests','location','preference','semantic'] loop
    if jsonb_typeof(NEW.weights->key) is distinct from 'number' then
      raise exception 'Invalid matching weights' using errcode = '22023';
    end if;
    weight := (NEW.weights->>key)::numeric;
    if weight < 0 or weight > 100 or weight <> round(weight, 4) then
      raise exception 'Invalid matching weights' using errcode = '22023';
    end if;
    total := total + weight;
  end loop;
  if total <> 100 then raise exception 'Matching weights must sum to 100' using errcode = '22023'; end if;
  if jsonb_typeof(NEW.rules) <> 'object' or (select count(*) from jsonb_object_keys(NEW.rules)) <> 2
     or jsonb_typeof(NEW.rules->'requiredSkillsAreHardConstraint') is distinct from 'boolean'
     or jsonb_typeof(NEW.rules->'semanticEnabled') is distinct from 'boolean' then
    raise exception 'Invalid matching rules' using errcode = '22023';
  end if;
  return NEW;
end $$;
revoke all on function pyr_unibague_private.matching_configuration_guard() from public, anon, authenticated;
create trigger "pyr_matching_configuration_guard" before insert or update on public."PYRUnibague_MatchingConfigurations"
for each row execute function pyr_unibague_private.matching_configuration_guard();

create function pyr_unibague_private.matching_run_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare config public."PYRUnibague_MatchingConfigurations"%rowtype;
begin
  if TG_OP = 'DELETE' then
    raise exception 'Matching history cannot be deleted' using errcode = '23514';
  end if;
  if jsonb_typeof(NEW.summary) is distinct from 'object' then
    raise exception 'Invalid matching run summary' using errcode = '22023';
  end if;
  if TG_OP = 'UPDATE' then
    if (NEW.id, NEW.academic_period_id, NEW.matching_configuration_id, NEW.started_at, NEW.created_at,
        NEW.summary->'configuration_snapshot', NEW.summary->'algorithm_version')
       is distinct from (OLD.id, OLD.academic_period_id, OLD.matching_configuration_id, OLD.started_at, OLD.created_at,
        OLD.summary->'configuration_snapshot', OLD.summary->'algorithm_version') then
      raise exception 'Matching run snapshot is immutable' using errcode = '23514';
    end if;
    -- Allow auth FK SET NULL to anonymize a deleted actor without changing run meaning.
    if NEW.started_by is distinct from OLD.started_by and NEW.started_by is not null then
      raise exception 'Matching run actor is immutable' using errcode = '23514';
    end if;
    if OLD.status <> 'running' and (NEW.status, NEW.completed_at, NEW.summary)
       is distinct from (OLD.status, OLD.completed_at, OLD.summary) then
      raise exception 'Completed matching run is immutable' using errcode = '23514';
    end if;
    if NEW.status not in ('running','completed','failed') or (NEW.status <> 'running' and NEW.completed_at is null) then
      raise exception 'Invalid matching run state' using errcode = '23514';
    end if;
    return NEW;
  end if;
  if auth.uid() is null or not public.pyr_unibague_has_role('ADMIN') then
    raise exception 'ADMIN required' using errcode = '42501';
  end if;
  -- Serialize against configuration UPDATE. Used configs become immutable before lock release.
  select * into config from public."PYRUnibague_MatchingConfigurations"
    where id = NEW.matching_configuration_id for update;
  if not found or not config.is_active or config.algorithm_version <> 'hybrid-v0.1'
     or (config.academic_period_id is not null and config.academic_period_id <> NEW.academic_period_id)
     or NEW.status <> 'running' then
    raise exception 'Invalid matching run configuration' using errcode = '22023';
  end if;
  -- Revalidate legacy hybrid rows through the same validator by a no-meaning-change update
  -- is intentionally avoided; Edge validates before INSERT, SQL validates weights below.
  if config.minimum_recommended_score is null or config.minimum_recommended_score not between 0 and 100
     or (select count(*) from jsonb_object_keys(config.weights)) <> 7
     or not (config.weights ?& array['academic','skills','experience','interests','location','preference','semantic'])
     or exists (select 1 from jsonb_each(config.weights) where jsonb_typeof(value) <> 'number') then
    raise exception 'Invalid matching configuration' using errcode = '22023';
  end if;
  if (select sum(value::text::numeric) from jsonb_each(config.weights)) <> 100
     or exists (select 1 from jsonb_each(config.weights) where value::text::numeric < 0 or value::text::numeric <> round(value::text::numeric,4))
     or (select count(*) from jsonb_object_keys(config.rules)) <> 2
     or jsonb_typeof(config.rules->'requiredSkillsAreHardConstraint') is distinct from 'boolean'
     or jsonb_typeof(config.rules->'semanticEnabled') is distinct from 'boolean' then
    raise exception 'Invalid matching configuration' using errcode = '22023';
  end if;
  NEW.started_by := auth.uid(); NEW.started_at := coalesce(NEW.started_at, now()); NEW.completed_at := null;
  NEW.summary := NEW.summary || jsonb_build_object('algorithm_version', config.algorithm_version,
    'configuration_snapshot', jsonb_build_object('academic_period_id',config.academic_period_id,
      'algorithm_version',config.algorithm_version,'minimum_recommended_score',config.minimum_recommended_score,
      'weights',config.weights,'rules',config.rules));
  return NEW;
end $$;
revoke all on function pyr_unibague_private.matching_run_guard() from public, anon, authenticated;
create trigger "pyr_matching_run_guard" before insert or update or delete on public."PYRUnibague_MatchingRuns"
for each row execute function pyr_unibague_private.matching_run_guard();
commit;
