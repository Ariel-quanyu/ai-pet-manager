import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { taroStorage } from './taro-storage'

vi.mock('@tarojs/taro', () => ({ default: {
  getStorageSync: vi.fn(), setStorageSync: vi.fn(), removeStorageSync: vi.fn(),
} }))

describe('taroStorage', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('reads stored strings and treats missing values as null', async () => {
    vi.mocked(Taro.getStorageSync).mockReturnValueOnce('session').mockReturnValueOnce('')
    await expect(taroStorage.getItem('key')).resolves.toBe('session')
    await expect(taroStorage.getItem('key')).resolves.toBeNull()
  })
  it('writes and removes only the requested auth key', async () => {
    await taroStorage.setItem('auth', 'session')
    await taroStorage.removeItem('auth')
    expect(Taro.setStorageSync).toHaveBeenCalledWith('auth', 'session')
    expect(Taro.removeStorageSync).toHaveBeenCalledWith('auth')
  })
})
