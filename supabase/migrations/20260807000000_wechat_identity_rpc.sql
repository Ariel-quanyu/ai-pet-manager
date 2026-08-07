-- Service-role-only bridge for the private identity table. The existing table is
-- intentionally not exposed through PostgREST and is not recreated here.
create or replace function public.claim_wechat_identity(
  p_app_id text,
  p_openid text,
  p_unionid text,
  p_candidate_user_id uuid
) returns table(user_id uuid, inserted boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid;
begin
  select wi.user_id into v_user_id
  from private.wechat_identities wi
  where wi.app_id = p_app_id and wi.openid = p_openid;

  if v_user_id is not null then
    return query select v_user_id, false;
    return;
  end if;

  begin
    insert into private.wechat_identities(app_id, openid, unionid, user_id)
    values (p_app_id, p_openid, nullif(p_unionid, ''), p_candidate_user_id);
    return query select p_candidate_user_id, true;
  exception when unique_violation then
    select wi.user_id into v_user_id
    from private.wechat_identities wi
    where (wi.app_id = p_app_id and wi.openid = p_openid)
       or (p_unionid is not null and wi.unionid = p_unionid)
    limit 1;
    if v_user_id is null then raise; end if;
    return query select v_user_id, false;
  end;
end;
$$;

revoke all on function public.claim_wechat_identity(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_wechat_identity(text, text, text, uuid) to service_role;
