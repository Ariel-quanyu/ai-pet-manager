import type { Pet } from './pet'

export interface Clinic { id:string; name:string; address:string; phone?:string|null }
export interface AppointmentDate { iso:string; label:string; weekday:string }
export interface ClinicSlot { id:string; startTime:string; endTime:string; capacity:number; booked:number; available:boolean }
export interface AppointmentForm {
  clinic:Clinic|null
  date:string
  slot:ClinicSlot|null
  pet:Pet|null
  symptoms:string
  onsetDate:string
  mentalAppetite:string
  bowelUrine:string
  notes:string
}
export interface AppointmentDetail {
  id:string
  appointmentNo:string
  medicalRecordNo:string
  appointmentDate:string
  startTime:string
  endTime:string
  status:string
  symptoms:string
  onsetDate:string
  mentalAppetite:string
  bowelUrine:string
  notes:string|null
  clinicName:string
  petName:string
}

const WEEKDAYS=['周日','周一','周二','周三','周四','周五','周六']
const pad=(value:number)=>String(value).padStart(2,'0')

export const toLocalDate=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`

export function buildAppointmentDates(now=new Date(),count=14):AppointmentDate[]{
  return Array.from({length:count},(_,index)=>{
    const date=new Date(now.getFullYear(),now.getMonth(),now.getDate()+index)
    const label=index===0?'今天':index===1?'明天':index===2?'后天':`${pad(date.getMonth()+1)}-${pad(date.getDate())}`
    return {iso:toLocalDate(date),label,weekday:WEEKDAYS[date.getDay()]}
  })
}

export const isAppointmentReady=(form:AppointmentForm)=>Boolean(
  form.clinic&&form.date&&form.slot&&form.pet&&form.symptoms.trim()&&form.onsetDate&&form.mentalAppetite&&form.bowelUrine
)

export function validateAppointment(form:AppointmentForm):string|null{
  if(!form.clinic)return '请选择门店'
  if(!form.date)return '请选择到店日期'
  if(!form.slot)return '请选择预约时间'
  if(!form.pet)return '请选择就诊宠物'
  if(!form.symptoms.trim())return '请填写症状表现'
  if([...form.symptoms.trim()].length>20)return '症状表现不能超过20个字'
  if(!form.onsetDate)return '请选择发病时间'
  if(!form.mentalAppetite)return '请选择精神及饮食情况'
  if(!form.bowelUrine)return '请选择大小便情况'
  return null
}

export const formatSlot=(start:string,end:string)=>`${start.slice(0,5)}～${end.slice(0,5)}`
export const dayPeriod=(time:string)=>Number(time.slice(0,2))<12?'上午':'下午'
