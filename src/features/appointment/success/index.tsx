import { Text, View } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { StatusBar } from '@/components/status-bar'
import { dayPeriod, formatSlot, type AppointmentDetail } from '@/domain/appointment'
import { getAppointment } from '@/services/appointment-service'
import './index.scss'

export default function AppointmentSuccessPage(){
  const {params}=useRouter()
  const [detail,setDetail]=useState<AppointmentDetail|null>(null)
  const [error,setError]=useState('')
  useLoad(()=>{if(!params.id){setError('缺少预约编号');return}getAppointment(params.id).then(setDetail).catch(reason=>setError(reason instanceof Error?reason.message:'预约信息加载失败'))})
  if(error)return <View className='success page'><StatusBar/><View className='success__state'>{error}</View></View>
  if(!detail)return <View className='success page'><StatusBar/><View className='success__state'>正在加载预约信息…</View></View>
  const rows=[['预约流水号',detail.appointmentNo],['病例卡号',detail.medicalRecordNo],['预约宠物',detail.petName],['预约时间',`${detail.appointmentDate} ${formatSlot(detail.startTime,detail.endTime)}`],['病症表现',detail.symptoms],['发病时间',detail.onsetDate],['精神及饮食情况',detail.mentalAppetite],['大小便情况',detail.bowelUrine],['其余补充',detail.notes||'—'],['医院/门店',detail.clinicName]]
  return <View className='success page'><StatusBar/><View className='success__nav'><Text onClick={()=>Taro.redirectTo({url:'/features/home/index'})}>‹</Text><Text>门诊预约</Text><Text>•••</Text></View><View className='success__hero'><View className='success__check'>✓</View><Text className='success__title'>预约成功</Text><Text className='success__subtitle'>成功预约{detail.appointmentDate.slice(5).replace('-','月')}日 {dayPeriod(detail.startTime)}{formatSlot(detail.startTime,detail.endTime)}的门诊</Text></View><View className='success__card'>{rows.map(([label,value])=><View className='success-row' key={label}><Text>{label}</Text><Text>{value}</Text></View>)}</View><View className='success__home' onClick={()=>Taro.redirectTo({url:'/features/home/index'})}>返回首页</View></View>
}
