import { assertSupabaseConfigured, isSupabaseConfigured, supabase } from './supabase/client'

interface LoginSession { access_token: string; refresh_token: string }

export async function completeWechatLogin(loginCode: string, phoneCode: string): Promise<void> {
  assertSupabaseConfigured()
  const result = await supabase.functions.invoke<LoginSession & { code?: string }>('wechat-login', {
    body: { loginCode, phoneCode },
  })
  const payload = result.data
  if (result.error || !payload?.access_token || !payload.refresh_token) throw new Error(payload?.code || 'LOGIN_FAILED')
  const { error } = await supabase.auth.setSession(payload)
  if (error) throw error
  const userResult = await supabase.auth.getUser()
  if (userResult.error || !userResult.data.user) {
    await supabase.auth.signOut({ scope: 'local' })
    throw userResult.error || new Error('SESSION_INVALID')
  }
}

export async function restoreAuthSession(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const session = await supabase.auth.getSession()
  if (session.error) {
    await supabase.auth.signOut({ scope: 'local' })
    return false
  }
  if (!session.data.session) return false
  const user = await supabase.auth.getUser()
  if (!user.error && user.data.user) return true
  await supabase.auth.signOut({ scope: 'local' })
  return false
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
