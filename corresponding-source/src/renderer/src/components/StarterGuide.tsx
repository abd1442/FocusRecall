import { trackingConsented, TRACKING_DISCLOSURE, TRACKING_RECONFIRM } from '@core/trackingConsent'
import { t as uiText } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { followStudy, type GuideStep } from '@core/onboarding'
import { LanguageSettings } from './LanguageSettings'
import { StudyExperience } from './StudyExperience'
import { Button, Dialog } from './ui'
import { sessionCommand, useSession, useSettings } from '../store/session'
import { useUi } from '../store/ui'

export const STARTER_GUIDE_EVENT='focusrecall:starter-guide'
const copy:Record<Exclude<GuideStep,'welcome'>,[string,string]>={
  subject:['Choose your subject','Click a subject, or New subject to add what you want to study.'],
  mode:['Choose a timer','Flow counts up. Fixed counts down. Adaptive suggests a target from eligible records. Pick a mode here.'],
  start:['Start your session','Adjust the time if you like, then click Start. This will be your real study session.'],
  preparation:['Get ready','Your preparation window is open. The checks are optional. Click Ready to start there to begin the timer.'],
  focus:['You are studying','Your floating timer stays beside your work. Use Distracted if interrupted, or Switch to change subject. Click Finish session when you are done.'],
  keep:['Keep your short session','Choose Keep it to continue reviewing. Discard removes this session, so only choose it if that is what you intend.'],
  recall:['Review and connect','Recall the main ideas, use the optional timer, or open Type notes or Draw notes. Then click Continue to session log.'],
  log:['Record what matters','Answer the focus question if you want. Add more details opens setup and other questions. Skipped answers stay unanswered. Click Continue to rest.'],
  'rest-plan':['Plan your break','Choose the duration and optional playlist here. Click Start rest when ready.'],
  'rest-running':['Take a break','Take a comfortable break. Continue when the timer ends, or choose End rest early if needed.'],
  'rest-over':['Finish your break','Choose what you did, or Continue to next session without an answer.'],
  next:['Ready for another session','Confirm the subject and start again here, or Finish studying. You can now explore where your records go.'],
  history:['Your sessions and notes','History holds your session, recall and notes. Search or open a record to revisit it.'],
  stats:['Your study patterns','Stats uses your records. Early sessions may not support comparisons yet. Open the evidence behind findings as you build a history.']
}
function visible(e:Element):boolean {return e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[data-guided-coach]')}
function button(...labels:string[]):HTMLElement|null {return [...document.querySelectorAll<HTMLElement>('button')].find(e=>visible(e)&&labels.map(label=>uiText(label)).includes(e.textContent?.trim()??''))??null}
function anchor(step:GuideStep):HTMLElement|null {
  if(step==='subject')return document.querySelector<HTMLElement>('input[data-subject-name]')??document.querySelector<HTMLElement>('.home-subjects [role=option]')??button('New subject','Add your first subject')
  if(step==='mode')return button('Flow','Fixed','Adaptive')?.parentElement??[...document.querySelectorAll<HTMLElement>('button')].find(e=>visible(e)&&e.textContent?.includes(uiText('Timer options')))??null
  if(step==='start')return button('Start','Start next session')
  if(step==='focus')return button('Finish session')
  if(step==='keep')return button('Keep it')
  if(step==='recall')return button('Continue to session log')
  if(step==='log')return button('Continue to rest')
  if(step==='rest-plan')return button('Start rest')
  if(step==='rest-running')return button('End rest early')
  if(step==='rest-over')return button('Continue to next session')
  if(step==='next')return button('Start next session','Finish studying')
  if(step==='history')return document.querySelector<HTMLElement>('main input[type=search], main input')??document.querySelector('main h1')
  if(step==='stats')return document.getElementById('stats-personal')??document.querySelector('main h1')
  return null
}
type Box={x:number;y:number;width:number;height:number;vw:number;vh:number;zoom:number;modal:boolean}
export function StarterGuide():React.JSX.Element|null {
  const [open,setOpen]=useState(false),[step,setStep]=useState<GuideStep>('welcome'),[busy,setBusy]=useState(false),[box,setBox]=useState<Box|null>(null)
  const {settings,set}=useSettings(),state=useSession(s=>s.state),tab=useUi(s=>s.tab),lastId=useRef<number|null>(null)
  useEffect(()=>{
    let live=true
    void window.api.invoke('settings:getAll').then(s=>{if(live&&!s.starterGuideCompleted){setOpen(true);const current=useSession.getState().state;if(current.stage!=='idle')setStep(followStudy(current,'start',false,false))}})
    const replay=():void=>{setStep('welcome');setOpen(true)}
    window.addEventListener(STARTER_GUIDE_EVENT,replay)
    return ()=>{live=false;window.removeEventListener(STARTER_GUIDE_EVENT,replay)}
  },[])
  const finish=async():Promise<void>=>{if(busy)return;setBusy(true);const saved=await sessionCommand(()=>window.api.invoke('settings:set','starterGuideCompleted',true));if(saved)setOpen(false);setBusy(false)}
  const begin=async():Promise<void>=>{if(busy)return;if(settings.studyExperience==='quick'){await finish();return}setBusy(true);const saved=await sessionCommand(()=>window.api.invoke('settings:set','starterGuideCompleted',false));if(saved){lastId.current=saved.lastItemId;useUi.getState().exitToHome();setStep('subject')}setBusy(false)}
  useEffect(()=>{if(open&&step==='subject'&&settings.lastItemId!==null&&settings.lastItemId!==lastId.current)setStep('mode')},[open,step,settings.lastItemId])
  useEffect(()=>{
    if(!open||step==='welcome')return
    let preparing=false
    const update=():void=>{setStep(s=>followStudy(useSession.getState().state,s,preparing,!!button('Keep it')))}
    const off=window.api.on('preparation:changed',p=>{preparing=!!p;update()})
    void window.api.invoke('preparation:get').then(p=>{preparing=!!p;update()})
    const tick=window.setInterval(update,200)
    return ()=>{off();clearInterval(tick)}
  },[open,step==='welcome'])
  useEffect(()=>{
    if(!open||step==='welcome')return
    const click=(e:MouseEvent):void=>{
      const target=e.target instanceof Element?e.target:null;if(!target||target.closest('[data-guided-coach]'))return
      const b=target.closest('button'),text=b?.textContent?.trim()
      if(step==='subject'&&target.closest('[role=option]'))setStep('mode')
      if(step==='mode'&&text&&['Flow','Fixed','Adaptive'].map(label=>uiText(label)).includes(text))setStep('start')
    }
    document.addEventListener('click',click,true)
    return ()=>document.removeEventListener('click',click,true)
  },[open,step])
  useEffect(()=>{
    if(!open||step==='welcome')return
    let initial=true
    const measure=():void=>{
      const e=anchor(step),r=e?.getBoundingClientRect(),modal=!!document.querySelector('dialog[open]')
      if(initial&&e&&r&&(r.top<0||r.bottom>innerHeight)){e.scrollIntoView({block:'center',behavior:'instant'});initial=false;return}initial=false
      const rect=e?.getBoundingClientRect(),next={x:rect?.left??0,y:rect?.top??0,width:rect?.width??0,height:rect?.height??0,vw:innerWidth,vh:innerHeight,zoom:parseFloat(document.documentElement.style.zoom)||1,modal}
      setBox(old=>JSON.stringify(old)===JSON.stringify(next)?old:next)
    }
    measure();const timer=window.setInterval(measure,200)
    return ()=>clearInterval(timer)
  },[open,step,tab])
  useEffect(()=>{if(open&&step!=='welcome'&&tab==='history')setStep('history');if(open&&step!=='welcome'&&tab==='stats')setStep('stats')},[tab,open])
  if(!open||state.recovery)return null
  if(step==='welcome')return <Dialog title={uiText("Let’s start your first session")} onClose={()=>void finish()}><div className="flex flex-col gap-5"><LanguageSettings/><StudyExperience/><p>{uiText(settings.studyExperience==='quick'?'Choose a subject and start. Finish saves and stops.':'I’ll point to the controls as you use them, from choosing a subject to reviewing and taking a break.')}</p>{settings.studyExperience!=='quick'&&<p className="text-sm text-muted">{uiText("You stay in control. The guide won’t create sample sessions or answer questions for you. Skip anytime.")}</p>}<label className="rounded-xl border border-line bg-focus/5 p-4"><span className="flex min-h-11 items-center justify-between gap-4 font-semibold">{uiText("Automatic tracking · ")}{trackingConsented(settings)?uiText("On"):uiText("Off")}<input type="checkbox" className="size-5" checked={trackingConsented(settings)} onChange={e=>void set('foregroundTrackingEnabled',e.target.checked)}/></span><span className="tracking-disclosure block text-sm text-muted">{uiText(TRACKING_DISCLOSURE)} {uiText("Window titles have a separate opt-in switch in Settings.")}</span>{settings.foregroundTrackingEnabled&&!trackingConsented(settings)&&<span className="mt-2 block text-sm text-muted">{uiText(TRACKING_RECONFIRM)}</span>}</label><div className="flex justify-between gap-3">{/* Quick has no guide to skip: one button. */}{settings.studyExperience==='quick'?<span/>:<Button disabled={busy} onClick={()=>void finish()}>{uiText("Skip guide")}</Button>}<Button variant="primary" disabled={busy} onClick={()=>void begin()}>{uiText(settings.studyExperience==='quick'?'Start studying':'Show me')}</Button></div></div></Dialog>
  if(!box||box.modal)return null
  const creating=step==='subject'&&!!document.querySelector('input[data-subject-name]')
  const [title,text]=creating?['Name your subject','Enter a name, then click Add. Category and progress details are optional.']:step==='next'&&!state.sitting?['Your session is saved','Open History to find your session and notes, then explore Stats.']:copy[step],z=box.zoom,w=Math.min(340*z,box.vw-24),h=290*z
  const valid=box.width>0&&box.height>0&&box.y<box.vh&&box.y+box.height>0
  const x=Math.max(12,Math.min(box.vw-w-12,valid?box.x:box.vw-w-20))
  const y=Math.max(12,Math.min(box.vh-h-12,valid?(box.y+box.height+h+16<box.vh?box.y+box.height+12:box.y-h-12):24))
  return createPortal(<div data-guided-coach style={{position:'fixed',inset:0,zIndex:1000,pointerEvents:'none'}}>
    {valid&&<div aria-hidden="true" className="rounded-xl border-[3px] border-focus" style={{position:'fixed',left:(box.x-5)/z,top:(box.y-5)/z,width:(box.width+10)/z,height:(box.height+10)/z,boxShadow:'0 0 0 9999px rgb(0 0 0 / .16)',pointerEvents:'none'}}/>}
    <aside aria-label={uiText("Guided start")} className="rounded-2xl border-2 border-focus bg-surface p-5 text-ink shadow-2xl" style={{position:'fixed',left:x/z,top:y/z,width:w/z,maxHeight:(box.vh-24)/z,overflowY:'auto',pointerEvents:'auto'}}>
      <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wider text-focus">{uiText("Guided start")}</span><button disabled={busy} type="button" className="min-h-11 px-2 text-sm text-muted" onClick={()=>void finish()}>{uiText("Skip guide")}</button></div>
      <h2 className="text-xl font-semibold" aria-live="polite">{uiText(title)}</h2><p className="mt-2 text-sm leading-relaxed">{uiText(text)}</p>
      <p className="mt-3 text-sm font-medium text-focus">{valid?(y<box.y?uiText("↓ Use the highlighted control"):uiText("↑ Use the highlighted control")):uiText("Follow the open study screen")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {step==='subject'&&settings.lastItemId!==null&&<Button onClick={()=>setStep('mode')}>{uiText("Use selected subject")}</Button>}
        {step==='mode'&&<Button onClick={()=>setStep('start')}>{uiText("Keep this mode")}</Button>}
        {(step==='next'||step==='history')&&<Button onClick={()=>{useUi.getState().exitToHome();useUi.getState().setTab(step==='next'?'history':'stats');setStep(step==='next'?'history':'stats')}}>{step==='next'?uiText("See my history"):uiText("See Stats")}</Button>}
        {step==='stats'&&<Button variant="primary" disabled={busy} onClick={()=>void finish()}>{uiText("Finish guide")}</Button>}
      </div>
    </aside>
  </div>,document.body)
}
