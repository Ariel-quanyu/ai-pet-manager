import Taro from '@tarojs/taro'

const SESSION_KEY = 'ai-pet-manager:supabase-session'
const REQUEST_TIMEOUT_MS = 15_000
const REFRESH_WINDOW_SECONDS = 60

export interface SupabaseUser {
  id: string
}

export interface SupabaseSession {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
  token_type?: string
  user: SupabaseUser
}

interface AuthErrorBody {
  error?: string
  error_description?: string
  message?: string
}

export interface SupabasePublicConfig {
  url: string
  publishableKey: string
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = (process.env.TARO_APP_SUPABASE_URL || '').replace(/\/$/u, '')
  const publishableKey = process.env.TARO_APP_SUPABASE_PUBLISHABLE_KEY
    || process.env.TARO_APP_SUPABASE_ANON_KEY
    || ''

  if (!url || !publishableKey) {
    throw new Error('请先配置 Supabase URL 和 Publishable Key')
  }

  return { url, publishableKey }
}

function normalizeSession(session: SupabaseSession): SupabaseSession {
  if (session.expires_at || !session.expires_in) return session
  return { ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in }
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback
  const body = data as AuthErrorBody
  return body.message || body.error_description || body.error || fallback
}

export function getStoredSession(): SupabaseSession | null {
  try {
    const value = Taro.getStorageSync<SupabaseSession | string>(SESSION_KEY)
    if (!value) return null
    const parsed = typeof value === 'string' ? JSON.parse(value) as SupabaseSession : value
    return parsed.access_token && parsed.refresh_token && parsed.user?.id ? parsed : null
  } catch {
    return null
  }
}

export function storeSession(session: SupabaseSession): SupabaseSession {
  const normalized = normalizeSession(session)
  Taro.setStorageSync(SESSION_KEY, normalized)
  return normalized
}

export function clearStoredSession(): void {
  Taro.removeStorageSync(SESSION_KEY)
}

async function refreshSession(session: SupabaseSession): Promise<SupabaseSession> {
  const config = getSupabasePublicConfig()
  const response = await Taro.request<SupabaseSession & AuthErrorBody>({
    url: `${config.url}/auth/v1/token?grant_type=refresh_token`,
    method: 'POST',
    timeout: REQUEST_TIMEOUT_MS,
    header: {
      apikey: config.publishableKey,
      'Content-Type': 'application/json'
    },
    data: { refresh_token: session.refresh_token }
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(getErrorMessage(response.data, '登录状态已过期，请重新登录'))
  }

  return storeSession(response.data)
}

export async function getValidSession(): Promise<SupabaseSession | null> {
  const session = getStoredSession()
  if (!session) return null

  const now = Math.floor(Date.now() / 1000)
  if (!session.expires_at || session.expires_at - now > REFRESH_WINDOW_SECONDS) return session

  try {
    return await refreshSession(session)
  } catch {
    clearStoredSession()
    return null
  }
}

export async function loginWithWeChat(loginCode: string, phoneCode: string): Promise<SupabaseSession> {
  const config = getSupabasePublicConfig()
  const response = await Taro.request<SupabaseSession & AuthErrorBody>({
    url: `${config.url}/functions/v1/wechat-login`,
    method: 'POST',
    timeout: REQUEST_TIMEOUT_MS,
    header: {
      apikey: config.publishableKey,
      'Content-Type': 'application/json'
    },
    data: { loginCode, phoneCode }
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(getErrorMessage(response.data, '微信登录失败，请稍后重试'))
  }

  return storeSession(response.data)
}

