import type { AppointmentDetail, AppointmentForm, Clinic, ClinicSlot } from '@/domain/appointment'
import { supabaseRest } from './supabase-rest'
import { upsertCloudPet } from './pet-repository'

interface ClinicRow {
  id:string
  name:string
  address:string
  phone:string|null
  city:string|null
  district:string|null
  latitude:number|null
  longitude:number|null
  image_url:string|null
}
interface SlotRow { id:string; start_time:string; end_time:string; capacity:number; booked:number; available:boolean }
interface AppointmentRow {
  id:string; appointment_no:string; appointment_date:string; start_time:string; end_time:string; status:string;
  symptoms:string; onset_date:string; mental_appetite:string; bowel_urine:string; notes:string|null;
  clinics:{name:string}|null; pets:{name:string;medical_record_no:string}|null
}

export async function listClinics():Promise<Clinic[]>{
  const select='id,name,address,phone,city,district,latitude,longitude,image_url'
  const rows=await supabaseRest<ClinicRow[]>(`clinics?select=${select}&is_active=eq.true&order=city.asc,name.asc`)
  return rows.map(row=>({
    id:row.id,name:row.name,address:row.address,phone:row.phone,city:row.city,district:row.district,
    latitude:row.latitude,longitude:row.longitude,imageUrl:row.image_url
  }))
}

export async function listAvailableSlots(clinicId:string,date:string):Promise<ClinicSlot[]>{
  const rows=await supabaseRest<SlotRow[]>('rpc/get_available_clinic_slots',{method:'POST',body:{p_clinic_id:clinicId,p_date:date}})
  return rows.map(row=>({id:row.id,startTime:row.start_time,endTime:row.end_time,capacity:row.capacity,booked:row.booked,available:row.available}))
}

export async function bookAppointment(form:AppointmentForm):Promise<string>{
  if(!form.clinic||!form.slot||!form.pet)throw new Error('预约信息不完整')
  const petId=await upsertCloudPet(form.pet)
  return supabaseRest<string>('rpc/book_clinic_appointment',{method:'POST',body:{
    p_clinic_id:form.clinic.id,p_pet_id:petId,p_slot_id:form.slot.id,p_appointment_date:form.date,
    p_symptoms:form.symptoms.trim(),p_onset_date:form.onsetDate,p_mental_appetite:form.mentalAppetite,
    p_bowel_urine:form.bowelUrine,p_notes:form.notes.trim()||null
  }})
}

export async function getAppointment(id:string):Promise<AppointmentDetail>{
  const select='id,appointment_no,appointment_date,start_time,end_time,status,symptoms,onset_date,mental_appetite,bowel_urine,notes,clinics(name),pets(name,medical_record_no)'
  const rows=await supabaseRest<AppointmentRow[]>(`clinic_appointments?id=eq.${encodeURIComponent(id)}&select=${encodeURIComponent(select)}&limit=1`)
  const row=rows[0]
  if(!row)throw new Error('未找到该预约')
  return {id:row.id,appointmentNo:row.appointment_no,medicalRecordNo:row.pets?.medical_record_no||'—',appointmentDate:row.appointment_date,startTime:row.start_time,endTime:row.end_time,status:row.status,symptoms:row.symptoms,onsetDate:row.onset_date,mentalAppetite:row.mental_appetite,bowelUrine:row.bowel_urine,notes:row.notes,clinicName:row.clinics?.name||'—',petName:row.pets?.name||'—'}
}
