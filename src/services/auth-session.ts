import { isSupabaseConfigured, supabaseAuthStorageKey } from './supabase/config'
import { SupabaseRequestError, supabaseRequest } from './supabase/taro-request'
import { taroStorage } from './supabase/taro-storage'

interface SupabaseUser { id: string }

export interface StoredSession {
  access_token: string
  refresh_token: string
  expires_in?: number
  expires_at?: number
  token_type?: string
  user: SupabaseUser
}

const isSession = (value: unknown): value is StoredSession => {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<StoredSession>
  return Boolean(session.access_token && session.refresh_token && session.user?.id)
}

async function loadSession(): Promise<StoredSession | null> {
  const stored = await taroStorage.getItem(supabaseAuthStorageKey)
  if (!stored) return null
  try {
    const session: unknown = JSON.parse(stored)
    return isSession(session) ? session : null
  } catch {
    return null
  }
}

async function saveSession(session: StoredSession): Promise<void> {
  const expiresAt = session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600)
  await taroStorage.setItem(supabaseAuthStorageKey, JSON.stringify({ ...session, expires_at: expiresAt }))
}

async function clearSession(): Promise<void> {
  await taroStorage.removeItem(supabaseAuthStorageKey)
}

async function validateSession(session: StoredSession): Promise<boolean> {
  const user = await supabaseRequest<SupabaseUser>('/auth/v1/user', { accessToken: session.access_token })
  return Boolean(user.id && user.id === session.user.id)
}

async function refreshSession(refreshToken: string): Promise<StoredSession> {
  const session = await supabaseRequest<StoredSession>('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  })
  if (!isSession(session)) throw new SupabaseRequestError('SESSION_INVALID', '登录状态无效，请重新登录')
  await saveSession(session)
  return session
}

export async function getStoredSession(): Promise<StoredSession | null> {
  const session = await loadSession()
  if (!session) return null
  const expiresSoon = !session.expires_at || session.expires_at <= Math.floor(Date.now() / 1000) + 30
  if (!expiresSoon) return session
  try {
    return await refreshSession(session.refresh_token)
  } catch {
    await clearSession()
    return null
  }
}

export async function completeWechatLogin(loginCode: string): Promise<void> {
  const payload: unknown = await supabaseRequest<unknown>('/functions/v1/wechat-login', {
    method: 'POST',
    body: { loginCode },
    usePublishableToken: true,
  })
  if (!isSession(payload)) {
    const code = payload && typeof payload === 'object' && 'code' in payload
      ? String(payload.code)
      : 'LOGIN_FAILED'
    throw new SupabaseRequestError(code, '登录服务返回了无效会话')
  }
  const session = payload
  try {
    await saveSession(session)
  } catch {
    throw new SupabaseRequestError('SESSION_SAVE_FAILED', '无法保存登录状态')
  }
  try {
    if (!await validateSession(session)) throw new Error('SESSION_INVALID')
  } catch (error) {
    await clearSession()
    throw error
  }
}

export async function restoreAuthSession(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const session = await getStoredSession()
  if (!session) return false
  try {
    if (await validateSession(session)) return true
  } catch {
    // Invalid or unreachable sessions must never prevent the auth page from rendering.
  }
  await clearSession()
  return false
}

export async function signOut(): Promise<void> {
  const session = await loadSession()
  if (!session) return
  try {
    await supabaseRequest<unknown>('/auth/v1/logout', { method: 'POST', accessToken: session.access_token })
  } finally {
    await clearSession()
  }
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_REQUEST: '登录信息无效，请重试',
  WECHAT_LOGIN_FAILED: '微信登录凭证已过期，请重试',
  SESSION_SAVE_FAILED: '登录状态保存失败，请稍后重试',
  SESSION_CREATION_FAILED: '登录服务暂时不可用，请稍后重试',
  INTERNAL_ERROR: '登录服务暂时不可用，请稍后重试',
  NETWORK_ERROR: '网络连接失败，请检查网络后重试',
}

export function readableAuthError(error: unknown): string {
  return error instanceof SupabaseRequestError
    ? AUTH_ERROR_MESSAGES[error.code] || error.message || '登录失败，请稍后重试'
    : '登录失败，请稍后重试'
}
