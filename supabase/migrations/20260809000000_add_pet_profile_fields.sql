-- Persist the optional fields already collected by the pet profile UI.
alter table public.pets
  add column if not exists weight numeric,
  add column if not exists coat text,
  add column if not exists neuter text;

-- Keep RLS enabled and preserve any policies that are already installed. The
-- conditional policy creation makes this migration safe both after the baseline
-- migration and against an older pets table that does not have these policies.
alter table public.pets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.pets'::regclass
      and polname = 'users can view own pets'
  ) then
    create policy "users can view own pets"
      on public.pets for select to authenticated
      using (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.pets'::regclass
      and polname = 'users can insert own pets'
  ) then
    create policy "users can insert own pets"
      on public.pets for insert to authenticated
      with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.pets'::regclass
      and polname = 'users can update own pets'
  ) then
    create policy "users can update own pets"
      on public.pets for update to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end
$$;

-- Data API table privileges and RLS policies are both required. This grant does
-- not bypass the ownership checks above.
grant select, insert, update on public.pets to authenticated;
