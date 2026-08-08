import { getStoredSession } from './auth-session'
import { isSupabaseConfigured } from './supabase/config'
import { supabaseRequest } from './supabase/taro-request'

interface StoredSessionSummary {
  accessToken: string
  refreshToken: string
  expiresAt: number
  userId: string
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
  prefer?: string
}

/** Returns the persisted Supabase session established by WeChat login. */
export async function ensureSupabaseSession(): Promise<StoredSessionSummary> {
  const session = await getStoredSession()
  if (!session) throw new Error('请先使用微信登录')
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: (session.expires_at || Math.floor(Date.now() / 1000)) * 1000,
    userId: session.user.id,
  }
}

export async function supabaseRest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = await ensureSupabaseSession()
  return supabaseRequest<T>(`/rest/v1/${path}`, { ...options, accessToken: session.accessToken })
}

export { isSupabaseConfigured }
