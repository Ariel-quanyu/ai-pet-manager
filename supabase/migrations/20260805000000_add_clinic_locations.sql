alter table public.clinics
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists image_url text;

alter table public.clinics drop constraint if exists clinics_latitude_range;
alter table public.clinics add constraint clinics_latitude_range
  check (latitude is null or latitude between -90 and 90);

alter table public.clinics drop constraint if exists clinics_longitude_range;
alter table public.clinics add constraint clinics_longitude_range
  check (longitude is null or longitude between -180 and 180);

alter table public.clinics drop constraint if exists clinics_coordinates_complete;
alter table public.clinics add constraint clinics_coordinates_complete
  check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null));

create index if not exists clinics_active_city_idx
  on public.clinics (city, name)
  where is_active;

comment on column public.clinics.city is '门店所在城市，例如：苏州市';
comment on column public.clinics.district is '门店所在区县，例如：工业园区';
comment on column public.clinics.latitude is '门店 GCJ-02 纬度，用于小程序距离排序';
comment on column public.clinics.longitude is '门店 GCJ-02 经度，用于小程序距离排序';
comment on column public.clinics.image_url is '门店列表图片的 HTTPS URL';
