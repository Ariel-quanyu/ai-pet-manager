import { Text, View } from '@tarojs/components'
import './bottom-nav.scss'
export function BottomNav() { return <View className='bottom-nav'><View className='bottom-nav__item active'><Text className='bottom-nav__icon'>◆</Text><Text>首页</Text></View><View className='bottom-nav__item'><Text className='bottom-nav__icon'>▤</Text><Text>门店</Text></View><View className='bottom-nav__item'><Text className='bottom-nav__icon'>♙</Text><Text>我的</Text></View></View> }
