import Taro from '@tarojs/taro'

export const headersToRecord = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {}
  if (Array.isArray(headers)) return Object.fromEntries(headers.map(([key, value]) => [key, String(value)]))

  const result: Record<string, string> = {}
  if (typeof (headers as Headers).forEach === 'function') {
    ;(headers as Headers).forEach((value, key) => { result[key] = value })
    return result
  }

  for (const [key, value] of Object.entries(headers)) result[key] = String(value)
  return result
}

const requestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input
  if (typeof URL !== 'undefined' && input instanceof URL) return String(input)
  return (input as Request).url
}

/** Fetch-compatible transport for WeChat, where browser Fetch globals may be absent. */
export const taroFetch: typeof fetch = async (input, init = {}) => {
  const url = requestUrl(input)
  const result = await Taro.request({
    url,
    method: (init.method || 'GET') as keyof Taro.request.Method,
    header: headersToRecord(init.headers),
    data: init.body,
    timeout: 15_000,
  })
  const body = typeof result.data === 'string' ? result.data : JSON.stringify(result.data ?? null)
  const responseHeaders = new Map(Object.entries(result.header || {}).map(([key, value]) => [key.toLowerCase(), String(value)]))
  return {
    ok: result.statusCode >= 200 && result.statusCode < 300,
    status: result.statusCode,
    statusText: '',
    url,
    redirected: false,
    type: 'basic',
    body: null,
    bodyUsed: false,
    headers: { get: (name: string) => responseHeaders.get(name.toLowerCase()) || null },
    clone() { return this },
    async json() { return typeof result.data === 'string' ? JSON.parse(result.data) : result.data },
    async text() { return body },
    async arrayBuffer() { return new TextEncoder().encode(body).buffer },
    async blob() { return new Blob([body]) },
    async formData() { throw new Error('FormData response is not supported') },
  } as unknown as Response
}
