export interface Coordinates { latitude:number; longitude:number }

export const normalizeCityName=(city:string)=>city.trim().replace(/市$/u,'')

export function distanceInKilometres(from:Coordinates,to:Coordinates):number{
  const radians=(value:number)=>value*Math.PI/180
  const earthRadius=6371
  const latitudeDelta=radians(to.latitude-from.latitude)
  const longitudeDelta=radians(to.longitude-from.longitude)
  const a=Math.sin(latitudeDelta/2)**2+
    Math.cos(radians(from.latitude))*Math.cos(radians(to.latitude))*Math.sin(longitudeDelta/2)**2
  return earthRadius*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
}

export const formatDistance=(kilometres:number)=>kilometres<1?`${Math.round(kilometres*1000)}m`:`${kilometres.toFixed(1)}km`
