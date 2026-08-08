import { Button, Text, View } from '@tarojs/components'
import type { ButtonProps } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { StatusBar } from '@/components/status-bar'
import { completeWechatLogin, readableAuthError, restoreAuthSession } from '@/services/auth-session'
import './index.scss'

type PhoneNumberEvent = Parameters<NonNullable<ButtonProps['onGetPhoneNumber']>>[0]

export function showAuthFailure(error: unknown): void {
  Taro.showToast({ title: readableAuthError(error), icon: 'none' })
}

export default function AuthPage() {
  const isFinishing = useRef(false)
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

  const handlePhoneNumber = async (event: PhoneNumberEvent) => {
    if (loading || isFinishing.current) return
    const phoneCode = event.detail.code
    if (!phoneCode || event.detail.errMsg.includes('fail')) {
      Taro.showToast({ title: '未授权手机号，可继续游客体验', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const loginResult = await Taro.login()
      if (!loginResult.code) throw new Error('LOGIN_CODE_MISSING')
      await completeWechatLogin(loginResult.code, phoneCode)
      if (mounted.current) enterHome()
    } catch (error) {
      if (mounted.current) showAuthFailure(error)
    } finally {
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
        <Text className='auth-sheet__title'>使用微信绑定手机号登录</Text>
        <Text className='auth-sheet__hint'>授权后将安全保存微信绑定手机号，用于创建和识别你的宠物管家账户</Text>
        <Button
          className='auth-sheet__phone'
          openType='getPhoneNumber'
          onGetPhoneNumber={handlePhoneNumber}
          loading={loading}
          disabled={loading}
        >
          微信手机号快捷登录
        </Button>
        <Button className='auth-sheet__guest' onClick={() => enterHome(true)}>
          暂不登录，游客体验
        </Button>
      </View>
    </View>
  )
}
