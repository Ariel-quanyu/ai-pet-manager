import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { ButtonProps } from '@tarojs/components'
import { StatusBar } from '@/components/status-bar'
import './index.scss'
export default function AuthPage(){
 const finish=(event?: ButtonProps.onGetPhoneNumber extends (...args: infer A)=>unknown ? A[0] : never)=>{ if(event?.detail?.errMsg?.includes('fail')) Taro.showToast({title:'已进入体验模式',icon:'none'}); Taro.redirectTo({url:'/features/home/index'}) }
 return <View className='auth page'><StatusBar light/><View className='auth__brand'><Text className='auth__title'>宠物管家</Text><Text>Hi 爱心小主人，欢迎到来</Text><Text className='auth__dog'>🐕</Text></View><View className='auth__shade'/><View className='auth-sheet'><View className='auth-sheet__app'><Text className='mini-logo'>◉</Text><Text>宠物管家小程序</Text><Text className='info'>ⓘ</Text></View><Text className='auth-sheet__title'>申请获取并验证你的手机号</Text><Text className='auth-sheet__hint'>用于识别账号，当前版本不会上传或保存手机号</Text><Button className='auth-sheet__phone' openType='getPhoneNumber' onGetPhoneNumber={finish}><Text>183****0769</Text><Text className='phone-note'>微信绑定号码</Text></Button><Button className='auth-sheet__deny' onClick={()=>finish()}>不允许</Button><Button className='auth-sheet__other' onClick={()=>finish()}>使用其他号码</Button></View></View>
}
