-- Resolve an existing WeChat identity before Auth creates a candidate user.
-- This prevents unique-phone conflicts from leaving a phone-less Auth user,
-- profile, or private identity row behind.
create or replace function public.resolve_wechat_identity(
  p_app_id text,
  p_openid text,
  p_unionid text
) returns table(user_id uuid)
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select wi.user_id
  from private.wechat_identities wi
  where (wi.app_id = p_app_id and wi.openid = p_openid)
     or (nullif(p_unionid, '') is not null and wi.unionid = nullif(p_unionid, ''))
  order by
    case when wi.app_id = p_app_id and wi.openid = p_openid then 0 else 1 end,
    wi.created_at
  limit 1;
$$;

revoke all on function public.resolve_wechat_identity(text, text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_wechat_identity(text, text, text)
  to service_role;
