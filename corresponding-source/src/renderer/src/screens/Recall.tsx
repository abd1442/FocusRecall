import { formatDuration } from '../i18n'
import { t as uiText, displayScale } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { ReviewTimer,resumedReviewSeconds } from '@core/review'
import { AdviceCard } from '../components/AdviceCard'
import type { RecallInput } from '@core/blocks'
import { stuckReviewNote } from '@core/captures'
import { SCALES } from '@core/logfields'
import { sessionSubjects, type FinishedBlock, type SessionState } from '@core/session'
import { formatClock} from '@core/timer'
import type { PickerItem } from '@core/types'
import { ItemPicker } from '../components/ItemPicker'
import { NamedSlider } from '../components/NamedSlider'
import { Button, Dialog, inputClass } from '../components/ui'
import { useKey } from '../hooks'
import { sessionCommand } from '../store/session'
import { NotesEditor } from '../components/NotesEditor'
import { Whiteboard } from '../components/Whiteboard'
import { EMPTY_DESTINATION, findRecallNote, type Stroke, type StudyNote } from '@core/notes'


type Draft = Omit<RecallInput, 'recallSeconds' | 'recallRating'> & { recallRating: number | null; reviewMarked: boolean; ratingTouched: boolean }

/** Unanswered recall stays empty, including when the review is skipped. */
const emptyDraft = (): Draft => ({ recallText: '', toReviewText: '', recallRating: null, reviewMarked: false, ratingTouched: false })

interface Subject {
  itemId: number
  itemName: string
  itemColor: string
  focusSeconds: number | null
  /** The part that gets the recall (the subject's latest), or null for a subject added here. */
  blockId: number | null
}

/**
 * The recall stage: a blank page per subject. Nothing from the material is
 * shown. Text autosaves to the subject's latest part as it is written. A
 * subject added here ("Studied more than one thing?") splits the session's
 * last part when Done is pressed.
 */
export function RecallScreen({ blocks }: { blocks: FinishedBlock[] }): React.JSX.Element {
  const reviewTimer = useRef(new ReviewTimer())
  const [clock,setClock]=useState({seconds:0,running:false})
  useEffect(()=>{
    const tick=():void=>setClock(reviewTimer.current.sample())
    const id=setInterval(tick,1000)
    const off=window.api.on('clock:changed',()=>{reviewTimer.current.interrupt();tick()})
    return ()=>{clearInterval(id);off()}
  },[])
  const [reviewMinutes,setReviewMinutes]=useState(3)
  const [notesMode,setNotesMode]=useState<'type'|'draw'|null>(null)
  const elapsed=Math.min(clock.seconds,reviewMinutes*60)
  const bucket=Math.floor(elapsed/5)
  const [busy,setBusy]=useState(false)
  useEffect(()=>{if(clock.running&&elapsed>=reviewMinutes*60){reviewTimer.current.pause();setClock(reviewTimer.current.sample())}},[bucket,reviewMinutes,clock.running])
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [added, setAdded] = useState<PickerItem[]>([])
  const [picking, setPicking] = useState(false)
  const [notesFor,setNotesFor]=useState<Subject|null>(null)
  const [drawing,setDrawing]=useState<Record<number,{strokes:Stroke[];image:string|null;note?:StudyNote}>>({})
  const [noteError,setNoteError]=useState('')
  const finishing=useRef(false)
  const pending=useRef<Promise<unknown>>(Promise.resolve())
  const enqueue=(task:()=>Promise<unknown>):Promise<unknown>=>{
    const next=pending.current.then(task,task)
    pending.current=next
    return next
  }
  const currentDrafts=useRef(drafts);currentDrafts.current=drafts
  const previousSeconds=useRef<Record<number,number>>({})
  const [ready,setReady]=useState(false)
  const [extraReady,setExtraReady]=useState(false)
  const updateDrawing=(s:Subject,strokes:Stroke[],image:string|null):void=>{
    if(finishing.current)return
    const previous=drawing[s.itemId]?.note
    setDrawing((d)=>({...d,[s.itemId]:{...d[s.itemId],strokes,image}}))
    if(s.blockId!==null)void enqueue(async()=>{const note=await window.api.invoke('notes:save',{id:previous?.id??`recall-${s.blockId}`,itemId:s.itemId,blockId:s.blockId,title:previous?.title??s.itemName,text:draftOf(s.itemId).recallText,strokes,image,destination:previous?.destination??EMPTY_DESTINATION},false);setNoteError('');setDrawing((d)=>({...d,[s.itemId]:{...d[s.itemId],note}}))}).catch((e)=>setNoteError(String(e)))
  }
  useEffect(() => {
    let alive=true
    void Promise.all([window.api.invoke('session:getRecallDraft',blocks[0].sessionId),Promise.all(sessionSubjects(blocks).map(async (s) => {
      const blockId=s.blockIds[s.blockIds.length-1]
      const [saved,rows]=await Promise.all([window.api.invoke('recall:get',blockId),window.api.invoke('notes:list',s.itemId,blockId)])
      const n=findRecallNote(rows,s.itemId,blockId)
      return {s,blockId,saved,n}
    }))]).then(([value,rows])=>{
      if(!alive)return
      const draft=value as {added?:PickerItem[];drafts?:Record<number,Draft>;drawing?:Record<number,{strokes:Stroke[];image:string|null}>;reviewSeconds?:number;reviewSecondsByBlock?:Record<number,number>}|null
      const restored={...draft?.drafts},ink:typeof drawing={...draft?.drawing}
      for(const {s,blockId,saved,n} of rows){
        previousSeconds.current[blockId]=resumedReviewSeconds(saved?.recallSeconds,draft?.reviewSecondsByBlock?.[blockId]??draft?.reviewSeconds)
        if(saved)restored[s.itemId]={...emptyDraft(),recallText:saved.recallText,toReviewText:saved.toReviewText,recallRating:saved.recallRating,reviewMarked:saved.reviewMarked??false,ratingTouched:saved.recallRatingTouched??false}
        else if(!restored[s.itemId])restored[s.itemId]={...emptyDraft(),recallText:n?.text??''}
        if(n)ink[s.itemId]={strokes:n.strokes,image:n.image,note:n}
      }
      if(Array.isArray(draft?.added))setAdded(draft.added)
      if(draft?.added?.length||rows.some(r=>r.saved?.recallText||r.n?.strokes.length||r.n?.text))setNotesMode('type')
      setDrafts(d=>({...d,...restored}));setDrawing(ink)
      setReady(true);setExtraReady(true)
    }).catch(e=>{if(alive)setNoteError(String(e))})
    return ()=>{alive=false}
  }, [])
  useEffect(()=>{
    if(!ready || !extraReady || finishing.current)return
    void persistDraft().catch(e=>setNoteError(String(e)))
  },[added,drafts,drawing,ready,extraReady,bucket,clock.running])

  // A stuck marker during the session adds the subject to Review later (it can be unticked here).
  useEffect(() => {
    void window.api.invoke('session:review', blocks.map((b) => b.id)).then(({ marks }) => {
      const drafts: Record<number, Draft> = {}
      for (const s of sessionSubjects(blocks)) {
        const note = stuckReviewNote(marks.filter((m) => s.blockIds.includes(m.blockId)))
        if (note) drafts[s.itemId] = { ...emptyDraft(), reviewMarked: true, toReviewText: note }
      }
      if (Object.keys(drafts).length) setDrafts((d) => ({ ...drafts, ...d }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const subjects: Subject[] = [
    ...sessionSubjects(blocks).map((s) => ({ itemId: s.itemId, itemName: s.itemName, itemColor: s.itemColor, focusSeconds: s.focusSeconds, blockId: s.blockIds[s.blockIds.length - 1] })),
    ...added.filter((a) => !blocks.some((b) => b.itemId === a.id)).map((a) => ({ itemId: a.id, itemName: a.name, itemColor: a.color, focusSeconds: null, blockId: null }))
  ]
  const draftOf = (itemId: number): Draft => drafts[itemId] ?? emptyDraft()

  const save = (blockId: number, d: Draft): Promise<unknown> =>
    enqueue(()=>window.api.invoke('recall:save', blockId, {
      recallText: d.recallText,
      toReviewText: d.reviewMarked ? d.toReviewText : '',
      reviewMarked: d.reviewMarked,
      recallRating: d.recallRating as RecallInput['recallRating'],
      recallRatingTouched: d.ratingTouched,
      recallSeconds: (previousSeconds.current[blockId]??0)+Math.max(0,Math.round(Math.min(reviewTimer.current.sample().seconds,reviewMinutes*60)))
    }))

  function persistDraft():Promise<unknown> {
    const extraIds=new Set(added.map(s=>s.id)),extraDrafts=Object.fromEntries(Object.entries(currentDrafts.current).filter(([id])=>extraIds.has(Number(id)))),extraDrawings=Object.fromEntries(Object.entries(drawing).filter(([id])=>extraIds.has(Number(id))))
    const seconds=Math.min(reviewTimer.current.sample().seconds,reviewMinutes*60)
    return enqueue(()=>window.api.invoke('session:saveRecallDraft',blocks[0].sessionId,{added,drafts:extraDrafts,drawing:extraDrawings,reviewSecondsByBlock:Object.fromEntries(Object.entries(previousSeconds.current).map(([id,previous])=>[id,previous+seconds]))}))
  }

  async function saveForLater():Promise<void> {
    if(!ready||!extraReady||finishing.current)return
    finishing.current=true;setBusy(true);setNoteError('')
    try {
      await pending.current.catch(()=>{})
      for(const s of subjects)if(s.blockId!==null) {
        const draft=currentDrafts.current[s.itemId]??emptyDraft()
        if(draft.recallText||draft.toReviewText||draft.reviewMarked||draft.ratingTouched||previousSeconds.current[s.blockId]||reviewTimer.current.sample().seconds>0)await save(s.blockId,draft)
        const ink=drawing[s.itemId]
        if(ink)await enqueue(()=>window.api.invoke('notes:save',{id:ink.note?.id??`recall-${s.blockId}`,itemId:s.itemId,blockId:s.blockId,title:ink.note?.title??s.itemName,text:draft.recallText,strokes:ink.strokes,image:ink.image,destination:ink.note?.destination??EMPTY_DESTINATION},false))
      }
      await persistDraft()
      await window.api.invoke('session:leaveWorkflow',blocks[0].sessionId)
    }catch(error){setNoteError(error instanceof Error?error.message:String(error))}finally{finishing.current=false;setBusy(false)}
  }

  const update = (s: Subject, p: Partial<Draft>): void => {
    const next={...(currentDrafts.current[s.itemId]??emptyDraft()),...p}
    currentDrafts.current={...currentDrafts.current,[s.itemId]:next}
    setDrafts(currentDrafts.current)
    if(s.blockId!==null)void save(s.blockId,next).catch(e=>setNoteError(String(e)))
  }

  async function done(): Promise<void> {
    if(!ready || !extraReady)return
    if(finishing.current)return
    finishing.current=true;setBusy(true)
    try{
    await pending.current.catch(()=>{})
    let parts = blocks
    const extra = subjects.filter((s) => s.blockId === null).map((s) => s.itemId)
    if (extra.length) {
      const state = (await sessionCommand(() => window.api.invoke('session:splitLast', extra))) as SessionState | undefined
      if (!state) return
      parts = state.finished
    }
    // Each subject's recall goes on its latest part.
    await Promise.all(
      sessionSubjects(parts).map((s) => {
        // Every subject's recall is saved, so an untouched rating is stored as its (marked) default.
        const id=s.blockIds[s.blockIds.length-1],d=drafts[s.itemId]??emptyDraft()
        if(!d.recallText&&!d.toReviewText&&!d.reviewMarked&&!d.ratingTouched&&!previousSeconds.current[id]&&Math.min(reviewTimer.current.sample().seconds,reviewMinutes*60)===0)return Promise.resolve()
        return save(id,d)
      })
    )
    for(const s of sessionSubjects(parts)){
      const ink=drawing[s.itemId]
      if(ink){await window.api.invoke('notes:save',{id:ink.note?.id??`recall-${s.blockIds[s.blockIds.length-1]}`,itemId:s.itemId,blockId:s.blockIds[s.blockIds.length-1],title:ink.note?.title??s.itemName,text:(drafts[s.itemId]??emptyDraft()).recallText,strokes:ink.strokes,image:ink.image,destination:ink.note?.destination??EMPTY_DESTINATION},false)}
    }
    await sessionCommand(() => window.api.invoke('session:completeRecall'))
    }catch(error){setNoteError(error instanceof Error?error.message:String(error))}finally{finishing.current=false;setBusy(false)}
  }

  useKey(
    (e) => {
      if (picking || notesFor) return
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        void done()
      }
    },
    [drafts, added, picking, blocks, notesFor, drawing, clock, ready, extraReady]
  )

  const single = subjects.length === 1
  if(!ready || !extraReady)return <div className="p-8" role="status">{noteError ? uiText("Could not load saved recall: {value0}", {value0: (noteError)}) : uiText("Loading saved recall…")}</div>

  return (
    <div className="relative flex h-full flex-col overflow-y-auto">
      <div className="h-1 shrink-0 bg-recall/70" />
      <fieldset disabled={busy} inert={busy} className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-8 px-10 pt-12 pb-10">
        <header className="pr-20"><h1 className="text-3xl font-light">{uiText("Review & connect")}</h1><p className="mt-3 max-w-prose text-muted">{uiText("Hide the material. Recall what you can, then check and correct any gaps.")}</p></header>
        <AdviceCard surface="recall"/>
        {noteError&&<p role="alert" className="text-status-error">{uiText("Could not save: ")}{noteError}{uiText(". Keep this screen open and try again.")}</p>}
        <section aria-label={uiText("Review timer")} className="flex flex-col items-center gap-4 rounded-2xl border border-recall/30 bg-surface p-6">
          <div role="timer" aria-label={uiText("Review time remaining")} className="font-timer text-6xl font-light tabular-nums text-recall">{formatClock(Math.max(0,reviewMinutes*60-elapsed))}</div>
          <div className="flex flex-wrap items-center justify-center gap-3"><label className="text-sm text-muted">{uiText("Minutes ")}<select aria-label={uiText("Review length")} disabled={clock.running} className="ml-2 min-h-11 rounded-lg border border-line bg-surface px-3" value={reviewMinutes} onChange={e=>setReviewMinutes(Number(e.target.value))}>{[1,3,5].map(m=><option key={m} value={m}>{m}</option>)}</select></label><Button disabled={busy||elapsed>=reviewMinutes*60} onClick={()=>{if(reviewTimer.current.sample().running)reviewTimer.current.pause();else reviewTimer.current.start();setClock(reviewTimer.current.sample())}}>{clock.running?uiText("Pause review"):elapsed>=reviewMinutes*60?uiText("Review complete"):elapsed>0?uiText("Resume review"):uiText("Start review")}</Button></div>
          <p className="text-center text-sm text-muted">{uiText("Think it through, use paper, or review in another app. Writing here is optional.")}</p>
          <div className="flex flex-wrap justify-center gap-3"><Button aria-pressed={notesMode==='type'} onClick={()=>setNotesMode('type')}>{uiText("Type notes")}</Button><Button aria-pressed={notesMode==='draw'} onClick={()=>setNotesMode('draw')}>{uiText("Draw notes")}</Button>{notesMode&&<Button onClick={()=>setNotesMode(null)}>{uiText("Hide notes")}</Button>}</div>
        </section>
        {subjects.map(s=><div key={'rating-'+s.itemId} className="rounded-xl border border-line bg-surface p-5">{!single&&<h2 className="mb-3 font-medium">{s.itemName}</h2>}<NamedSlider label={uiText("How much could you recall?")} scale={displayScale(SCALES.recall)} value={draftOf(s.itemId).recallRating} suggested={!draftOf(s.itemId).ratingTouched&&draftOf(s.itemId).recallRating!==null} onConfirm={()=>update(s,{ratingTouched:true})} onChange={v=>update(s,{recallRating:v,ratingTouched:true})} accent="var(--tf-recall)"/><ReviewLater draft={draftOf(s.itemId)} onChange={p=>update(s,p)}/></div>)}
        <div hidden={!notesMode}>{subjects.map((s) => (
          <RecallPage
            key={s.itemId}
            subject={s}
            showLabel={!single}
            autoFocus={false}
            initialMode={notesMode??'type'}
            draft={draftOf(s.itemId)}
            onChange={(p) => update(s, p)}
            elapsed={null}
            onRemove={s.blockId === null ? () => setAdded((a) => a.filter((x) => x.id !== s.itemId)) : undefined}
            onDone={undefined}
            drawing={drawing[s.itemId]??{strokes:[],image:null}}
            onDrawing={(strokes,image)=>updateDrawing(s,strokes,image)}
            onNotes={()=>setNotesFor(s)}
          />
        ))}</div>

        <button type="button" onClick={() => setPicking(true)} className="self-start text-base text-muted underline-offset-4 hover:text-ink hover:underline">{uiText("Studied more than one thing? Add subject")}</button>


      </fieldset>

      <footer className="sticky bottom-0 flex shrink-0 flex-wrap justify-end gap-3 border-t border-line bg-bg/95 px-6 py-4"><Button variant="ghost" className="me-auto" disabled={busy} onClick={()=>void saveForLater()}>{uiText("Save for later")}</Button><Button variant="ghost" disabled={busy} onClick={()=>void done()}>{uiText("Skip review")}</Button><Button variant="primary" disabled={busy} onClick={()=>void done()}>{busy?uiText("Saving…"):uiText("Continue to session log")}</Button></footer>
      {picking && (
        <Dialog title={uiText("Add a subject you also studied")} onClose={() => setPicking(false)}>
          <ItemPicker
            autoFocus
            excludeIds={subjects.map((s) => s.itemId)}
            selectedId={null}
            onSelect={(item) => {
              setAdded((a) => [...a, item])
              setPicking(false)
            }}
          />
          <p className="mt-4 text-base text-muted">{uiText("Adjust subject switches on the timeline after recall.")}</p>
        </Dialog>
      )}
      {notesFor&&<NotesEditor itemId={notesFor.itemId} blockId={notesFor.blockId} initialText={draftOf(notesFor.itemId).recallText} initialDrawing={drawing[notesFor.itemId]} onSaved={(note)=>{setDrafts((d)=>({...d,[note.itemId]:{...(d[note.itemId]??emptyDraft()),recallText:note.text}}));setDrawing((d)=>({...d,[note.itemId]:{strokes:note.strokes,image:note.image,note}}))}} onClose={()=>setNotesFor(null)}/>}
    </div>
  )
}

function RecallPage({
  subject,
  showLabel,
  autoFocus,
  initialMode,
  draft,
  onChange,
  elapsed,
  onRemove,
  onDone
  ,drawing,onDrawing,onNotes
}: {
  subject: Subject
  showLabel: boolean
  autoFocus: boolean
  initialMode:'type'|'draw'
  draft: Draft
  onChange: (p: Partial<Draft>) => void
  /** Shown on the first page only. */
  elapsed: number | null
  /** Only for subjects added on this screen. */
  onRemove?: () => void
  /** With one subject, Done sits in this page's button row. */
  onDone?: () => void
  drawing: {strokes:Stroke[];image:string|null}
  onDrawing: (strokes:Stroke[],image:string|null)=>void
  onNotes: ()=>void
}): React.JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  const inSuggestion = false
  const [mode,setMode]=useState<'type'|'draw'>(initialMode)
  useEffect(()=>setMode(initialMode),[initialMode])

  return (
    <section className="flex flex-col gap-7">
      <div className="relative flex min-h-[22rem] flex-col rounded-2xl border border-line bg-writing transition-[border-color,box-shadow] focus-within:border-recall focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--tf-recall)_18%,transparent)]">
        <div className="flex flex-wrap items-start gap-4 px-8 pt-6">
          <div className={`flex min-w-0 flex-1 flex-wrap items-center gap-2.5 text-base ${showLabel ? 'text-ink' : 'text-muted'}`}>
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: subject.itemColor }} />
            <span dir="auto" className="min-w-0 break-words">{subject.itemName}</span>
            <span className="text-muted">· {subject.focusSeconds !== null ? uiText("{value0} of focus", {value0: (formatDuration(subject.focusSeconds))}) : uiText("added now")}</span>
            {onRemove && (
              <button type="button" onClick={onRemove} className="ml-2 rounded-md px-2 text-sm text-muted hover:bg-surface-2 hover:text-ink">{uiText("Remove")}</button>
            )}
          </div>
          {elapsed !== null && (
            // Fixed width and tabular digits: the timer never jumps when it changes colour.
            <div className="w-40 shrink-0 text-right" aria-live="off">
              <div className={`font-timer text-3xl leading-none font-light tabular-nums transition-colors duration-1000 ${inSuggestion ? 'text-recall' : 'text-muted'}`}>
                {formatClock(elapsed)}
              </div>
              <div className="mt-1.5 text-sm text-muted">{uiText("suggested 3 to 5 min")}</div>
            </div>
          )}
        </div>

        <div className="mx-8 mt-4 flex flex-wrap gap-2"><Button size="sm" aria-pressed={mode==='type'} onClick={()=>setMode('type')}>{uiText("Type")}</Button><Button size="sm" aria-pressed={mode==='draw'} onClick={()=>setMode('draw')}>{uiText("Draw")}</Button><Button size="sm" onClick={onNotes}>{uiText("Obsidian / save note")}</Button></div>
        {mode==='draw'?<div className="mx-8 mt-4 mb-6"><Whiteboard strokes={drawing.strokes} onChange={onDrawing}/></div>:<textarea
          ref={ref}
          dir="auto"
          aria-label={uiText("What you remember about {value0}", {value0: (subject.itemName)})}
          value={draft.recallText}
          onChange={(e) => onChange({ recallText: e.target.value })}
          className="mx-8 mt-4 mb-2 min-h-[16rem] max-w-[72ch] flex-1 resize-none bg-transparent font-writing leading-[1.65] text-writing-ink caret-[var(--tf-recall)] focus:outline-none"
          style={{ fontSize: 'var(--tf-writing-size)' }}
        />}
        <p className="px-8 pb-5 text-base text-muted select-none">{uiText("main ideas · what was unclear · what to look at next")}</p>
      </div>

      <div className={`flex flex-wrap items-center gap-4 ${onDone ? 'border-t border-line pt-6' : ''}`}>
        {onDone && (
          <>
            <span className="flex-1" />
            <DoneButton onClick={onDone} />
          </>
        )}
      </div>
    </section>
  )
}

/** The flag is independent of writing mode, including recall done on paper. */
function ReviewLater({draft,onChange}:{draft:Draft;onChange:(patch:Partial<Draft>)=>void}):React.JSX.Element {
  const noteRef=useRef<HTMLInputElement>(null)
  return <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4"><Button aria-pressed={draft.reviewMarked} onClick={()=>{onChange({reviewMarked:!draft.reviewMarked});if(!draft.reviewMarked)setTimeout(()=>noteRef.current?.focus(),0)}}>{draft.reviewMarked?uiText("✓ Marked for review"):uiText("Review later")}</Button>{draft.reviewMarked&&<input ref={noteRef} dir="auto" aria-label={uiText("Note for the review (optional)")} placeholder={uiText("What to look at again (optional)")} className={`${inputClass} min-w-0 flex-1 basis-64 font-writing focus:border-recall`} value={draft.toReviewText} onChange={e=>onChange({toReviewText:e.target.value})}/>}</div>
}

function DoneButton({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <>
      <span className="text-sm text-muted">{uiText("Ctrl + Enter")}</span>
      <button type="button" onClick={onClick} className="min-h-16 rounded-lg bg-recall px-10 text-xl font-semibold text-on-accent transition hover:brightness-110">{uiText("Done")}</button>
    </>
  )
}
