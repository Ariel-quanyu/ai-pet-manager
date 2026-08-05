import { describe, expect, it } from 'vitest'
import { buildAppointmentDates, isAppointmentReady, validateAppointment, type AppointmentForm } from '../domain/appointment'
import { distanceInKilometres, formatDistance, normalizeCityName } from '../domain/location'

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

describe('clinic location helpers',()=>{
  it('normalizes city names for matching',()=>{
    expect(normalizeCityName('苏州市')).toBe('苏州')
    expect(normalizeCityName(' 苏州 ')).toBe('苏州')
  })
  it('calculates and formats clinic distance',()=>{
    const distance=distanceInKilometres({latitude:31.2304,longitude:121.4737},{latitude:31.2243,longitude:121.4768})
    expect(distance).toBeGreaterThan(0.6)
    expect(distance).toBeLessThan(0.9)
    expect(formatDistance(distance)).toMatch(/m$/)
    expect(formatDistance(2.34)).toBe('2.3km')
  })
})
