import Taro from '@tarojs/taro'

export const taroStorage = {
  async getItem(key: string): Promise<string | null> {
    const value = Taro.getStorageSync<string>(key)
    return typeof value === 'string' && value ? value : null
  },
  async setItem(key: string, value: string): Promise<void> {
    Taro.setStorageSync(key, value)
  },
  async removeItem(key: string): Promise<void> {
    Taro.removeStorageSync(key)
  },
}
