import { Image, Input, Picker, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { StatusBar } from '@/components/status-bar'
import type { Clinic } from '@/domain/appointment'
import { distanceInKilometres,formatDistance,normalizeCityName,type Coordinates } from '@/domain/location'
import { listClinics } from '@/services/appointment-service'
import { getCurrentCoordinates,isTencentMapConfigured,reverseGeocode } from '@/services/location-service'
import './index.scss'

const CITY_STORAGE_KEY='appointment:selected-city'

interface ClinicWithDistance { clinic:Clinic; distance:number|null }

const clinicCoordinates=(clinic:Clinic):Coordinates|null=>
  typeof clinic.latitude==='number'&&typeof clinic.longitude==='number'
    ?{latitude:clinic.latitude,longitude:clinic.longitude}
    :null

export default function SelectClinicPage(){
  const [clinics,setClinics]=useState<Clinic[]>([])
  const [selectedCity,setSelectedCity]=useState(()=>Taro.getStorageSync<string>(CITY_STORAGE_KEY)||'')
  const [coordinates,setCoordinates]=useState<Coordinates|null>(null)
  const [keyword,setKeyword]=useState('')
  const [loading,setLoading]=useState(true)
  const [locating,setLocating]=useState(false)
  const [locationHint,setLocationHint]=useState('正在定位当前城市…')
  const [error,setError]=useState('')

  const cityOptions=useMemo(()=>Array.from(new Set(clinics.map(clinic=>clinic.city?.trim()).filter((city):city is string=>Boolean(city)))),[clinics])

  const visibleClinics=useMemo<ClinicWithDistance[]>(()=>{
    const normalizedKeyword=keyword.trim().toLocaleLowerCase()
    return clinics
      .filter(clinic=>!selectedCity||normalizeCityName(clinic.city||'')===normalizeCityName(selectedCity))
      .filter(clinic=>!normalizedKeyword||`${clinic.name} ${clinic.address} ${clinic.district||''}`.toLocaleLowerCase().includes(normalizedKeyword))
      .map(clinic=>{
        const target=clinicCoordinates(clinic)
        return {clinic,distance:coordinates&&target?distanceInKilometres(coordinates,target):null}
      })
      .sort((left,right)=>{
        if(left.distance!==null&&right.distance!==null)return left.distance-right.distance
        if(left.distance!==null)return -1
        if(right.distance!==null)return 1
        return left.clinic.name.localeCompare(right.clinic.name,'zh-CN')
      })
  },[clinics,coordinates,keyword,selectedCity])

  const locate=async (showFailure:boolean)=>{
    setLocating(true)
    setLocationHint('正在定位当前城市…')
    try{
      const current=await getCurrentCoordinates()
      setCoordinates(current)
      try{
        const city=(await reverseGeocode(current)).city
        setSelectedCity(city)
        Taro.setStorageSync(CITY_STORAGE_KEY,city)
        setLocationHint('已定位，附近门店按距离排序')
      }catch{
        setLocationHint(isTencentMapConfigured()?'已获取位置，城市识别失败，请手动选择':'已获取位置，请配置地图 Key 或手动选择城市')
      }
    }catch(reason){
      setLocationHint('未开启定位，可手动选择城市')
      if(showFailure){
        const message=reason instanceof Error?reason.message:'无法获取当前位置'
        const result=await Taro.showModal({title:'定位失败',content:`${message}。你仍可手动选择城市。`,confirmText:'去设置',cancelText:'暂不'})
        if(result.confirm)await Taro.openSetting()
      }
    }finally{
      setLocating(false)
    }
  }

  useLoad(()=>{
    void listClinics()
      .then(rows=>{setClinics(rows);setLoading(false);void locate(false)})
      .catch(reason=>setError(reason instanceof Error?reason.message:'门店加载失败'))
      .finally(()=>setLoading(false))
  })

  const changeCity=(event:{detail:{value:string|number}})=>{
    const city=cityOptions[Number(event.detail.value)]||''
    setSelectedCity(city)
    if(city)Taro.setStorageSync(CITY_STORAGE_KEY,city)
  }
  const select=(clinic:Clinic)=>{Taro.setStorageSync('appointment:selected-clinic',clinic);Taro.navigateBack()}

  return <View className='select-page page'>
    <StatusBar/>
    <View className='select-page__nav'><Text className='select-page__back' onClick={()=>Taro.navigateBack()}>‹</Text><Text>选择门店</Text><Text className='select-page__menu'>•••</Text></View>
    <View className='select-page__toolbar'>
      <Picker mode='selector' range={cityOptions} value={Math.max(cityOptions.indexOf(selectedCity),0)} onChange={changeCity} disabled={cityOptions.length===0}>
        <View className='city-picker'><Text>{selectedCity||'选择城市'}</Text><Text className='city-picker__arrow'>⌄</Text></View>
      </Picker>
      <View className='clinic-search'><Text className='clinic-search__icon'>⌕</Text><Input value={keyword} onInput={event=>setKeyword(event.detail.value)} placeholder='请输入门店关键词' maxlength={30}/></View>
      <View className={`locate-button ${locating?'locate-button--busy':''}`} onClick={()=>{if(!locating)void locate(true)}}><Text>⌖</Text></View>
    </View>
    <View className='location-status'><Text>{locationHint}</Text><Text onClick={()=>{if(!locating)void locate(true)}}>{locating?'定位中':'重新定位'}</Text></View>
    <View className='select-page__body'>
      {loading?<Text className='state'>正在加载门店…</Text>:error?<View className='state'><Text>{error}</Text><Text className='state__hint'>请检查 Supabase 配置、匿名登录和网络域名</Text></View>:clinics.length===0?<View className='state'><Text>暂无可预约门店</Text><Text className='state__hint'>请先在 Supabase 添加门店资料</Text></View>:visibleClinics.length===0?<View className='state'><Text>{selectedCity?`${selectedCity}暂无可预约门店`:'没有找到相关门店'}</Text><Text className='state__hint'>可切换城市或修改搜索关键词</Text></View>:visibleClinics.map(({clinic,distance})=><View className='clinic-option' key={clinic.id} onClick={()=>select(clinic)}>
        {clinic.imageUrl?<Image className='clinic-option__image' src={clinic.imageUrl} mode='aspectFill'/>:<View className='clinic-option__image clinic-option__image--empty'>宠</View>}
        <View className='clinic-option__copy'><Text className='clinic-option__name'>{clinic.name}</Text>{clinic.phone&&<Text className='clinic-option__phone'>{clinic.phone}</Text>}<View className='clinic-option__location'>{distance!==null&&<Text className='clinic-option__distance'>{formatDistance(distance)}</Text>}<Text className='clinic-option__address'>{clinic.address}</Text></View></View>
        <Text className='clinic-option__arrow'>›</Text>
      </View>)}
    </View>
  </View>
}
