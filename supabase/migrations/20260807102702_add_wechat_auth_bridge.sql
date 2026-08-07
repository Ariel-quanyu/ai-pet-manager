begin;

alter table public.pets
  add column if not exists weight_kg numeric(6, 2),
  add column if not exists coat text,
  add column if not exists neutered boolean;

create or replace function public.find_wechat_identity(
  p_app_id text,
  p_openid text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select identity.user_id
  from private.wechat_identities as identity
  where identity.app_id = p_app_id
    and identity.openid = p_openid
  limit 1;
$$;

create or replace function public.bind_wechat_identity(
  p_app_id text,
  p_openid text,
  p_unionid text,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_user_id uuid;
begin
  if p_app_id is null or p_app_id = '' or p_openid is null or p_openid = '' then
    raise exception 'app_id and openid are required';
  end if;

  insert into private.wechat_identities (app_id, openid, unionid, user_id)
  values (p_app_id, p_openid, nullif(p_unionid, ''), p_user_id)
  on conflict (app_id, openid) do update
    set unionid = coalesce(private.wechat_identities.unionid, excluded.unionid),
        updated_at = now()
  returning user_id into resolved_user_id;

  return resolved_user_id;
end;
$$;

revoke all on function public.find_wechat_identity(text, text) from public, anon, authenticated;
revoke all on function public.bind_wechat_identity(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.find_wechat_identity(text, text) to service_role;
grant execute on function public.bind_wechat_identity(text, text, text, uuid) to service_role;

commit;

