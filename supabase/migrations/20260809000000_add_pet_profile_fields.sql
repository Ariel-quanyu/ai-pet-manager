-- Persist the optional fields already collected by the pet profile UI.
alter table public.pets
  add column if not exists weight numeric(6,2) check (weight is null or weight > 0),
  add column if not exists coat text,
  add column if not exists neuter text check (neuter is null or neuter in ('yes','no','unknown'));

-- Keep the Data API permissions explicit. Existing ownership RLS policies remain unchanged.
grant select, insert, update on public.pets to authenticated;
