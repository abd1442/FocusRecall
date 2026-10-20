import { evidenceCopy } from '@core/evidenceCopy'
import { t as uiText, currentLanguage , count, formatDate } from '../../i18n'
import { useId, useState } from 'react'
import type { PersonalInsight } from '@core/personalInsights'
import { insightRecordBasis, insightReliability, insightTakeaway } from '@core/insightPresentation'
import { Button, Dialog } from '../../components/ui'
import { distractionDuration } from '@core/distractionPresentation'

export function InsightTakeaway({c}:{c:PersonalInsight}):React.JSX.Element {
  const takeaway=insightTakeaway(c,currentLanguage()),duration=c.family==='distractions'&&c.unit==='minutes',color=takeaway.tone==='positive'?'text-rest':takeaway.tone==='caution'||duration?'text-overtime':'text-focus',fill=takeaway.tone==='positive'?'bg-rest/10':takeaway.tone==='caution'||duration?'bg-overtime/10':'bg-focus/10'
  return <div aria-label={uiText("Main takeaway")} className={`rounded-xl p-4 ${fill}`}><p className={`mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider ${color}`}><span aria-hidden="true">{takeaway.tone==='positive'?'↗':takeaway.tone==='caution'?'↘':'—'}</span>{uiText("Takeaway")}</p><h4 className="text-lg font-semibold leading-snug">{takeaway.text}</h4>{takeaway.comparison&&<p className="mt-1 text-sm text-muted">{takeaway.comparison}</p>}</div>
}

export function ReliabilityLabel({c}:{c:PersonalInsight}):React.JSX.Element {
  const support=insightReliability(c),color=support.level===3?'text-rest':support.level===1?'text-overtime':support.level===0?'text-muted':'text-focus'
  return <span className={`inline-flex min-w-0 items-center gap-2 text-sm font-medium ${color}`} title={uiText(support.description)}>
    {support.level===null?<span aria-hidden="true">≡</span>:<span aria-hidden="true" className="flex shrink-0 items-end gap-0.5">{[0,1,2].map(i=><span key={i} className={`w-1.5 rounded-sm ${i<(support.level??0)?'bg-current':'bg-muted/20'}`} style={{height:8+i*4}}/>)}</span>}
    <span>{uiText(support.label)}</span>
  </span>
}

function ReliabilityGuide({c}:{c:PersonalInsight}):React.JSX.Element {
  if(c.family==='distractions')return <details className="mt-3 border-t border-line pt-1 text-sm"><summary className="min-h-11 cursor-pointer py-3 text-muted">{uiText("What the evidence levels mean")}</summary><dl className="space-y-3 pb-3 text-muted">
    <div><dt className="font-medium text-ink">{uiText("Not enough evidence")}</dt><dd>{uiText("Fewer than five eligible events or three recorded days, only one eligible reason, or a tie for first.")}</dd></div>
    <div><dt className="font-medium text-ink">{uiText("Early pattern")}</dt><dd>{uiText("A leading reason is visible, but it has not repeated with enough coverage in both earlier and later days.")}</dd></div>
    <div><dt className="font-medium text-ink">{uiText("Repeated pattern")}</dt><dd>{uiText("The same reason leads in both periods. Each period needs five eligible events on three days, with the leading reason represented by three events on two days.")}</dd></div>
    <div><dt className="font-medium text-ink">{uiText("Well-supported pattern")}</dt><dd>{uiText("At least 40 eligible events on eight days, with 20 events for the leading reason across eight days. Each period has at least ten events on four days, including five leading-reason events on three days. The same reason remains first when any single day is left out.")}</dd></div>
  </dl><p className="pb-3 text-muted">{uiText("Frequency and time lost are graded separately. Time-based evidence counts only events receiving attributed time after overlap handling. The grade describes the stability of the recorded ranking, not unrecorded interruptions, a probability or proof of cause.")}</p></details>
  const copy=c.sharedEvidence?evidenceCopy(c.sharedEvidence,currentLanguage()):null
  return <details className="mt-3 border-t border-line pt-1 text-sm"><summary className="min-h-11 cursor-pointer py-3 text-muted">{uiText("Evidence details")}</summary><p>{copy?.method??c.calculation}</p><p className="mt-3">{copy?.uncertainty}</p><p className="mt-3">{copy?.limitations??c.limitations}</p></details>
}

export function InsightRecordButton({c}:{c:PersonalInsight}):React.JSX.Element {
  const [open,setOpen]=useState(false),id=useId(),basis=insightRecordBasis(c,currentLanguage())
  return <div className="rounded-xl border border-line p-3" aria-label={uiText("Supporting records")}>
    <button type="button" aria-expanded={open} aria-controls={id} aria-label={uiText("View supporting records: {value0} {value1}, {value2}", {value0: (basis.count), value1: (basis.unit), value2: (basis.status)})} onClick={()=>setOpen(v=>!v)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg text-left">
      <span className="min-w-0"><ReliabilityLabel c={c}/><span className="mt-1 block text-xs text-muted">{open?uiText("Hide supporting records"):uiText("View supporting records")}</span></span>
      <span className="grid min-w-20 shrink-0 place-items-center rounded-xl bg-focus/10 px-3 py-1 text-focus"><strong className="font-timer text-2xl font-semibold tabular-nums">{basis.count}</strong><span className="text-xs">{basis.unit}</span></span>
    </button>
    {open&&<div id={id} className="mt-3 border-t border-line pt-3 text-sm">
      <p className="mb-2 text-muted">{basis.comparison}</p>
      {c.outcome?<><dl className="space-y-2">{c.rows.slice(0,2).map((r,i)=><div key={r.label} className="flex justify-between gap-3"><dt dir={c.family==='time'&&/^\d{2}:/.test(r.label)?'ltr':'auto'} className="min-w-0 break-words">{r.label}</dt><dd className="shrink-0 text-right tabular-nums">{i===0?c.n:c.nOther} {uiText(c.unit)}<br/><span className="text-xs text-muted">{count(i===0?c.days:c.daysOther, 'studyDay')}</span></dd></div>)}</dl><p className="mt-3 text-muted">{uiText(insightReliability(c).description)}</p></>:<p className="text-muted">{c.n}{uiText(" recorded events across ")}{c.days}{uiText(" study days. Event counts and minutes lost are different measures.")}</p>}
      {c.recordSupport&&<div className="mt-3 space-y-2 rounded-lg bg-surface-2/40 p-3 text-sm" aria-label={uiText("Recorded ranking checks")}><p>{c.recordSupport.events}{uiText(" eligible ")}{c.recordSupport.metric==='minutes'?uiText("events with attributed time"):uiText("events")} · {count(c.recordSupport.days, 'day')}</p><p className="text-muted">{uiText("Leading-reason coverage: ")}{c.recordSupport.leaderEvents}{uiText(" eligible events on ")}{count(c.recordSupport.leaderDays, 'day')}</p><p className="text-muted">{uiText("Earlier leader: ")}{c.recordSupport.earlier.leader??uiText('No unique leader')}</p><p className="text-muted">{uiText("Later leader: ")}{c.recordSupport.later.leader??'No unique leader'}</p><p className="text-muted">{c.recordSupport.robustToDayRemoval?uiText("✓ Same leader when any one day is left out"):uiText("Single-day robustness not established")}</p><p>{uiText(insightReliability(c).description)}</p></div>}
      <p className="mt-2 text-xs text-muted">{formatDate(c.range.from)} → {formatDate(c.range.to)}</p><ReliabilityGuide c={c}/>
    </div>}
  </div>
}

function MiniComparison({c}:{c:PersonalInsight}):React.JSX.Element {
  const rows=c.rows.slice(0,c.outcome?2:3),max=Math.max(1,...rows.map(r=>r.value))
  const value=(v:number):string=>c.outcome==='length'?uiText('{value} min',{value:v.toFixed(1)}):c.outcome?`${v.toFixed(1)} / 5`:c.unit==='minutes'?distractionDuration(v,currentLanguage()):v.toFixed(0)+' '+uiText(v===1?'event':'events')
  return <div aria-label={c.outcome?uiText("Balanced comparison"):uiText("Recorded totals")} className="space-y-4 rounded-xl bg-surface-2/40 p-4">{rows.map((r,i)=><div key={r.label}><div className="flex justify-between gap-3 text-sm"><span dir={c.family==='time'&&/^\d{2}:/.test(r.label)?'ltr':'auto'} className="min-w-0 break-words">{r.label}</span><strong className="shrink-0 tabular-nums">{value(r.value)}</strong></div><div aria-hidden="true" className="mt-1.5 h-2.5 rounded-full bg-surface-2"><div className={`h-full rounded-full ${i===0?'bg-focus':'bg-muted/50'}`} style={{width:`${Math.max(0,r.value)/max*100}%`}}/></div><p className="mt-1 text-xs text-muted">{r.n} {c.outcome?c.unit:uiText("events")}</p></div>)}</div>
}

function InsightWalkthrough({c,onClose}:{c:PersonalInsight;onClose:()=>void}):React.JSX.Element {
  const copy=c.sharedEvidence?evidenceCopy(c.sharedEvidence,currentLanguage()):null
  const recorded=c.family==='distractions'
  // One optional explanation, using the same evidence contract as exports.
  // Descriptive totals use their generator; no retired matcher thresholds.
  return <Dialog title={uiText("How this statistic is made")} onClose={onClose}>
    <section className="space-y-4" data-shared-evidence-details={copy?true:undefined}>
      <h3 className="text-xl font-semibold">{copy?.summary??uiText("Recorded summary")}</h3>
      {recorded&&<MiniComparison c={c}/>}
      <p>{copy?.method??c.calculation}</p>
      <details><summary className="min-h-11 cursor-pointer text-focus">{uiText("Evidence details")}</summary><p className="mt-3">{copy?.coverage??c.explanation}</p>{copy&&<p className="mt-3">{copy.uncertainty}</p>}{recorded&&<ReliabilityGuide c={c}/>}</details>
      <p className="text-sm text-muted">{copy?.limitations??c.limitations}</p>
    </section>
    <Button className="mt-5" onClick={onClose}>{uiText("Done")}</Button>
  </Dialog>
}

export function InsightExplanationTrigger({c}:{c:PersonalInsight}):React.JSX.Element {
  const [open,setOpen]=useState(false)
  return <><button type="button" aria-label={uiText("How was this determined?")} title={uiText("How this statistic is made")} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)} className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-sm text-muted hover:text-ink">ⓘ</button>{open&&<InsightWalkthrough c={c} onClose={()=>setOpen(false)}/>}</>
}
