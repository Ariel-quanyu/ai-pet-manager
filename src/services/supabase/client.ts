import { createClient } from '@supabase/supabase-js'
import { taroFetch } from './taro-fetch'
import { taroStorage } from './taro-storage'

const supabaseUrl = process.env.TARO_APP_SUPABASE_URL?.replace(/\/$/, '') || ''
const publishableKey = process.env.TARO_APP_SUPABASE_PUBLISHABLE_KEY || ''

export const assertSupabaseConfigured = () => {
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Supabase 未配置：请设置 URL 和 Publishable Key')
  }
}

export const isSupabaseConfigured = () => Boolean(supabaseUrl && publishableKey)

// Safe non-secret placeholders keep guest mode usable in an unconfigured local build;
// authenticated operations always call assertSupabaseConfigured first.
export const supabase = createClient(supabaseUrl || 'https://not-configured.invalid', publishableKey || 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: taroStorage },
  global: { fetch: taroFetch },
})
