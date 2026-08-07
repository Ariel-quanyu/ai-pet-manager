import Taro from '@tarojs/taro'
import { assertSupabaseConfigured, supabase } from './supabase/client'

interface StoredSession { accessToken:string; refreshToken:string; expiresAt:number; userId:string }
interface RequestOptions { method?:'GET'|'POST'|'PATCH'; body?:unknown; token?:string; prefer?:string }

const url=(process.env.TARO_APP_SUPABASE_URL||'').replace(/\/$/,'')
const apiKey=process.env.TARO_APP_SUPABASE_PUBLISHABLE_KEY||''

async function request<T>(path:string,{method='GET',body,token,prefer}:RequestOptions={}):Promise<T>{
  assertSupabaseConfigured()
  const response=await Taro.request<T|{message?:string;msg?:string;error_description?:string}>({
    url:`${url}${path}`,
    method,
    data:body,
    header:{
      apikey:apiKey,
      ...(token?{Authorization:`Bearer ${token}`}:{}),
      'Content-Type':'application/json',
      ...(prefer?{Prefer:prefer}:{})
    }
  })
  if(response.statusCode<200||response.statusCode>=300){
    const data=response.data as {message?:string;msg?:string;error_description?:string}
    throw new Error(data.message||data.msg||data.error_description||`请求失败（${response.statusCode}）`)
  }
  return response.data as T
}

/**
 * Returns the same persisted Supabase session established by WeChat login.
 * This module must never create a second anonymous user when no session exists.
 */
export async function ensureSupabaseSession():Promise<StoredSession>{
  assertSupabaseConfigured()
  const result=await supabase.auth.getSession()
  const session=result.data.session
  if(result.error||!session){
    if(result.error) await supabase.auth.signOut({scope:'local'}).catch(()=>undefined)
    throw new Error('请先使用微信登录')
  }
  return {
    accessToken:session.access_token,
    refreshToken:session.refresh_token,
    expiresAt:(session.expires_at||Math.floor(Date.now()/1000))*1000,
    userId:session.user.id
  }
}

export async function supabaseRest<T>(path:string,options:Omit<RequestOptions,'token'>={}):Promise<T>{
  const session=await ensureSupabaseSession()
  return request<T>(`/rest/v1/${path}`,{...options,token:session.accessToken})
}

export const isSupabaseConfigured=()=>Boolean(url&&apiKey)
