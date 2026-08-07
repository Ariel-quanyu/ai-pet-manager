# Supabase deployment

The `wechat-login` function exchanges one-time WeChat codes for a Supabase Auth session. No WeChat or Supabase secret belongs in the mini-program bundle or in GitHub.

## Required Edge Function secrets

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `WECHAT_IDENTITY_PEPPER` (a long random value; keep it stable)

Supabase provides `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, and `SUPABASE_SECRET_KEYS` to hosted Edge Functions. Legacy projects can use the built-in anon/service-role fallbacks in the function.

## Deploy

1. Link the CLI to the intended Supabase project.
2. Apply `supabase/migrations/20260807102702_add_wechat_auth_bridge.sql`.
3. Set the three WeChat secrets in **Edge Functions > Secrets**.
4. Deploy `wechat-login`. Its JWT verification must remain disabled because callers do not have a Supabase session yet; the function authenticates them by validating both one-time WeChat codes.
5. Add the Supabase URL to WeChat **request 合法域名**.

Do not deploy this function until `public.profiles`, `private.wechat_identities`, and the existing `pets` RLS policies are present.

