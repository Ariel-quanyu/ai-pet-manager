import { createClient, type Session } from 'npm:@supabase/supabase-js@2.56.1'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*'
}

interface LoginRequest {
  loginCode?: string
  phoneCode?: string
}

interface WeChatSessionResponse {
  openid?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

interface WeChatAccessTokenResponse {
  access_token?: string
  errcode?: number
  errmsg?: string
}

interface WeChatPhoneResponse {
  errcode?: number
  errmsg?: string
  phone_info?: { phoneNumber?: string }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing server secret: ${name}`)
  return value
}

function namedKey(jsonName: string, legacyName: string): string {
  const raw = Deno.env.get(jsonName)
  if (raw) {
    const keys = JSON.parse(raw) as Record<string, string>
    if (keys.default) return keys.default
  }
  return requiredEnv(legacyName)
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function exchangeLoginCode(appId: string, appSecret: string, code: string) {
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.search = new URLSearchParams({ appid: appId, secret: appSecret, js_code: code, grant_type: 'authorization_code' }).toString()
  const response = await fetch(url)
  const data = await response.json() as WeChatSessionResponse
  if (!response.ok || data.errcode || !data.openid) throw new Error(data.errmsg || 'WeChat login code verification failed')
  return data
}

async function verifyPhoneCode(appId: string, appSecret: string, phoneCode: string): Promise<void> {
  const tokenUrl = new URL('https://api.weixin.qq.com/cgi-bin/token')
  tokenUrl.search = new URLSearchParams({ grant_type: 'client_credential', appid: appId, secret: appSecret }).toString()
  const tokenResponse = await fetch(tokenUrl)
  const token = await tokenResponse.json() as WeChatAccessTokenResponse
  if (!tokenResponse.ok || token.errcode || !token.access_token) throw new Error(token.errmsg || 'WeChat access token request failed')

  const phoneResponse = await fetch(`https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(token.access_token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: phoneCode })
  })
  const phone = await phoneResponse.json() as WeChatPhoneResponse
  if (!phoneResponse.ok || phone.errcode || !phone.phone_info?.phoneNumber) throw new Error(phone.errmsg || 'WeChat phone code verification failed')
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ message: 'Method not allowed' }, 405)

  try {
    const body = await request.json() as LoginRequest
    if (!body.loginCode || !body.phoneCode) return json({ message: '微信登录凭证不完整，请重试' }, 400)

    const appId = requiredEnv('WECHAT_APP_ID')
    const appSecret = requiredEnv('WECHAT_APP_SECRET')
    const identityPepper = requiredEnv('WECHAT_IDENTITY_PEPPER')
    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const secretKey = namedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
    const publishableKey = namedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
    const admin = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const publicClient = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const wechat = await exchangeLoginCode(appId, appSecret, body.loginCode)
    await verifyPhoneCode(appId, appSecret, body.phoneCode)

    const { data: existingId, error: findError } = await admin.rpc('find_wechat_identity', {
      p_app_id: appId,
      p_openid: wechat.openid
    })
    if (findError) throw findError

    let userId = existingId as string | null
    let email: string | undefined
    let candidateUserId: string | null = null

    if (userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      if (error) throw error
      email = data.user.email
    } else {
      const identityHash = await sha256(`${identityPepper}:${appId}:${wechat.openid}`)
      email = `wechat-${identityHash}@users.invalid`
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { provider: 'wechat', wechat_app_id: appId }
      })
      if (error) throw error
      candidateUserId = data.user.id

      const { data: boundId, error: bindError } = await admin.rpc('bind_wechat_identity', {
        p_app_id: appId,
        p_openid: wechat.openid,
        p_unionid: wechat.unionid || '',
        p_user_id: candidateUserId
      })
      if (bindError) throw bindError
      userId = boundId as string

      if (userId !== candidateUserId) {
        await admin.auth.admin.deleteUser(candidateUserId)
        const { data, error: existingError } = await admin.auth.admin.getUserById(userId)
        if (existingError) throw existingError
        email = data.user.email
      }
    }

    if (!userId || !email) throw new Error('Unable to resolve Supabase user')

    const { error: profileError } = await admin.from('profiles').update({ phone_verified: true }).eq('id', userId)
    if (profileError) throw profileError

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (linkError) throw linkError
    const tokenHash = link.properties?.hashed_token
    if (!tokenHash) throw new Error('Unable to issue Supabase login token')

    const { data: verified, error: verifyError } = await publicClient.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
    if (verifyError) throw verifyError
    const session = verified.session as Session | null
    if (!session) throw new Error('Supabase session was not created')

    return json(session)
  } catch (error) {
    console.error('wechat-login failed', error instanceof Error ? error.message : 'unknown error')
    return json({ message: '微信登录失败，请稍后重试' }, 500)
  }
})

