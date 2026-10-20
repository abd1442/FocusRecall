import { useState } from 'react'
import { distractedSince } from '@core/session'
import { t } from '../i18n'
import { sessionCommand, useSession } from '../store/session'
import { MODES, useNextBlockPlan } from '../store/plan'
import { ItemPicker } from '../components/ItemPicker'
import { LengthForMode, ModeControl } from '../components/TimerControls'
import { Button } from '../components/ui'
import './quickStudy.css'

/**
 * A small launcher and keyboard alternative to the floating timer. The plan
 * card and the subject list sit side by side when there is room and stack in
 * a narrow window; quickStudy.css owns the proportions at every size.
 */
export function QuickStudy():React.JSX.Element {
 const state=useSession(s=>s.state)
 const [override,setOverride]=useState<number|null>(null)
 const plan=useNextBlockPlan(override),paused=state.running&&distractedSince(state.running)!==null
 const action=(destination:'break'|'finish'):void=>{if(state.running)void sessionCommand(()=>window.api.invoke('session:quickAction',destination,state.running!.id))}
 const showTimer=<Button variant="ghost" className="ql-show-timer" onClick={()=>void sessionCommand(()=>window.api.invoke('settings:set','panelOpen',true))}>{t('Show timer')}</Button>
 const header=<header className="ql-head"><h1>{t('Quick Mode')}</h1><p>{t('Choose a subject and start. Finish saves and stops.')}</p></header>
 if(state.running)return <div className="quick-launcher" data-state="running"><div className="ql-frame ql-frame-single">{header}
  <section className="ql-card ql-live" aria-labelledby="ql-live-subject" style={{'--ql-tint':state.running.itemColor} as React.CSSProperties}>
   <p className="ql-eyebrow" role="status"><span className="ql-dot" data-paused={paused||undefined} aria-hidden/>{t(paused?'Paused':'Studying')}</p>
   <h2 id="ql-live-subject" dir="auto" className="ql-subject">{state.running.itemName}</h2>
   <div className="ql-actions"><Button variant="primary" onClick={()=>void sessionCommand(()=>window.api.invoke('session:toggleDistracted'))}>{t(paused?'Resume':'Distracted')}</Button>{paused?<Button onClick={()=>action('break')}>{t('Break')}</Button>:<Button onClick={()=>void window.api.invoke('ui:openSwitch')}>{t('Switch')}</Button>}<Button onClick={()=>action('finish')}>{t('Finish')}</Button></div>
   {showTimer}
  </section></div></div>
 if(state.rest)return <div className="quick-launcher" data-state="rest"><div className="ql-frame ql-frame-single">{header}
  <section className="ql-card ql-live" aria-labelledby="ql-rest-title">
   <p className="ql-eyebrow"><span className="ql-dot" data-rest aria-hidden/>{t('Quick Mode')}</p>
   <h2 id="ql-rest-title" className="ql-subject">{t(state.rest.phase==='over'?'Break over':'Break')}</h2>
   <div className="ql-actions ql-actions-pair"><Button variant="primary" onClick={()=>void sessionCommand(()=>window.api.invoke('rest:startNextBlock'))}>{t('Resume')}</Button><Button onClick={()=>void sessionCommand(()=>window.api.invoke('session:finishStudying'))}>{t('Finish studying')}</Button></div>
   {showTimer}
  </section></div></div>
 const subject=plan.subject,minutes=Math.max(1,Math.round(plan.targetSeconds/60)),mode=MODES.find(m=>m.value===plan.mode)
 return <div className="quick-launcher" data-state="idle"><div className="ql-frame">{header}
  <div className="ql-body">
   <section className="ql-card ql-plan" aria-label={t('Ready')} style={subject?{'--ql-tint':subject.color} as React.CSSProperties:undefined}>
    <div className="ql-plan-main">
    <div className="ql-plan-summary">
     <p className="ql-eyebrow"><span className="ql-dot" aria-hidden/>{t('Ready')}</p>
     <h2 dir="auto" className="ql-subject" data-empty={!subject||undefined}>{subject?.name??t('Choose a subject')}</h2>
     <p className="ql-readout"><span className="ql-number">{minutes}</span><span className="ql-unit">{t('min')}</span><span className="ql-mode">{mode?t(mode.label):''}</span></p>
     {mode&&<p className="ql-hint">{t(mode.hint)}</p>}
    </div>
    <details className="ql-options"><summary>{t('Timer options')}</summary><div className="ql-options-body"><ModeControl value={plan.mode} onChange={plan.setMode} itemId={subject?.id??null} targetSeconds={plan.targetSeconds}/><LengthForMode plan={plan} adaptiveOverride={override} setAdaptiveOverride={setOverride}/></div></details>
    </div>
    <Button variant="primary" className="ql-start" disabled={!subject} onClick={()=>void sessionCommand(()=>window.api.invoke('preparation:begin',{itemId:subject!.id,timerMode:plan.mode,targetSeconds:plan.targetSeconds}))}>{t('Start')}</Button>
   </section>
   <section className="ql-picker" aria-label={t('Subjects')}><ItemPicker homeOrdering selectedId={subject?.id??null} onSelect={i=>plan.setSubject(i.id)}/></section>
  </div></div></div>
}
