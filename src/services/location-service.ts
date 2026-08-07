import Taro from '@tarojs/taro'
import type { Coordinates } from '@/domain/location'

export interface LocatedCity extends Coordinates { city:string; district:string }

export const SELECTED_CITY_STORAGE_KEY='appointment:selected-city'

interface TencentGeocoderResponse {
  status:number
  message:string
  result?:{address_component?:{city?:string;district?:string}}
}

const mapKey=process.env.TARO_APP_TENCENT_MAP_KEY||''
const LOCATION_TIMEOUT_MS=10_000

export class LocationPermissionError extends Error {
  constructor(){
    super('定位权限未开启')
    this.name='LocationPermissionError'
  }
}

const withTimeout=<T>(promise:Promise<T>,message:string):Promise<T>=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(message)),LOCATION_TIMEOUT_MS)
  promise.then(
    value=>{clearTimeout(timer);resolve(value)},
    reason=>{clearTimeout(timer);reject(reason)}
  )
})

const isPermissionFailure=(reason:unknown)=>{
  const message=reason instanceof Error?reason.message:String(reason||'')
  return /auth deny|authorize|permission|scope\.userLocation|权限/u.test(message)
}

export async function getCurrentCoordinates():Promise<Coordinates>{
  try{
    await withTimeout(Taro.authorize({scope:'scope.userLocation'}),'定位授权超时，请重试')
  }catch(reason){
    if(isPermissionFailure(reason))throw new LocationPermissionError()
    throw reason
  }
  const result=await withTimeout(
    Taro.getLocation({type:'gcj02',isHighAccuracy:true,highAccuracyExpireTime:5000}),
    '定位超时，请检查网络和系统定位设置后重试'
  )
  return {latitude:result.latitude,longitude:result.longitude}
}

export async function reverseGeocode(coordinates:Coordinates):Promise<LocatedCity>{
  if(!mapKey)throw new Error('请先配置腾讯位置服务 Key')
  const response=await Taro.request<TencentGeocoderResponse>({
    url:'https://apis.map.qq.com/ws/geocoder/v1/',
    method:'GET',
    timeout:LOCATION_TIMEOUT_MS,
    data:{location:`${coordinates.latitude},${coordinates.longitude}`,key:mapKey,get_poi:0}
  })
  const component=response.data.result?.address_component
  if(response.statusCode!==200||response.data.status!==0||!component?.city){
    throw new Error(response.data.message||'暂时无法识别所在城市')
  }
  return {...coordinates,city:component.city,district:component.district||''}
}

export const isTencentMapConfigured=()=>Boolean(mapKey)
export const isLocationPermissionError=(reason:unknown)=>reason instanceof LocationPermissionError||isPermissionFailure(reason)

export function getStoredCity():string{
  try{return String(Taro.getStorageSync(SELECTED_CITY_STORAGE_KEY)||'').trim()}
  catch{return ''}
}

export function storeSelectedCity(city:string):void{
  const value=city.trim()
  if(!value)return
  try{Taro.setStorageSync(SELECTED_CITY_STORAGE_KEY,value)}catch{}
}

export async function locateCurrentCity():Promise<LocatedCity>{
  const coordinates=await getCurrentCoordinates()
  const located=await reverseGeocode(coordinates)
  storeSelectedCity(located.city)
  return located
}
