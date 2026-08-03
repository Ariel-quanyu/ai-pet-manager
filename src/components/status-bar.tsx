import { Text, View } from '@tarojs/components'
import './status-bar.scss'
export function StatusBar({ light=false }: { light?: boolean }) { return <View className={`status safe-top ${light?'status--light':''}`}><Text>12:00</Text><View className='status__signals'><Text>▮▮▮</Text><Text>⌁</Text><Text>▱</Text></View></View> }
