-- Preflight (run before this migration if you want to inspect invalid rows):
-- select id, weight, neuter
-- from public.pets
-- where (weight is not null and (weight <= 0 or weight > 300))
--    or (neuter is not null and neuter not in ('yes', 'no', 'unknown'));

-- Refuse to add constraints over invalid data. This intentionally leaves data
-- unchanged so it can be reviewed and corrected explicitly before retrying.
do $$
declare
  invalid_weight_count bigint;
  invalid_neuter_count bigint;
begin
  select count(*) into invalid_weight_count
  from public.pets
  where weight is not null and (weight <= 0 or weight > 300);

  select count(*) into invalid_neuter_count
  from public.pets
  where neuter is not null and neuter not in ('yes', 'no', 'unknown');

  if invalid_weight_count > 0 or invalid_neuter_count > 0 then
    raise exception
      'Cannot add pet profile constraints: % invalid weight row(s), % invalid neuter row(s). Correct them and retry.',
      invalid_weight_count,
      invalid_neuter_count;
  end if;
end
$$;

-- PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS, so guard each
-- named constraint through the system catalog to keep retries idempotent.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pets'::regclass
      and conname = 'pets_weight_reasonable_check'
  ) then
    alter table public.pets
      add constraint pets_weight_reasonable_check
      check (weight is null or (weight > 0 and weight <= 300))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pets'::regclass
      and conname = 'pets_neuter_status_check'
  ) then
    alter table public.pets
      add constraint pets_neuter_status_check
      check (neuter is null or neuter in ('yes', 'no', 'unknown'))
      not valid;
  end if;
end
$$;

alter table public.pets validate constraint pets_weight_reasonable_check;
alter table public.pets validate constraint pets_neuter_status_check;
