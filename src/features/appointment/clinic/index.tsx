import { Button, Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { StatusBar } from '@/components/status-bar'
import { buildAppointmentDates, formatSlot, isAppointmentReady, validateAppointment, type AppointmentForm, type Clinic, type ClinicSlot } from '@/domain/appointment'
import type { Pet } from '@/domain/pet'
import { petRepository } from '@/services/pet-repository'
import { bookAppointment, listAvailableSlots } from '@/services/appointment-service'
import './index.scss'

const CLINIC_KEY='appointment:selected-clinic'
const PET_KEY='appointment:selected-pet'
const appetiteOptions=['正常','一般','食欲下降','精神萎靡','拒食']
const bowelOptions=['正常','偏少','腹泻','便秘','排尿异常']

export default function ClinicAppointmentPage(){
  const dates=useMemo(()=>buildAppointmentDates(),[])
  const [form,setForm]=useState<AppointmentForm>({clinic:null,date:dates[0].iso,slot:null,pet:petRepository.list()[0]||null,symptoms:'',onsetDate:'',mentalAppetite:'',bowelUrine:'',notes:''})
  const [slots,setSlots]=useState<ClinicSlot[]>([])
  const [loadingSlots,setLoadingSlots]=useState(false)
  const [submitting,setSubmitting]=useState(false)
  const patch=<K extends keyof AppointmentForm>(key:K,value:AppointmentForm[K])=>setForm(current=>({...current,[key]:value}))

  useDidShow(()=>{
    const clinic=Taro.getStorageSync<Clinic>(CLINIC_KEY)
    const pet=Taro.getStorageSync<Pet>(PET_KEY)
    if(clinic)setForm(current=>current.clinic?.id===clinic.id?current:{...current,clinic,slot:null})
    if(pet)patch('pet',pet)
  })

  useEffect(()=>{
    if(!form.clinic){setSlots([]);return}
    let active=true
    setLoadingSlots(true)
    listAvailableSlots(form.clinic.id,form.date).then(data=>{if(active)setSlots(data)}).catch(error=>{if(active){setSlots([]);Taro.showToast({title:error instanceof Error?error.message:'时段加载失败',icon:'none'})}}).finally(()=>{if(active)setLoadingSlots(false)})
    return()=>{active=false}
  },[form.clinic,form.date])

  const chooseDate=(date:string)=>setForm(current=>({...current,date,slot:null}))
  const submit=async()=>{
    const error=validateAppointment(form)
    if(error)return Taro.showToast({title:error,icon:'none'})
    if(submitting)return
    setSubmitting(true)
    try{
      const id=await bookAppointment(form)
      Taro.removeStorageSync(CLINIC_KEY);Taro.removeStorageSync(PET_KEY)
      await Taro.redirectTo({url:`/features/appointment/success/index?id=${encodeURIComponent(id)}`})
    }catch(error){Taro.showToast({title:error instanceof Error?error.message:'预约失败，请稍后重试',icon:'none'})}
    finally{setSubmitting(false)}
  }

  return <View className='appointment page'>
    <StatusBar/><View className='appointment__nav'><Text onClick={()=>Taro.navigateBack()}>‹</Text><Text className='appointment__title'>门诊预约</Text><Text>•••</Text></View>
    <View className='clinic-card card' onClick={()=>Taro.navigateTo({url:'/features/appointment/store/index'})}><Text className='clinic-card__pin'>●</Text><View><Text className='clinic-card__name'>{form.clinic?.name||'请选择门店'}</Text>{form.clinic&&<Text className='clinic-card__address'>{form.clinic.address}</Text>}</View><Text className='arrow'>›</Text></View>
    <View className='date-card card'><Text className='section-title'>到店日期</Text><ScrollView className='date-strip' scrollX enhanced showScrollbar={false}>{dates.map(item=><View key={item.iso} className={`date-item ${form.date===item.iso?'is-selected':''}`} onClick={()=>chooseDate(item.iso)}><Text>{item.label}</Text><Text className='date-item__weekday'>{item.weekday}</Text></View>)}</ScrollView><View className='divider'/><View className='slot-grid'>{loadingSlots?<Text className='empty-line'>正在加载可预约时间…</Text>:!form.clinic?<Text className='empty-line'>请先选择门店</Text>:slots.length===0?<Text className='empty-line'>该日期暂无可预约时段</Text>:slots.map(slot=><View key={slot.id} className={`slot ${form.slot?.id===slot.id?'is-selected':''} ${!slot.available?'is-disabled':''}`} onClick={()=>slot.available&&patch('slot',slot)}>{formatSlot(slot.startTime,slot.endTime)}{!slot.available?'（满）':''}</View>)}</View></View>
    <View className='pet-card card'><Text className='section-title'>就诊宠物</Text><View className='pet-card__content' onClick={()=>Taro.navigateTo({url:'/features/appointment/pet-select/index'})}><View className='pet-avatar'>{form.pet?.avatar?<Text>🐾</Text>:<Text>{form.pet?.type.includes('猫')?'🐈':'🐕'}</Text>}</View><View className='pet-copy'><Text className='pet-name'>{form.pet?.name||'请选择宠物'}</Text>{form.pet&&<><Text className='pet-days'>已经陪伴你 {Math.max(1,Math.floor((Date.now()-new Date(form.pet.createdAt).getTime())/86400000)+1)} 天了</Text><View className='pet-tags'><Text>{form.pet.breed||form.pet.type}</Text><Text>{form.pet.birthday?`${Math.max(1,new Date().getFullYear()-new Date(form.pet.birthday).getFullYear())}岁`:'年龄未知'}</Text></View></>}</View><Text className='arrow'>›</Text></View></View>
    <View className='condition-card card'>
      <View className='form-row form-row--input'><Text>症状表现 <Text className='required'>*</Text></Text><View className='input-shell'><Input value={form.symptoms} maxlength={20} placeholder='如呕吐等具体症状' onInput={event=>patch('symptoms',event.detail.value)}/><Text>{[...form.symptoms].length}/20</Text></View></View>
      <Picker mode='date' end={dates[0].iso} value={form.onsetDate} onChange={event=>patch('onsetDate',event.detail.value)}><View className='form-row'><Text>发病时间 <Text className='required'>*</Text></Text><Text className={form.onsetDate?'':'placeholder'}>{form.onsetDate||'请选择 ›'}</Text></View></Picker>
      <Picker mode='selector' range={appetiteOptions} value={Math.max(0,appetiteOptions.indexOf(form.mentalAppetite))} onChange={event=>patch('mentalAppetite',appetiteOptions[Number(event.detail.value)])}><View className='form-row'><Text>精神及饮食情况 <Text className='required'>*</Text></Text><Text className={form.mentalAppetite?'':'placeholder'}>{form.mentalAppetite||'请选择 ›'}</Text></View></Picker>
      <Picker mode='selector' range={bowelOptions} value={Math.max(0,bowelOptions.indexOf(form.bowelUrine))} onChange={event=>patch('bowelUrine',bowelOptions[Number(event.detail.value)])}><View className='form-row'><Text>大小便情况 <Text className='required'>*</Text></Text><Text className={form.bowelUrine?'':'placeholder'}>{form.bowelUrine||'请选择 ›'}</Text></View></Picker>
      <View className='form-row form-row--input'><Text>其余补充</Text><Input value={form.notes} maxlength={100} placeholder='选填' onInput={event=>patch('notes',event.detail.value)}/></View>
    </View>
    <Button className='brand-button appointment__submit' disabled={!isAppointmentReady(form)||submitting} loading={submitting} onClick={submit}>立即预约</Button>
  </View>
}
