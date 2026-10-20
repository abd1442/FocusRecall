import { formatDuration } from './timer'
import { localizedDuration } from './localizedDuration'
import type { AppLanguage } from './localization'

/** Analytics stores duration in minutes; preserve short interruptions on screen. */
export function distractionDuration(minutes:number,language:AppLanguage='en'):string {
  const seconds=Math.max(0,minutes*60)
  return seconds>0&&seconds<0.5?'<'+localizedDuration(1,language):language==='en'?formatDuration(seconds):localizedDuration(seconds,language)
}

/** Keep the whole recorded total visible, including reasons outside the top three. */
export function distractionTimeParts(rows:readonly {label:string;value:number}[],total:number):{label:string;minutes:number;share:number}[] {
  const parts=rows.slice(0,3).map(r=>({label:r.label,minutes:r.value,share:total>0?r.value/total:0}))
  const remaining=total-parts.reduce((n,p)=>n+p.minutes,0)
  if(remaining>1e-8)parts.push({label:'Other reasons',minutes:remaining,share:remaining/total})
  return parts
}
