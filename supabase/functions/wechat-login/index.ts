import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { resolveOrCreateWechatAccount } from './account.ts'
import {
  ERROR_CODES,
  parseLoginCode,
  requireWechatLoginSuccess,
  SafeError,
  safeJson,
  type WechatLoginResult,
} from './core.ts'

const APP_ID = Deno.env.get('WECHAT_APP_ID') || ''
const APP_SECRET = Deno.env.get('WECHAT_APP_SECRET') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const MAX_BODY_BYTES = 2048
const timeoutMs = 8_000

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error('UPSTREAM_HTTP_ERROR')
    return await response.json() as T
  } finally { clearTimeout(timer) }
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID()
  let stage = 'request'
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey' } })
  if (request.method !== 'POST') return safeJson(ERROR_CODES.invalid, 405)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return safeJson(ERROR_CODES.invalid, 415)
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return safeJson(ERROR_CODES.invalid, 413)

  try {
    if (!APP_ID || !APP_SECRET || !SUPABASE_URL || !SERVICE_KEY) throw new SafeError(ERROR_CODES.internal, 500)
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new SafeError(ERROR_CODES.invalid, 413)
    let raw: unknown
    try { raw = JSON.parse(text) } catch { throw new SafeError(ERROR_CODES.invalid) }
    const { loginCode } = parseLoginCode(raw)

    stage = 'code2session'
    const loginQuery = new URLSearchParams({ appid: APP_ID, secret: APP_SECRET, js_code: loginCode, grant_type: 'authorization_code' })
    const wxLogin = requireWechatLoginSuccess(
      await jsonFetch<WechatLoginResult>(`https://api.weixin.qq.com/sns/jscode2session?${loginQuery}`),
    )

    stage = 'account'
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const account = await resolveOrCreateWechatAccount<{ id: string; email?: string }>({
      resolveIdentity: async () => {
        const result = await admin.rpc('resolve_wechat_identity', {
          p_app_id: APP_ID,
          p_openid: wxLogin.openid,
          p_unionid: wxLogin.unionid || null,
        }).maybeSingle()
        if (result.error) throw new SafeError(ERROR_CODES.internal, 500)
        return (result.data?.user_id as string | undefined) || null
      },
      createCandidate: async () => {
        const result = await admin.auth.admin.createUser({
          email: `${crypto.randomUUID()}@wechat.invalid`,
          email_confirm: true,
        })
        return { user: result.data.user, errorMessage: result.error?.message }
      },
      claimIdentity: async (candidateUserId) => {
        const result = await admin.rpc('claim_wechat_identity', {
          p_app_id: APP_ID,
          p_openid: wxLogin.openid,
          p_unionid: wxLogin.unionid || null,
          p_candidate_user_id: candidateUserId,
        }).single()
        if (result.error || !result.data?.user_id) throw new SafeError(ERROR_CODES.internal, 500)
        return {
          userId: result.data.user_id as string,
          inserted: Boolean(result.data.inserted),
        }
      },
      deleteCandidate: async (userId) => {
        const result = await admin.auth.admin.deleteUser(userId)
        if (result.error) throw new SafeError(ERROR_CODES.internal, 500)
      },
      getExisting: async (userId) => {
        const result = await admin.auth.admin.getUserById(userId)
        return { user: result.data.user, errorMessage: result.error?.message }
      },
    })

    stage = 'session'
    const email = account.user.email
    if (!email) throw new SafeError(ERROR_CODES.session, 500)
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const tokenHash = link.data.properties?.hashed_token
    if (link.error || !tokenHash) throw new SafeError(ERROR_CODES.session, 500)
    const authClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const verified = await authClient.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
    if (verified.error || !verified.data.session) throw new SafeError(ERROR_CODES.session, 500)
    return Response.json(verified.data.session, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    // Deliberately log only a stable category; sensitive inputs and upstream bodies are never logged.
    console.error('wechat-login request failed', JSON.stringify({ requestId, stage, code: error instanceof SafeError ? error.code : ERROR_CODES.internal }))
    return error instanceof SafeError ? safeJson(error.code, error.status) : safeJson(ERROR_CODES.internal, 500)
  }
})
