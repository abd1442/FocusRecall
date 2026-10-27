import { parseDayStart, studyDayKey } from '@core/studyDay'
import { useMemo, useState, type CSSProperties } from 'react'
import sakuraArtwork from './sakura-goal.svg?raw'
import { dailyGoalProgress } from '@core/dailyGoal'
import { useNow } from '../hooks'
import { useBlocks } from '../store/blocks'
import { useSession, useSettings } from '../store/session'
import { t, formatDuration } from '../i18n'
import { Button, inputBase } from './ui'
import './dailyGoal.css'

export function DailyStudyGoal():React.JSX.Element {
 const {settings}=useSettings(),running=useSession(s=>s.state.running),blocks=useBlocks(s=>s.blocks),loaded=useBlocks(s=>s.loaded)
 const now=useNow(true,1000),day=studyDayKey(new Date(now),parseDayStart(settings.dayStart))
 // History is aggregated only on refresh, day rollover or subject switch.
 const recorded=useMemo(()=>dailyGoalProgress(blocks.filter(b=>b.id!==running?.id),null,now,settings.dayStart,0).seconds,[blocks,running?.id,day,settings.dayStart])
 const progress=dailyGoalProgress([],running,now,settings.dayStart,settings.dailyStudyGoalMinutes,recorded)
 const [editing,edit]=useState(false),[hours,setHours]=useState('3'),[saving,save]=useState(false),[error,setError]=useState('')
 const enabled=settings.dailyStudyGoalMinutes>0
 const messages=['Every bit of focus counts.','You have made a start.','Halfway to your goal.','Your goal is getting closer.','Daily goal reached. Well done!']
 async function commit(minutes:number):Promise<void>{save(true);setError('');try{const next=await window.api.invoke('settings:set','dailyStudyGoalMinutes',minutes);useSettings.setState({settings:next});edit(false)}catch{setError(t('Could not save. Try again.'))}finally{save(false)}}
 return <section className={`daily-goal ${enabled&&!editing?'daily-goal-growing':''}`} aria-labelledby="daily-goal-heading"><header className="flex items-center justify-between gap-3"><h2 id="daily-goal-heading" className="font-semibold">{t('Daily study goal')}</h2>{enabled&&!editing&&<Button size="sm" variant="ghost" onClick={()=>{setHours(String(settings.dailyStudyGoalMinutes/60));edit(true)}}>{t('Edit')}</Button>}</header>
 {(!enabled||editing)?<form onSubmit={e=>{e.preventDefault();const minutes=Math.round(Number(hours)*60);if(minutes>=15&&minutes<=1440)void commit(minutes)}} className="mt-3 flex flex-col gap-3"><p className="text-sm text-muted">{t('Choose a target that fits your day.')}</p><label className="flex flex-wrap items-center gap-3 text-sm">{t('Daily target (hours)')}<input className={`${inputBase} w-24`} type="number" min="0.25" max="24" step="0.25" required value={hours} onChange={e=>setHours(e.target.value)}/></label><div className="flex flex-wrap gap-2"><Button type="submit" size="sm" variant="primary" disabled={saving}>{t('Save goal')}</Button>{enabled&&<><Button size="sm" onClick={()=>edit(false)}>{t('Cancel')}</Button><Button size="sm" disabled={saving} onClick={()=>void commit(0)}>{t('Turn off')}</Button></>}</div></form>:<>
 <div className="daily-goal-body"><div aria-hidden="true" className="goal-sakura" data-stage={progress.stage} style={{'--progress':loaded?progress.ratio*100:0} as CSSProperties} dangerouslySetInnerHTML={{__html:sakuraArtwork}}/>
 <div className="min-w-0"><p className="text-lg font-semibold">{loaded?formatDuration(progress.seconds):'—'} <span className="text-sm font-normal text-muted">/ {formatDuration(progress.target)}</span></p><p aria-live="polite" aria-atomic="true" className="mt-1 text-sm text-muted">{t(messages[progress.stage])}</p></div></div>
 <div role="progressbar" aria-label={t('Daily study goal')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.ratio*100)} aria-valuetext={t('{done} of {target}',{done:formatDuration(progress.seconds),target:formatDuration(progress.target)})} className="daily-goal-track"><span style={{width:`${progress.ratio*100}%`}}/></div>
 <p className="mt-2 text-xs text-muted">{t('Recorded Focus time. Study day starts at {time}.',{time:settings.dayStart})}</p></>}
 {error&&<p role="alert" className="text-sm text-status-error">{error}</p>}
 </section>
}
