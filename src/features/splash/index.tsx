import { Button, Checkbox, Label, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { StatusBar } from '@/components/status-bar'
import './index.scss'
export default function SplashPage() {
  const [agreed,setAgreed]=useState(false)
  const login=() => agreed ? Taro.navigateTo({url:'/features/auth/index'}) : Taro.showToast({title:'请先阅读并同意协议',icon:'none'})
  return <View className='splash page'><StatusBar /><View className='splash__copy'><Text className='splash__title'>宠物管家</Text><Text className='splash__hello'>Hi 爱心小主人，欢迎到来</Text></View><View className='splash__pet'><Text className='splash__dog'>🐕</Text><View className='splash__bubble'>汪！</View></View><View className='splash__actions'><Button className='brand-button' onClick={login}>立即登录</Button><Button className='splash__skip' onClick={()=>Taro.redirectTo({url:'/features/home/index'})}>跳过登录</Button><Label className='splash__consent'><Checkbox value='consent' checked={agreed} color='#176bd2' onClick={()=>setAgreed(!agreed)}/><Text>我已阅读并同意</Text><Text className='link'>隐私协议</Text><Text>和</Text><Text className='link'>用户协议</Text></Label></View></View>
}
