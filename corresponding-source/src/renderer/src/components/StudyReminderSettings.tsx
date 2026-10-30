import { t as uiText, formatDateTime } from '../i18n'
import { useEffect,useState } from 'react'
import type { ReminderStatus } from '@core/studyReminders'
import { Button,inputBase } from './ui'
import { useSettings } from '../store/session'

export function StudyReminderSettings({Section,Row}:{
  Section:(p:{title:string;children:React.ReactNode})=>React.JSX.Element
  Row:(p:{label:string;hint?:string;keywords?:string;children:React.ReactNode})=>React.JSX.Element|null
}):React.JSX.Element {
  const {settings,set}=useSettings(),[status,setStatus]=useState<ReminderStatus|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  useEffect(()=>{
    let live=true
    const refresh=():void=>{void window.api.invoke('studyReminders:status').then(s=>{if(live)setStatus(s)}).catch(()=>{if(live)setMessage(uiText('Reminder status could not be loaded.'))})}
    refresh();const timer=setInterval(refresh,30000);return()=>{live=false;clearInterval(timer)}
  },[settings.studyReminderDailyEnabled,settings.studyReminderDailyTime,settings.studyReminderSmartEnabled,settings.studyReminderQuietStart,settings.studyReminderQuietEnd])
  const action=async(mode:'test'|'hour'|'today'|'resume'):Promise<void>=>{
    setBusy(true);setMessage('')
    try{
      const result=await(mode==='test'?window.api.invoke('studyReminders:test'):window.api.invoke('studyReminders:pause',mode))
      setStatus(result);if(mode==='test')setMessage(result.lastError??uiText('Sent. No banner? Check Windows notifications.'))
    }catch(e){setMessage(e instanceof Error?e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/,''):String(e))}
    finally{setBusy(false)}
  }
  const toggle=(label:string,checked:boolean,change:(v:boolean)=>void):React.JSX.Element=><input type="checkbox" aria-label={uiText(label)} className="size-5 accent-focus" checked={checked} disabled={status?.supported===false} onChange={e=>change(e.target.checked)}/>
  const time=(label:string,value:string,change:(v:string)=>void):React.JSX.Element=><input type="time" aria-label={uiText(label)} className={`${inputBase} w-36`} value={value} onChange={e=>{if(e.target.value)change(e.target.value)}}/>
  return <Section title="Study reminders">
    <Row label="Daily study reminder" keywords="notification notify schedule clock daily reminder" hint={uiText("Once a day, when you are active.")}>{toggle('Daily study reminder',settings.studyReminderDailyEnabled,v=>{void set('studyReminderDailyEnabled',v)})}</Row>
    <Row label="Daily reminder time" hint={uiText("Local time · independent of quiet hours.")}>{time('Daily reminder time',settings.studyReminderDailyTime,v=>{void set('studyReminderDailyTime',v)})}</Row>
    <Row label="Personal study reminders" keywords="best time focus activity smart notifications" hint={uiText('Personal timing suggestions are unavailable because exploratory records do not establish a reliable personal schedule. Your daily reminder remains available.')}><input type="checkbox" aria-label={uiText('Personal study reminders')} checked={settings.studyReminderSmartEnabled} disabled={!settings.studyReminderSmartEnabled} onChange={()=>{void set('studyReminderSmartEnabled',false)}}/></Row>
    <Row label="Reminder controls" hint={uiText("At least four hours apart. Paused during study or inactivity.")}>
      <div className="flex flex-wrap gap-2"><Button variant="quiet" disabled={busy||status?.supported===false} onClick={()=>{void action('test')}}>{uiText("Test notification")}</Button><Button variant="quiet" disabled={busy} onClick={()=>{void action('hour')}}>{uiText("Pause 1 hour")}</Button><Button variant="quiet" disabled={busy} onClick={()=>{void action('today')}}>{uiText("Pause today")}</Button>{status&&status.pausedUntil>Date.now()&&<Button variant="quiet" disabled={busy} onClick={()=>{void action('resume')}}>{uiText("Resume reminders")}</Button>}</div>
    </Row>
    <Row label="Reminders run in the tray" hint={uiText("Close hides to tray when reminders are on. Quit stops reminders. Open A14 Pomodoro after restarting Windows.")}>
      <div className="max-w-md space-y-2 text-sm text-muted"><p>{uiText("Uses active/idle status only, not app names or window titles.")}</p>{status?.supported===false&&<p role="status">{uiText("Windows notifications are unavailable on this system.")}</p>}{status&&status.pausedUntil>Date.now()&&<p>{uiText("Paused until ")}{formatDateTime(new Date(status.pausedUntil))}.</p>}{(message||status?.lastError)&&<p role="status">{message||status?.lastError}</p>}</div>
    </Row>
  </Section>
}
