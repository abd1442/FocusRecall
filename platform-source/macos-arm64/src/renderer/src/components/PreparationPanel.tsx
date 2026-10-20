import { t as uiText, useLanguage } from '../i18n'
import { displayPreparationSuggestion } from '@core/insightLocalization'
import { useLogSchema } from '../store/logSchema'
import { useSettings } from '../store/session'
import { useBlocks } from '../store/blocks'
import { useLayoutEffect, useRef, useState } from 'react'
import { DEFAULT_PREPARATION_CHECKS,type Preparation } from '@core/preparation'
import { AdviceCard } from './AdviceCard'

export function PreparationPanel({preparation}:{preparation:Preparation}):React.JSX.Element {
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => { heading.current?.focus() }, [])
  const [checked,setChecked]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [quick,setQuick]=useState(false)
  const panelAutoShow=useSettings(s=>s.settings.panelAutoShow)
  const guided=useSettings(s=>!s.settings.starterGuideCompleted)
  const firstSession=useBlocks(s=>s.blocks.length===0)
  const language=useLanguage(),schema=useLogSchema(s=>s.schema)
  const suggestions=(preparation.suggestions??[]).map(s=>displayPreparationSuggestion(s,schema,language))
  const check=(id:string,label:string,personal=false):React.JSX.Element=><label key={id} className={`flex min-h-12 cursor-pointer items-center gap-3 py-2.5 ${personal?'rounded-r-lg border-l-[3px] border-focus px-3 has-[:checked]:bg-focus/10':''}`}><input type="checkbox" checked={checked.includes(id)} onChange={()=>setChecked(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])} className="size-5 shrink-0"/><span className="min-w-0 break-words">{personal ? label : uiText(label)}</span></label>
  const run=async(confirm:boolean):Promise<void>=>{if(busy)return;setBusy(true);setError('');try{if(confirm)await window.api.invoke('preparation:confirm',quick);else await window.api.invoke('preparation:cancel')}catch(e){setError(String(e));setBusy(false)}}
  return <section aria-label={uiText("Prepare for your study session")} className="flex h-viewport flex-col overflow-hidden rounded-2xl border border-line bg-surface" onKeyDown={e=>{if(e.key==='Escape')void run(false)}}>
    <header className="flex shrink-0 items-center gap-3 border-b border-line px-6 py-4" style={{WebkitAppRegion:'drag'} as React.CSSProperties}><div className="min-w-0 flex-1"><h1 ref={heading} tabIndex={-1} className="text-xl font-semibold">{uiText("Get ready")}</h1><p className="truncate text-sm text-muted" title={preparation.input.goal||undefined}>{preparation.subject}{preparation.input.goal&&<><span aria-hidden="true"> · </span><span>{uiText("Aim: ")}<bdi>{preparation.input.goal}</bdi></span></>}</p></div><button type="button" aria-label={uiText("Cancel preparation")} disabled={busy} onClick={()=>void run(false)} className="size-11 rounded-lg text-xl" style={{WebkitAppRegion:'no-drag'} as React.CSSProperties}>×</button></header>
    {guided&&<p role="note" className="shrink-0 border-b border-focus/30 bg-focus/5 px-6 py-3 text-sm text-focus">{uiText("Guided start · Check anything useful, then click Ready to start below. The timer has not started yet.")}</p>}
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
      <div aria-label={uiText("Optional preparation checklist")} className="shrink-0">
        <div className="grid content-start gap-x-6 gap-y-2 sm:grid-cols-2">{DEFAULT_PREPARATION_CHECKS.map((label,i)=>check('default-'+i,label))}</div>
        {suggestions.length>0&&<section aria-label={uiText("Personal preparation suggestions")} className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><h2 className="uppercase tracking-wider">{uiText("From your patterns")}</h2><span className="flex items-center gap-1.5 text-focus"><span aria-hidden="true" className="size-1.5 rounded-full bg-focus"/>{uiText("Personal")}</span></div>
          <div className="grid content-start gap-x-6 gap-y-2 sm:grid-cols-2">{suggestions.map(s=>check(s.id,s.label,true))}</div>
          <details className="mt-2 text-sm"><summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg text-focus"><span aria-hidden="true">ⓘ</span>{uiText("Why these?")}</summary><ul className="space-y-2 pb-2 text-muted">{suggestions.map(s=><li key={s.id}><strong className="font-medium">{s.label}: </strong>{s.explanation}</li>)}</ul></details>
        </section>}
      </div>
      {firstSession&&panelAutoShow&&<p className="shrink-0 text-sm text-muted">{uiText("Starting opens your floating timer. Its window button brings FocusRecall back.")}</p>}
      <div className="shrink-0"><AdviceCard surface="prepare"/></div>
      {error&&<p role="alert" className="max-h-20 shrink-0 overflow-y-auto text-sm text-status-error">{error}</p>}
    </div>
    <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-6 py-3"><label className="flex min-h-11 min-w-0 flex-1 basis-56 items-center gap-2 text-sm text-muted"><input type="checkbox" checked={quick} onChange={e=>setQuick(e.target.checked)}/>{uiText("Skip preparation for the rest of this sitting")}</label><div className="ms-auto flex gap-3"><button type="button" disabled={busy} onClick={()=>void run(false)} className="min-h-11 rounded-xl border border-line px-4 text-sm">{uiText("Cancel")}</button><button type="button" disabled={busy} onClick={()=>void run(true)} className="min-h-11 min-w-44 rounded-xl bg-focus px-6 font-semibold text-on-accent">{busy?uiText("Starting…"):uiText("Ready to start")}</button></div></footer>
  </section>
}
