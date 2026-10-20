import { useEffect, useState } from 'react'
import { StudyDayClock } from '@core/dayClock'
import { localCalendarDay } from '@core/homePreferences'

export function useLocalCalendarDay():string {
  const [day,setDay]=useState(()=>localCalendarDay())
  useEffect(()=>{
    const clock=new StudyDayClock(()=> '00:00',setDay)
    clock.recheck()
    window.addEventListener('focus',clock.recheck)
    document.addEventListener('visibilitychange',clock.recheck)
    const off=window.api.on('clock:changed',clock.recheck)
    return()=>{clock.stop();off();window.removeEventListener('focus',clock.recheck);document.removeEventListener('visibilitychange',clock.recheck)}
  },[])
  return day
}
