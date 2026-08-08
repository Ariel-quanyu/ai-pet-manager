export const supabaseUrl = (process.env.TARO_APP_SUPABASE_URL || '').replace(/\/$/, '')
export const supabasePublishableKey = process.env.TARO_APP_SUPABASE_PUBLISHABLE_KEY || ''

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabasePublishableKey)

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置：请设置 URL 和 Publishable Key')
  }
}

const supabaseHostname = supabaseUrl.replace(/^https?:\/\//, '').split('/')[0]
export const supabaseAuthStorageKey = `sb-${supabaseHostname.split('.')[0] || 'unconfigured'}-auth-token`
