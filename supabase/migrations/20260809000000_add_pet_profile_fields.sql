-- PetDraft stores the input weight as a string because it comes from a Taro
-- digit input; the REST mapping converts it to a number before persistence.
-- NeuterStatus is 'yes' | 'no' | 'unknown', not a boolean.
alter table public.pets
  add column if not exists weight numeric(6,2) check (weight is null or weight > 0),
  add column if not exists coat text,
  add column if not exists neuter text check (neuter is null or neuter in ('yes','no','unknown'));

-- RLS was enabled by 20260804000000_clinic_appointments.sql. Re-enabling is
-- idempotent and makes it explicit that this migration must never expose pets.
alter table public.pets enable row level security;

-- Preserve the existing ownership policies. These guards only create a policy
-- when the corresponding policy from the base pets migration is absent.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pets' and policyname = 'users can view own pets'
  ) then
    create policy "users can view own pets" on public.pets
      for select to authenticated using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pets' and policyname = 'users can insert own pets'
  ) then
    create policy "users can insert own pets" on public.pets
      for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pets' and policyname = 'users can update own pets'
  ) then
    create policy "users can update own pets" on public.pets
      for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end
$$;

-- public is already exposed by the project's Supabase Data API configuration;
-- keep the authenticated table privileges explicit for all repository actions.
grant select, insert, update on public.pets to authenticated;
