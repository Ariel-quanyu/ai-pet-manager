import { Button, Text, View } from '@tarojs/components'
import type { ButtonProps } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useRef } from 'react'
import { StatusBar } from '@/components/status-bar'
import './index.scss'

type PhoneNumberEvent = Parameters<NonNullable<ButtonProps['onGetPhoneNumber']>>[0]

export default function AuthPage() {
  const isFinishing = useRef(false)

  const enterHome = (asGuest = false) => {
    if (isFinishing.current) return

    isFinishing.current = true
    if (asGuest) {
      Taro.showToast({ title: '已进入体验模式', icon: 'none' })
    }
    Taro.redirectTo({ url: '/features/home/index' })
  }

  const handlePhoneNumber = (event: PhoneNumberEvent) => {
    enterHome(event.detail.errMsg.includes('fail'))
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
        <Text className='auth-sheet__hint'>点击登录后将由微信发起一次手机号授权；当前版本不会上传或保存手机号</Text>
        <Button
          className='auth-sheet__phone'
          openType='getPhoneNumber'
          onGetPhoneNumber={handlePhoneNumber}
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
