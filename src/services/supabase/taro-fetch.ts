import Taro from '@tarojs/taro'

const headersToRecord = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {}
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return { ...headers }
}

/** Fetch-compatible transport for WeChat, where the browser fetch API is absent. */
export const taroFetch: typeof fetch = async (input, init = {}) => {
  const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url
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
