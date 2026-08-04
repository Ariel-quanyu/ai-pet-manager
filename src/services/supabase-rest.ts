import Taro from '@tarojs/taro'

interface StoredSession { accessToken:string; refreshToken:string; expiresAt:number; userId:string }
interface AuthPayload { access_token:string; refresh_token:string; expires_in:number; user:{id:string} }
interface RequestOptions { method?:'GET'|'POST'|'PATCH'; body?:unknown; token?:string; prefer?:string }

const SESSION_KEY='ai-pet-manager:supabase-session'
const url=(process.env.TARO_APP_SUPABASE_URL||'').replace(/\/$/,'')
const apiKey=process.env.TARO_APP_SUPABASE_PUBLISHABLE_KEY||process.env.TARO_APP_SUPABASE_ANON_KEY||''

const assertConfigured=()=>{if(!url||!apiKey)throw new Error('请先配置 Supabase 环境变量')}

async function request<T>(path:string,{method='GET',body,token,prefer}:RequestOptions={}):Promise<T>{
  assertConfigured()
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

const storeSession=(payload:AuthPayload):StoredSession=>{
  const session={accessToken:payload.access_token,refreshToken:payload.refresh_token,expiresAt:Date.now()+payload.expires_in*1000,userId:payload.user.id}
  Taro.setStorageSync(SESSION_KEY,session)
  return session
}

export async function ensureSupabaseSession():Promise<StoredSession>{
  const saved=Taro.getStorageSync<StoredSession>(SESSION_KEY)
  if(saved?.accessToken&&saved.expiresAt>Date.now()+60_000)return saved
  if(saved?.refreshToken){
    try{
      const refreshed=await request<AuthPayload>('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:saved.refreshToken}})
      return storeSession(refreshed)
    }catch{Taro.removeStorageSync(SESSION_KEY)}
  }
  const created=await request<AuthPayload>('/auth/v1/signup',{method:'POST',body:{data:{source:'wechat-mini-program'}}})
  return storeSession(created)
}

export async function supabaseRest<T>(path:string,options:Omit<RequestOptions,'token'>={}):Promise<T>{
  const session=await ensureSupabaseSession()
  return request<T>(`/rest/v1/${path}`,{...options,token:session.accessToken})
}

export const isSupabaseConfigured=()=>Boolean(url&&apiKey)
