import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { StatusBar } from '@/components/status-bar'
import type { Pet } from '@/domain/pet'
import { petRepository } from '@/services/pet-repository'
import './index.scss'

export default function SelectPetPage(){
  const pets=petRepository.list()
  const select=(pet:Pet)=>{Taro.setStorageSync('appointment:selected-pet',pet);Taro.navigateBack()}
  return <View className='select-pet page'><StatusBar/><View className='select-pet__nav'><Text onClick={()=>Taro.navigateBack()}>‹</Text><Text>选择宠物</Text><Text>•••</Text></View><View className='select-pet__body'>{pets.length===0?<View className='select-pet__empty'><Text>还没有宠物档案</Text><View className='select-pet__add' onClick={()=>Taro.navigateTo({url:'/features/pet/add'})}>去添加宠物</View></View>:pets.map(pet=><View className='pet-option' key={pet.id} onClick={()=>select(pet)}><View className='pet-option__avatar'>{pet.type.includes('猫')?'🐈':'🐕'}</View><View><Text className='pet-option__name'>{pet.name}</Text><Text className='pet-option__meta'>{pet.breed||pet.type} · {pet.sex==='male'?'弟弟':pet.sex==='female'?'妹妹':'性别未知'}</Text></View><Text className='pet-option__arrow'>›</Text></View>)}</View></View>
}
