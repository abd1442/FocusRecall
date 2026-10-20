import { formatDuration } from '../i18n'
import { t as uiText } from '../i18n'
import { useEffect,useRef,useState } from 'react'
import { fieldByKey } from '@core/logfields'
import { answerField,sessionLogEntries,type SessionLogDraft,type LogAnswers } from '@core/sessionLog'
import { sessionSubjects,type FinishedBlock } from '@core/session'

import { useSettings } from '../store/session'
import { useLogSchema } from '../store/logSchema'
import { FieldInput } from '../components/log/FieldInput'
import { Button,inputClass } from '../components/ui'

const empty=():LogAnswers=>({values:{},notes:{},untouched:[]})
/** A small, optional wrap-up. Skipping never creates confirmed answers. */
export function QuickWrapUp({blocks,onDetailed,detailLabel}:{blocks:FinishedBlock[];onDetailed:()=>void;detailLabel:string}):React.JSX.Element {
 const schema=useLogSchema(s=>s.schema),subjects=sessionSubjects(blocks),sessionId=blocks[0].sessionId
 const [draft,setDraft]=useState<SessionLogDraft|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const pending=useRef<Promise<unknown>>(Promise.resolve()),leaving=useRef(false)
 const plannedActivity=useSettings(s=>s.settings.plannedActivity)
 const focus=fieldByKey(schema,'focus'),activity=fieldByKey(schema,'activity'),note=fieldByKey(schema,'note')
 useEffect(()=>{let alive=true;void(async()=>{const saved=await window.api.invoke('session:getLogDraft',sessionId) as SessionLogDraft|null;if(saved?.perSubject&&saved.shared){if(alive)setDraft(saved);return}
  const perSubject:Record<number,LogAnswers>={}
  for(const s of subjects){const previous=await window.api.invoke('log:previous',s.itemId,s.blockIds.at(-1)!);const own=empty();if(activity&&(plannedActivity??previous?.[activity.id])!=null){own.values[activity.id]=plannedActivity??previous![activity.id];own.untouched=[activity.id]}perSubject[s.itemId]=own}
  if(alive)setDraft({perSubject,shared:empty()})
 })().catch(e=>{if(alive)setError(String(e))});return()=>{alive=false}},[sessionId,schema])
 useEffect(()=>{if(!draft||leaving.current)return;pending.current=pending.current.catch(()=>{}).then(()=>window.api.invoke('session:saveLogDraft',sessionId,draft)).catch(e=>setError(String(e)))},[draft,sessionId])
 const answer=(id:number,field:number,value:LogAnswers['values'][number])=>setDraft(d=>d?{...d,perSubject:{...d.perSubject,[id]:answerField(d.perSubject[id]??empty(),field,value)}}:d)
 const persist=async()=>{await pending.current;if(draft)await window.api.invoke('session:saveLogDraft',sessionId,draft)}
 const finish=async(destination:'finish'|'break'|'next')=>{if(!draft||leaving.current)return;leaving.current=true;setBusy(true);setError('');try{await persist();await window.api.invoke('session:finishWrapUp',sessionLogEntries(schema,subjects,draft.perSubject,draft.shared),destination);if(destination==='next')await window.api.invoke('preparation:begin',null)}catch(e){setError(String(e));leaving.current=false;setBusy(false)}}
 const details=async()=>{if(leaving.current)return;leaving.current=true;setBusy(true);try{await persist();onDetailed()}catch(e){setError(String(e));leaving.current=false;setBusy(false)}}
 return <div className="h-full overflow-y-auto"><div className="mx-auto flex min-h-full max-w-4xl flex-col gap-6 px-6 py-8 pb-4">
  <header className="pr-28"><p className="text-sm text-muted">{formatDuration(blocks.reduce((n,b)=>n+b.focusSeconds,0))}{uiText(" recorded")}</p><h1 className="mt-2 text-3xl font-medium">{uiText("Session complete")}</h1><p className="mt-2 text-muted">{uiText("Everything below is optional.")}</p></header>
  {!draft&&!error&&<p role="status">{uiText("Loading your wrap-up…")}</p>}
  {draft&&<fieldset disabled={busy} className="flex flex-col gap-5">{subjects.map(s=>{const own=draft.perSubject[s.itemId]??empty();return <section key={s.itemId} className="rounded-2xl border border-line bg-surface p-5"><h2 className="mb-4 font-semibold" style={{color:s.itemColor}}>{s.itemName}</h2>{focus&&<FieldInput field={focus} value={own.values[focus.id]} suggested={own.untouched?.includes(focus.id)} onChange={v=>answer(s.itemId,focus.id,v)} large/>}{activity&&<details className="mt-5"><summary className="cursor-pointer text-sm text-muted">{uiText("Activity")}{own.values[activity.id]?' · '+(activity.options.find(o=>o.id===own.values[activity.id])?.label??'previous suggestion'):''}{own.untouched?.includes(activity.id)?uiText(" · not confirmed"):''}</summary><div className="mt-3"><FieldInput field={activity} value={own.values[activity.id]} onChange={v=>answer(s.itemId,activity.id,v)} large/>{own.values[activity.id]!=null&&own.untouched?.includes(activity.id)&&<Button className="mt-3" size="sm" onClick={()=>answer(s.itemId,activity.id,own.values[activity.id])}>{uiText("Keep activity")}</Button>}</div></details>}</section>})}
  {note&&<details><summary className="cursor-pointer text-sm text-focus">{uiText("Add a session note")}</summary><textarea aria-label={uiText("Quick session note")} className={`${inputClass} mt-3 min-h-24 font-writing`} value={String(draft.shared.values[note.id]??'')} onChange={e=>setDraft(d=>d?{...d,shared:answerField(d.shared,note.id,e.target.value||null)}:d)}/></details>}
  <Button className="self-start" onClick={()=>void details()}>{detailLabel}</Button></fieldset>}
  {error&&<p role="alert" className="text-status-error">{error}</p>}
  <footer className="sticky bottom-0 -mx-6 mt-auto flex flex-wrap gap-3 border-t border-line bg-bg/95 px-6 py-4 backdrop-blur"><Button variant="primary" disabled={!draft||busy} onClick={()=>void finish('finish')}>{uiText("Save and finish studying")}</Button><Button disabled={!draft||busy} onClick={()=>void finish('break')}>{uiText("Take a break")}</Button><Button disabled={!draft||busy} onClick={()=>void finish('next')}>{uiText("Next session")}</Button></footer>
 </div></div>
}
