import { afterEach, describe, expect, it, vi } from 'vitest'
import { headersToRecord } from './taro-fetch'

describe('taroFetch header conversion', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('handles plain headers when the WeChat runtime has no Headers global', () => {
    vi.stubGlobal('Headers', undefined)
    expect(headersToRecord({ apikey: 'public-key', Authorization: 'Bearer token' }))
      .toEqual({ apikey: 'public-key', Authorization: 'Bearer token' })
  })

  it('handles tuple headers without browser globals', () => {
    vi.stubGlobal('Headers', undefined)
    expect(headersToRecord([['Content-Type', 'application/json']]))
      .toEqual({ 'Content-Type': 'application/json' })
  })
})
