import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { BottomNav } from '@/components/bottom-nav'
import { StatusBar } from '@/components/status-bar'
import { petRepository } from '@/services/pet-repository'
import type { Pet } from '@/domain/pet'
import './index.scss'
const shortcuts=[['▣','AI宠物管家'],['▤','计次卡'],['✪','积分商城'],['▱','其他']]
export default function HomePage(){
 const [pets,setPets]=useState<Pet[]>(petRepository.list()); useDidShow(()=>setPets(petRepository.list())); const pet=pets[0]
 const add=()=>Taro.navigateTo({url:'/features/pet/add'})
 return <View className='home page'><View className='home__hero'><StatusBar light/><View className='home__welcome'><Text className='home__hello'>Hello</Text><Text>欢迎来到宠物管家小程序</Text></View></View><View className='pet-panel section-card'>{pet?<><View className='pet-panel__heading'><Text>我的宠物档案</Text><Text className='pet-panel__new' onClick={add}>＋ 新增</Text></View><View className='pet-summary'><View className='pet-summary__avatar'>{pet.avatar?<Text>🐶</Text>:<Text>{pet.type.includes('猫')?'🐈':'🐕'}</Text>}</View><View><Text className='pet-summary__name'>{pet.name}</Text><Text className='pet-summary__days'>已经陪伴你 {Math.max(1,Math.floor((Date.now()-new Date(pet.createdAt).getTime())/86400000)+1)} 天了</Text><View className='pet-summary__tags'><Text>{pet.breed||pet.type}</Text><Text>{pet.birthday?'已记录生日':'新朋友'}</Text></View></View></View></>:<View className='pet-empty'><Text className='pet-empty__icon'>▣</Text><Text>还没有宠物档案，马上去新增吧～</Text></View>}<View className='pet-panel__add' onClick={add}>＋</View></View><View className='shortcuts'>{shortcuts.map(([icon,label])=><View className='shortcut' key={label}><Text className='shortcut__icon'>{icon}</Text><Text>{label}</Text></View>)}</View><View className='services'><View className='service service--clinic'><Text className='service__symbol'>✚</Text><Text className='service__title'>门诊预约</Text><Text className='service__en'>APPOINTMENTS</Text><View className='service__art'>♨</View></View><View className='service service--groom'><Text className='service__symbol'>✂</Text><Text className='service__title'>美容预约</Text><Text className='service__en'>PET GROOMING</Text><View className='service__art'>♧</View></View></View><BottomNav/></View>
}
