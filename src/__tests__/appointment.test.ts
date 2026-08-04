import { describe, expect, it } from 'vitest'
import { buildAppointmentDates, isAppointmentReady, validateAppointment, type AppointmentForm } from '../domain/appointment'

const empty:AppointmentForm={clinic:null,date:'',slot:null,pet:null,symptoms:'',onsetDate:'',mentalAppetite:'',bowelUrine:'',notes:''}

describe('appointment domain',()=>{
  it('builds fourteen dynamic dates without mutating the input',()=>{
    const now=new Date(2026,7,4)
    const dates=buildAppointmentDates(now)
    expect(dates).toHaveLength(14)
    expect(dates[0]).toMatchObject({iso:'2026-08-04',label:'今天',weekday:'周二'})
    expect(dates[2].label).toBe('后天')
    expect(now.getDate()).toBe(4)
  })
  it('keeps incomplete forms disabled',()=>{
    expect(isAppointmentReady(empty)).toBe(false)
    expect(validateAppointment(empty)).toBe('请选择门店')
  })
  it('accepts a complete valid form',()=>{
    const form:AppointmentForm={clinic:{id:'c',name:'门店',address:'地址'},date:'2026-08-04',slot:{id:'s',startTime:'09:30',endTime:'10:30',capacity:1,booked:0,available:true},pet:{id:'p',name:'汪汪',type:'狗狗',sex:'unknown',createdAt:'2026-01-01'},symptoms:'咳嗽',onsetDate:'2026-08-01',mentalAppetite:'正常',bowelUrine:'正常',notes:''}
    expect(validateAppointment(form)).toBeNull()
    expect(isAppointmentReady(form)).toBe(true)
  })
})
