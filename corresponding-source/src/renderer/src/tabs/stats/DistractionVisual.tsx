import { t as uiText, currentLanguage } from '../../i18n'
import type { PersonalInsight } from '@core/personalInsights'
import { distractionDuration,distractionTimeParts } from '@core/distractionPresentation'

export function DistractionMetricIcon({duration,className='size-5'}:{duration:boolean;className?:string}):React.JSX.Element {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{duration?<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>:<><path d="M5 5v14M10 5v14M15 5v14M20 5v14M3 16l19-8"/></>}</svg>
}

/** Ranked magnitudes use the recorded values; time and event counts stay distinct. */
export function DistractionVisual({c}:{c:PersonalInsight}):React.JSX.Element {
 const language=currentLanguage(),number=new Intl.NumberFormat(language),duration=c.unit==='minutes'
 const total=c.total??c.rows.reduce((n,r)=>n+r.value,0)
 const rows=duration?distractionTimeParts(c.rows,total).map(p=>({label:p.label,value:p.minutes})):c.rows.slice(0,3)
 const ceiling=Math.max(1,...rows.map(r=>r.value)),value=(v:number)=>duration?distractionDuration(v,language):number.format(v)
 return <div className="distraction-ranking" data-distraction-metric={duration?'duration':'frequency'}><div className={`distraction-total ${duration?'text-overtime':'text-focus'}`}><DistractionMetricIcon duration={duration} className="size-6"/><div><strong>{value(total)}</strong><p>{duration?uiText('Total paused time'):uiText('recorded ')+(total===1?uiText('interruption'):uiText('interruptions'))}</p></div></div><ol aria-label={uiText(duration?'Paused time by reason':'Interruption counts by reason')}>{rows.map(row=><li key={row.label}><div><span>{row.label==='Other reasons'?uiText('Other reasons'):row.label}</span><strong>{value(row.value)}</strong></div><div className="distraction-rank-track" aria-hidden="true"><i style={{width:`${100*row.value/ceiling}%`,background:duration?'var(--tf-overtime)':'var(--tf-focus)'}}/></div></li>)}</ol></div>
}
