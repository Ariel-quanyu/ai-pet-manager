import Taro from '@tarojs/taro'
import type { Coordinates } from '@/domain/location'

export interface LocatedCity extends Coordinates { city:string; district:string }

interface TencentGeocoderResponse {
  status:number
  message:string
  result?:{address_component?:{city?:string;district?:string}}
}

const mapKey=process.env.TARO_APP_TENCENT_MAP_KEY||''

export async function getCurrentCoordinates():Promise<Coordinates>{
  const result=await Taro.getLocation({type:'gcj02',isHighAccuracy:true,highAccuracyExpireTime:5000})
  return {latitude:result.latitude,longitude:result.longitude}
}

export async function reverseGeocode(coordinates:Coordinates):Promise<LocatedCity>{
  if(!mapKey)throw new Error('请先配置腾讯位置服务 Key')
  const response=await Taro.request<TencentGeocoderResponse>({
    url:'https://apis.map.qq.com/ws/geocoder/v1/',
    method:'GET',
    data:{location:`${coordinates.latitude},${coordinates.longitude}`,key:mapKey,get_poi:0}
  })
  const component=response.data.result?.address_component
  if(response.statusCode!==200||response.data.status!==0||!component?.city){
    throw new Error(response.data.message||'暂时无法识别所在城市')
  }
  return {...coordinates,city:component.city,district:component.district||''}
}

export const isTencentMapConfigured=()=>Boolean(mapKey)
