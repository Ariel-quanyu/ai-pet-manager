import { describe, expect, it, vi } from 'vitest'
import { createPet, validateRequiredPet, type PetDraft } from './pet'
const valid: PetDraft = { name: ' 汪汪 ', type: '狗狗', sex: 'male' }
describe('pet domain', () => {
  it('requires name and type', () => expect(validateRequiredPet({ name:'', type:'', sex:'unknown' })).toEqual(['请输入宠物昵称','请选择宠物类型']))
  it('normalizes a created pet', () => { vi.setSystemTime(new Date('2026-08-03')); expect(createPet(valid)).toMatchObject({ id:'pet-1785715200000', name:'汪汪', type:'狗狗' }); vi.useRealTimers() })
})
