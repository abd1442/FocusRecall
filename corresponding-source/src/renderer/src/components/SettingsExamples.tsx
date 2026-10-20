import { t as uiText } from '../i18n'
import { useState } from 'react'
import { planRest } from '@core/rest'
import { useSettings } from '../store/session'

/** Demonstrations never write settings or start a study session. */
export function TimerExample(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const [mode, setMode] = useState<'flow' | 'fixed' | 'adaptive'>(settings.defaultTimerMode)
  const [replay, setReplay] = useState(0)
  const copy = {
    flow: ['A target you can go past', 'Counts focused time upward. Reaching the target gives a nudge; you decide when to finish.'],
    fixed: ['A countdown with room to continue', 'Counts down to your chosen length. You can keep studying after it reaches zero.'],
    adaptive: ['A target based on this subject', 'Uses recent good sessions on the subject. Until five qualify, it uses your default target.']
  }
  return <div className="explanation-card m-6 rounded-xl border border-focus/20 bg-focus/5 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{uiText("See how the timer works")}</h3><span className="text-sm text-muted">{uiText("Preview only · changes no settings")}</span></div>
    <div className="mt-4 grid gap-5 md:grid-cols-2"><div>
      <div className="flex flex-wrap gap-2">{(['flow','fixed','adaptive'] as const).map((m) => <button key={m} type="button" aria-label={uiText("Preview {value0} timer", {value0: (m)})} aria-pressed={mode===m} className={`rounded-lg border px-3 py-2 text-sm capitalize ${mode===m?'border-focus bg-focus/10 text-focus':'border-line bg-surface'}`} onClick={() => setMode(m)}>{m}</button>)}</div>
      <p className="mt-4 font-medium">{copy[mode][0]}</p><p className="mt-1 text-sm text-muted">{copy[mode][1]}</p>
    </div><div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><span className="font-timer text-3xl text-focus">{mode==='fixed'?settings.fixedMinutes:settings.focusTargetMinutes}:00</span><button type="button" className="text-sm text-focus" onClick={() => setReplay((n) => n+1)}>{uiText("Replay preview")}</button></div>
      <div aria-hidden="true" className="relative h-5 overflow-hidden rounded-full bg-surface-2"><div key={`${mode}-${replay}`} className="example-fill h-full rounded-full bg-focus" style={{width:mode==='flow'?'100%':'85%'}}/><span className="absolute top-0 right-[15%] h-full border-l-2 border-ink/50"/></div>
      <div className="mt-2 flex justify-between text-xs text-muted"><span>{uiText("Start")}</span><span>{mode==='flow'?uiText("Target → keep going"):uiText("Chosen target")}</span></div>
    </div></div>
  </div>
}

export function RestExample(): React.JSX.Element {
  const rules = useSettings((s) => s.settings.restRules)
  const [minutes, setMinutes] = useState(25)
  const [number, setNumber] = useState(1)
  const plan = planRest(minutes*60,number-1,rules)
  return <div className="explanation-card m-6 rounded-xl border border-rest/20 bg-rest/5 p-5">
    <div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold">{uiText("Try your rest rules")}</h3><span className="text-sm text-muted">{uiText("Example · uses your current rules")}</span></div>
    <div className="mt-4 grid items-center gap-5 md:grid-cols-2"><div><label className="block text-sm">{uiText("Example focus time: ")}<strong>{minutes}{uiText(" min")}</strong><input aria-label={uiText("Example focus minutes")} type="range" min={5} max={90} step={5} value={minutes} onChange={(e)=>setMinutes(Number(e.target.value))} className="mt-3 w-full accent-[var(--tf-focus)]"/></label><label className="mt-3 flex items-center gap-3 text-sm">{uiText("Rest number in this sitting")}<select aria-label={uiText("Example rest number")} value={number} onChange={(e)=>setNumber(Number(e.target.value))} className="rounded-lg border border-line bg-surface px-3 py-2">{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label></div>
    <div className="rounded-xl border border-line bg-surface p-4"><div aria-hidden="true" className="flex h-8 overflow-hidden rounded-lg"><span className="bg-focus" style={{flex:minutes}}/><span className="bg-rest" style={{flex:plan.seconds/60}}/></div><div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><span className="text-focus">{minutes}{uiText(" min focus")}</span><strong className="text-rest">{plan.seconds/60}{uiText(" min ")}{plan.long?uiText("long rest"):uiText("rest")}</strong></div><p className="mt-2 text-sm text-muted">{plan.long?uiText("This rest uses your long-rest length."):uiText("Scales with focus time, then stays within your shortest and longest rest.")}</p></div></div>
  </div>
}
