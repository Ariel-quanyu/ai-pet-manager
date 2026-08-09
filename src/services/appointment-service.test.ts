import { describe, expect, it, vi } from 'vitest'
import type { AppointmentForm } from '@/domain/appointment'

const mocks = vi.hoisted(() => ({ rest: vi.fn(), upsertPet: vi.fn() }))
vi.mock('./supabase-rest', () => ({ supabaseRest: mocks.rest }))
vi.mock('./pet-repository', () => ({ upsertCloudPet: mocks.upsertPet }))

import { bookAppointment } from './appointment-service'

describe('bookAppointment pet synchronization', () => {
  it('reuses the shared cloud upsert and books with the returned database pet id', async() => {
    const pet = { id:'client-pet',name:'招财',type:'猫咪',sex:'unknown' as const,createdAt:'2026-08-01T00:00:00Z' }
    const form: AppointmentForm = {
      clinic:{id:'clinic',name:'门店',address:'地址'}, pet,
      slot:{id:'slot',startTime:'09:00',endTime:'10:00',capacity:1,booked:0,available:true},
      date:'2026-08-10',symptoms:'咳嗽',onsetDate:'2026-08-09',mentalAppetite:'正常',bowelUrine:'正常',notes:'',
    }
    mocks.upsertPet.mockResolvedValue('database-pet-id')
    mocks.rest.mockResolvedValue('appointment-id')

    await expect(bookAppointment(form)).resolves.toBe('appointment-id')
    expect(mocks.upsertPet).toHaveBeenCalledWith(pet)
    expect(mocks.rest).toHaveBeenCalledWith('rpc/book_clinic_appointment', expect.objectContaining({
      body: expect.objectContaining({ p_pet_id: 'database-pet-id' }),
    }))
  })
})
