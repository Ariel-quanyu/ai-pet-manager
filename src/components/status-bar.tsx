import { View } from '@tarojs/components'
import './status-bar.scss'
export function StatusBar({light=false}:{light?:boolean}) { return <View className={`status safe-top ${light?'status--light':''}`} /> }
