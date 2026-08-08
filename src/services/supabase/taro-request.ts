import Taro from '@tarojs/taro'
import { assertSupabaseConfigured, supabasePublishableKey, supabaseUrl } from './config'

type RequestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface SupabaseRequestOptions {
  method?: RequestMethod
  body?: unknown
  accessToken?: string
  prefer?: string
  usePublishableToken?: boolean
}

interface ErrorPayload {
  code?: string
  error?: string
  error_code?: string
  error_description?: string
  message?: string
  msg?: string
}

export class SupabaseRequestError extends Error {
  constructor(public readonly code: string, message: string, public readonly status?: number) {
    super(message)
    this.name = 'SupabaseRequestError'
  }
}

function errorDetails(data: unknown, status: number): SupabaseRequestError {
  const payload = data && typeof data === 'object' ? data as ErrorPayload : {}
  const code = payload.code || payload.error_code || payload.error || `HTTP_${status}`
  const message = payload.message || payload.msg || payload.error_description || `请求失败（${status}）`
  return new SupabaseRequestError(code, message, status)
}

export async function supabaseRequest<T>(path: string, options: SupabaseRequestOptions = {}): Promise<T> {
  assertSupabaseConfigured()
  const { method = 'GET', body, accessToken, prefer, usePublishableToken = false } = options
  const authorization = accessToken || (usePublishableToken ? supabasePublishableKey : '')

  try {
    const response = await Taro.request<T | ErrorPayload>({
      url: `${supabaseUrl}${path}`,
      method,
      data: body,
      timeout: 15_000,
      header: {
        apikey: supabasePublishableKey,
        ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
      },
    })
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw errorDetails(response.data, response.statusCode)
    }
    return response.data as T
  } catch (error) {
    if (error instanceof SupabaseRequestError) throw error
    throw new SupabaseRequestError('NETWORK_ERROR', '网络连接失败，请检查网络后重试')
  }
}
