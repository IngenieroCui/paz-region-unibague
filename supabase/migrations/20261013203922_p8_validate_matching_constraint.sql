-- P5 introduced this constraint as NOT VALID for legacy installations.
-- The real pilot rows now pass it; certify historical rows without rewriting them.
begin;
alter table public."PYRUnibague_MatchCandidates" validate constraint pyr_matching_eligibility_total;
commit;
