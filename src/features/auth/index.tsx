import { Button, Text, View } from '@tarojs/components'
import type { ButtonProps } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useRef, useState } from 'react'
import { StatusBar } from '@/components/status-bar'
import { petRepository } from '@/services/pet-repository'
import { clearStoredSession, loginWithWeChat } from '@/services/supabase-session'
import './index.scss'

type PhoneNumberEvent = Parameters<NonNullable<ButtonProps['onGetPhoneNumber']>>[0]

export default function AuthPage() {
  const isFinishing = useRef(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const enterHome = () => {
    if (isFinishing.current) return
    isFinishing.current = true
    Taro.redirectTo({ url: '/features/home/index' })
  }

  const continueAsGuest = () => {
    clearStoredSession()
    Taro.showToast({ title: '已进入体验模式', icon: 'none' })
    enterHome()
  }

  const handlePhoneNumber = async (event: PhoneNumberEvent) => {
    const phoneCode = event.detail.code
    if (!phoneCode || event.detail.errMsg.includes('fail')) {
      continueAsGuest()
      return
    }
    if (isLoggingIn) return

    setIsLoggingIn(true)
    Taro.showLoading({ title: '正在登录', mask: true })
    try {
      const loginResult = await Taro.login()
      if (!loginResult.code) throw new Error('微信登录凭证获取失败')
      await loginWithWeChat(loginResult.code, phoneCode)
      const migration = await petRepository.migrateGuestPets()
      await Taro.showToast({
        title: migration.migrated ? `已同步 ${migration.migrated} 只宠物` : '登录成功',
        icon: 'success'
      })
      enterHome()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '微信登录失败，请稍后重试'
      await Taro.showModal({ title: '登录失败', content: message, showCancel: false })
    } finally {
      Taro.hideLoading()
      setIsLoggingIn(false)
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
        <Text className='auth-sheet__hint'>手机号仅用于完成微信身份验证，不会保存在小程序本地</Text>
        <Button
          className='auth-sheet__phone'
          disabled={isLoggingIn}
          loading={isLoggingIn}
          openType='getPhoneNumber'
          onGetPhoneNumber={handlePhoneNumber}
        >
          微信手机号快捷登录
        </Button>
        <Button className='auth-sheet__guest' disabled={isLoggingIn} onClick={continueAsGuest}>
          暂不登录，游客体验
        </Button>
      </View>
    </View>
  )
}

