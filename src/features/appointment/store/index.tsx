import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { StatusBar } from '@/components/status-bar'
import type { Clinic } from '@/domain/appointment'
import { listClinics } from '@/services/appointment-service'
import './index.scss'

export default function SelectClinicPage(){
  const [clinics,setClinics]=useState<Clinic[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  useLoad(()=>{listClinics().then(setClinics).catch(reason=>setError(reason instanceof Error?reason.message:'门店加载失败')).finally(()=>setLoading(false))})
  const select=(clinic:Clinic)=>{Taro.setStorageSync('appointment:selected-clinic',clinic);Taro.navigateBack()}
  return <View className='select-page page'><StatusBar/><View className='select-page__nav'><Text onClick={()=>Taro.navigateBack()}>‹</Text><Text>选择门店</Text><Text>•••</Text></View><View className='select-page__body'>{loading?<Text className='state'>正在加载门店…</Text>:error?<View className='state'><Text>{error}</Text><Text className='state__hint'>请检查 Supabase 配置和网络域名</Text></View>:clinics.length===0?<Text className='state'>暂无可预约门店</Text>:clinics.map(clinic=><View className='clinic-option' key={clinic.id} onClick={()=>select(clinic)}><View className='clinic-option__icon'>✚</View><View className='clinic-option__copy'><Text className='clinic-option__name'>{clinic.name}</Text><Text className='clinic-option__address'>{clinic.address}</Text>{clinic.phone&&<Text className='clinic-option__phone'>{clinic.phone}</Text>}</View><Text className='clinic-option__arrow'>›</Text></View>)}</View></View>
}
