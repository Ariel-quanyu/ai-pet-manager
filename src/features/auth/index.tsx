import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { StatusBar } from '@/components/status-bar'
import { completeWechatLogin, readableAuthError, restoreAuthSession } from '@/services/auth-session'
import { petRepository } from '@/services/pet-repository'
import './index.scss'

export function showAuthFailure(error: unknown): void {
  Taro.showToast({ title: readableAuthError(error), icon: 'none' })
}

export default function AuthPage() {
  const isFinishing = useRef(false)
  const loginInFlight = useRef(false)
  const mounted = useRef(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    mounted.current = true
    void restoreAuthSession().then((authenticated) => {
      if (authenticated && mounted.current) enterHome()
    }).catch(() => undefined)
    return () => { mounted.current = false }
  }, [])

  const enterHome = (asGuest = false) => {
    if (isFinishing.current) return

    isFinishing.current = true
    if (asGuest) {
      Taro.showToast({ title: '已进入体验模式', icon: 'none' })
    }
    Taro.redirectTo({ url: '/features/home/index' })
  }

  const handleWechatLogin = async () => {
    if (loginInFlight.current || isFinishing.current) return
    loginInFlight.current = true
    setLoading(true)
    try {
      const loginResult = await Taro.login()
      if (!loginResult.code) throw new Error('LOGIN_CODE_MISSING')
      await completeWechatLogin(loginResult.code)
      try {
        await petRepository.syncLocalPets()
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') console.error('Local pet sync failed after login', error)
        if (mounted.current) Taro.showToast({ title: '登录成功，宠物同步失败，请稍后重试', icon: 'none' })
      }
      if (mounted.current) enterHome()
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('WeChat login failed', error)
      if (mounted.current) showAuthFailure(error)
    } finally {
      loginInFlight.current = false
      if (mounted.current) setLoading(false)
    }
  }

  return (
    <View className='auth page'>
      <StatusBar light />
      <View className='auth__brand'>
        <Text className='auth__title'>宠物管家</Text>
        <Text>Hi 爱心小主人，欢迎到来</Text>
        <Text className='auth__dog'>🐕</Text>
      </View>
      <View className='auth__shade' />
      <View className='auth-sheet'>
        <View className='auth-sheet__app'>
          <Text className='mini-logo'>◉</Text>
          <Text>登录宠物管家</Text>
        </View>
        <Text className='auth-sheet__title'>使用微信登录</Text>
        <Text className='auth-sheet__hint'>登录后可安全同步你的宠物档案</Text>
        <Button
          className='auth-sheet__phone'
          onClick={handleWechatLogin}
          loading={loading}
          disabled={loading}
        >
          微信登录
        </Button>
        <Button className='auth-sheet__guest' onClick={() => enterHome(true)}>
          暂不登录，游客体验
        </Button>
      </View>
    </View>
  )
}
