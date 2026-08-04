create schema if not exists private;

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_slots (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  capacity integer not null default 1 check (capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, weekday, start_time),
  check (end_time > start_time)
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_key text not null,
  name text not null,
  type text not null,
  sex text not null check (sex in ('male','female','unknown')),
  avatar_url text,
  birthday date,
  breed text,
  medical_record_no text not null unique default ('MR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_key)
);

create table if not exists public.clinic_appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id),
  pet_id uuid not null references public.pets(id),
  slot_id uuid not null references public.clinic_slots(id),
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'booked' check (status in ('booked','confirmed','completed','cancelled')),
  symptoms text not null check (char_length(symptoms) between 1 and 20),
  onset_date date not null,
  mental_appetite text not null,
  bowel_urine text not null,
  notes text,
  appointment_no text not null unique default ('PA-' || to_char(current_date,'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clinic_appointments_no_duplicate_active
  on public.clinic_appointments(user_id,pet_id,appointment_date,start_time)
  where status in ('booked','confirmed');
create index if not exists clinic_appointments_capacity_lookup
  on public.clinic_appointments(slot_id,appointment_date,status);

alter table public.clinics enable row level security;
alter table public.clinic_slots enable row level security;
alter table public.pets enable row level security;
alter table public.clinic_appointments enable row level security;

create policy "authenticated users can view active clinics" on public.clinics for select to authenticated using (is_active);
create policy "authenticated users can view active clinic slots" on public.clinic_slots for select to authenticated using (is_active);
create policy "users can view own pets" on public.pets for select to authenticated using ((select auth.uid())=user_id);
create policy "users can insert own pets" on public.pets for insert to authenticated with check ((select auth.uid())=user_id);
create policy "users can update own pets" on public.pets for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "users can view own appointments" on public.clinic_appointments for select to authenticated using ((select auth.uid())=user_id);

grant usage on schema public to authenticated;
grant select on public.clinics,public.clinic_slots,public.clinic_appointments to authenticated;
grant select,insert,update on public.pets to authenticated;

create or replace function private.get_available_clinic_slots(p_clinic_id uuid,p_date date)
returns table(id uuid,start_time time,end_time time,capacity integer,booked bigint,available boolean)
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_date < current_date then raise exception '不能预约过去的日期' using errcode='22023'; end if;
  return query
    select s.id,s.start_time,s.end_time,s.capacity,count(a.id),count(a.id)<s.capacity
    from public.clinic_slots s
    left join public.clinic_appointments a on a.slot_id=s.id and a.appointment_date=p_date and a.status in ('booked','confirmed')
    where s.clinic_id=p_clinic_id and s.is_active and s.weekday=extract(dow from p_date)::smallint
    group by s.id,s.start_time,s.end_time,s.capacity
    order by s.start_time;
end;
$$;

create or replace function public.get_available_clinic_slots(p_clinic_id uuid,p_date date)
returns table(id uuid,start_time time,end_time time,capacity integer,booked bigint,available boolean)
language sql security invoker set search_path=''
as $$ select * from private.get_available_clinic_slots(p_clinic_id,p_date); $$;

create or replace function private.book_clinic_appointment(
  p_clinic_id uuid,p_pet_id uuid,p_slot_id uuid,p_appointment_date date,p_symptoms text,p_onset_date date,
  p_mental_appetite text,p_bowel_urine text,p_notes text default null
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid();v_slot public.clinic_slots%rowtype;v_booked bigint;v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_appointment_date<current_date then raise exception '不能预约过去的日期' using errcode='22023'; end if;
  if not exists(select 1 from public.pets where id=p_pet_id and user_id=v_user_id) then raise exception '无权使用该宠物档案' using errcode='42501'; end if;
  select * into v_slot from public.clinic_slots where id=p_slot_id and clinic_id=p_clinic_id and is_active for update;
  if not found or v_slot.weekday<>extract(dow from p_appointment_date)::smallint then raise exception '预约时段无效' using errcode='22023'; end if;
  select count(*) into v_booked from public.clinic_appointments where slot_id=p_slot_id and appointment_date=p_appointment_date and status in ('booked','confirmed');
  if v_booked>=v_slot.capacity then raise exception '该时段已约满' using errcode='P0001'; end if;
  insert into public.clinic_appointments(user_id,clinic_id,pet_id,slot_id,appointment_date,start_time,end_time,symptoms,onset_date,mental_appetite,bowel_urine,notes)
  values(v_user_id,p_clinic_id,p_pet_id,p_slot_id,p_appointment_date,v_slot.start_time,v_slot.end_time,trim(p_symptoms),p_onset_date,p_mental_appetite,p_bowel_urine,nullif(trim(p_notes),'')) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.book_clinic_appointment(
  p_clinic_id uuid,p_pet_id uuid,p_slot_id uuid,p_appointment_date date,p_symptoms text,p_onset_date date,
  p_mental_appetite text,p_bowel_urine text,p_notes text default null
) returns uuid
language sql security invoker set search_path=''
as $$ select private.book_clinic_appointment(p_clinic_id,p_pet_id,p_slot_id,p_appointment_date,p_symptoms,p_onset_date,p_mental_appetite,p_bowel_urine,p_notes); $$;

revoke all on function private.get_available_clinic_slots(uuid,date) from public,anon;
revoke all on function private.book_clinic_appointment(uuid,uuid,uuid,date,text,date,text,text,text) from public,anon;
revoke all on function public.get_available_clinic_slots(uuid,date) from public,anon;
revoke all on function public.book_clinic_appointment(uuid,uuid,uuid,date,text,date,text,text,text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.get_available_clinic_slots(uuid,date) to authenticated;
grant execute on function private.book_clinic_appointment(uuid,uuid,uuid,date,text,date,text,text,text) to authenticated;
grant execute on function public.get_available_clinic_slots(uuid,date) to authenticated;
grant execute on function public.book_clinic_appointment(uuid,uuid,uuid,date,text,date,text,text,text) to authenticated;
