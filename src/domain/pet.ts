export type PetSex = 'male' | 'female' | 'unknown'
export type NeuterStatus = 'yes' | 'no' | 'unknown'
export interface PetDraft { name: string; type: string; sex: PetSex; avatar?: string; birthday?: string; weight?: string; breed?: string; coat?: string; neuter?: NeuterStatus }
export interface Pet extends PetDraft { id: string; createdAt: string }
export const validateRequiredPet = (pet: PetDraft): string[] => {
  const errors: string[] = []
  if (!pet.name.trim()) errors.push('请输入宠物昵称')
  if (!pet.type.trim()) errors.push('请选择宠物类型')
  return errors
}
export const createPet = (draft: PetDraft): Pet => ({ ...draft, name: draft.name.trim(), id: `pet-${Date.now()}`, createdAt: new Date().toISOString() })
