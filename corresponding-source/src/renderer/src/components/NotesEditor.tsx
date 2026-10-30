import { t as uiText } from '../i18n'
import { confirmAction } from './appDialogs'
import { useEffect, useRef, useState } from 'react'
import { EMPTY_DESTINATION, loadRecallNoteDraft, noteDraftSignature, type NoteDestination, type StudyNote, type NoteInput, type Stroke } from '@core/notes'
import { useLibrary } from '../store/library'
import { useSettings } from '../store/session'
import { useBlocks } from '../store/blocks'
import { Button, Dialog, inputClass } from './ui'
import { Whiteboard } from './Whiteboard'
import { useUi } from '../store/ui'

export function NotesEditor({ itemId, blockId = null, initialText, initialDrawing, note, onClose, onSaved }: { itemId: number; blockId?: number | null; initialText?: string; initialDrawing?: {strokes:Stroke[];image:string|null}; note?: StudyNote; onClose: () => void; onSaved?: (note:StudyNote)=>void }): React.JSX.Element {
  const item=useLibrary((s)=>s.items.find((i)=>i.id===itemId))
  const settings=useSettings((s)=>s.settings)
  const [draft,setDraft]=useState<NoteInput>({id:note?.id ?? (blockId!==null?`recall-${blockId}`:crypto.randomUUID()),itemId,blockId:note?.blockId??blockId,title:note?.title??item?.name??'Study note',text:note?.text??initialText??'',strokes:initialDrawing?.strokes??note?.strokes??[],image:initialDrawing?.image??note?.image??null,destination:note?.destination??{...EMPTY_DESTINATION,kind:item?.notesTargetType!=='none'?item?.notesTargetType??'none':settings.defaultNotesApp,vaultPath:settings.obsidianVaultPath,vaultName:item?.notesVault??settings.obsidianVaultName,file:item?.notesTargetType==='obsidian'?item.notesTarget??'':'',page:item?.notesTargetType==='notion'?item.notesTarget??'':''}})
  const [loading,setLoading]=useState(!note),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[tab,setTab]=useState<'type'|'draw'>('type')
  const lastSaved=useRef(noteDraftSignature(note?draft:{...draft,text:'',strokes:[],image:null}))
  const [hasLocal,setHasLocal]=useState(Boolean(note))
  const dirty = !loading && lastSaved.current !== noteDraftSignature(draft)
  useEffect(()=>{
    if(!dirty && !busy)return
    const preventLoss=(event:BeforeUnloadEvent):void=>{event.preventDefault();event.returnValue=''}
    window.addEventListener('beforeunload',preventLoss)
    return()=>window.removeEventListener('beforeunload',preventLoss)
  },[dirty,busy])
  useEffect(()=>{if(draft.destination.kind==='notion')setDraft(d=>({...d,destination:{...d.destination,kind:'none'}}))},[draft.destination.kind])
  useEffect(()=>{
    if(note)return
    let active=true
    void window.api.invoke('notes:list',itemId,blockId??undefined).then(rows=>{
      if(!active)return
      const loaded=loadRecallNoteDraft(draft,rows,initialText,initialDrawing)
      lastSaved.current=loaded.baseline;setHasLocal(loaded.hasLocal);setDraft(loaded.draft)
    }).catch(e=>{if(active)setError(String(e))}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[])
  const patch=(p:Partial<NoteInput>)=>{setDraft((d)=>({...d,...p}));setMessage('')}
  const dest=(p:Partial<NoteDestination>)=>{patch({destination:{...draft.destination,...p}})}
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
  const save=async(sync:boolean)=>run(async()=>{const saved=await window.api.invoke('notes:save',draft,sync);setHasLocal(true);setDraft(saved);lastSaved.current=noteDraftSignature(saved);onSaved?.(saved);void useBlocks.getState().refresh();if(saved.status==='failed'){setError(uiText('Saved in A14 Pomodoro. Sending failed: {error}',{error:saved.error}));setMessage('')}else setMessage(uiText(saved.status==='synced'?'Saved in A14 Pomodoro and Obsidian.':'Saved in A14 Pomodoro.'));})
  const closeEditor=async()=>{if(busy)return;if(lastSaved.current!==noteDraftSignature(draft)&&!await confirmAction(uiText('Close without saving your note changes?'),uiText('Discard changes'),uiText('Unsaved note'),true))return;onClose()}
  const deleteLocal=async()=>{
    if(busy||!hasLocal||draft.blockId!==null)return
    if(!await confirmAction(uiText('Delete this note from A14 Pomodoro? Exported copies are kept.'),'Delete local note','Delete local note',true))return
    await run(async()=>{await window.api.invoke('notes:delete',draft.id);lastSaved.current=noteDraftSignature(draft);setHasLocal(false);onClose()})
  }
  return <Dialog title={uiText("Study notes")} onClose={closeEditor}>
    {loading?<p>{uiText("Loading notes…")}</p>:<div className="flex flex-col gap-5"><label><span className="mb-2 block text-sm text-muted">{uiText("Note title")}</span><input dir="auto" aria-label={uiText("Note title")} className={inputClass} value={draft.title} onChange={(e)=>patch({title:e.target.value})} /></label>
      <div className="flex gap-2"><Button aria-pressed={tab==='type'} onClick={()=>setTab('type')}>{uiText("Type")}</Button><Button aria-pressed={tab==='draw'} onClick={()=>setTab('draw')}>{uiText("Draw")}</Button></div>
      {tab==='type'?<textarea dir="auto" aria-label={uiText("Study note text")} spellCheck className={`${inputClass} min-h-64 font-writing`} style={{fontSize:'var(--tf-writing-size)'}} value={draft.text} onChange={(e)=>patch({text:e.target.value})}/>:<Whiteboard strokes={draft.strokes} onChange={(strokes,image)=>patch({strokes,image})}/>}
      <p role="status" className="text-sm text-muted">{message || (lastSaved.current && lastSaved.current !== noteDraftSignature(draft) ? uiText('Unsaved changes') : hasLocal ? uiText('Saved in A14 Pomodoro') : uiText('Save this note in A14 Pomodoro. Sending to Obsidian is optional.'))}</p><details className="rounded-xl border border-line bg-surface-2/30 p-4"><summary className="cursor-pointer font-semibold">{uiText("Obsidian options")}</summary><div className="mt-3 flex flex-col gap-3">
        <select aria-label={uiText("Notes destination")} className={inputClass} value={draft.destination.kind} onChange={(e)=>dest({kind:e.target.value as NoteDestination['kind']})}><option value="none">{uiText("Only in A14 Pomodoro")}</option><option value="obsidian">{uiText("Obsidian")}</option></select>
        {draft.destination.kind==='obsidian'&&<><div className="flex gap-2"><input aria-label={uiText("Obsidian vault folder")} className={`${inputClass} flex-1`} placeholder={uiText("Vault folder")} value={draft.destination.vaultPath} onChange={(e)=>dest({vaultPath:e.target.value})}/><Button disabled={busy} onClick={()=>void run(async()=>{const path=await window.api.invoke('notes:pickVault');if(path)dest({vaultPath:path,vaultName:path.split(/[\\/]/).pop()??''})})}>{uiText("Choose vault")}</Button></div><input aria-label={uiText("Obsidian vault name")} className={inputClass} placeholder={uiText("Vault name in Obsidian")} value={draft.destination.vaultName} onChange={(e)=>dest({vaultName:e.target.value})}/><div className="flex gap-2"><input aria-label={uiText("Obsidian note file")} className={`${inputClass} flex-1`} placeholder={uiText("Folder/Subject.md")} value={draft.destination.file} onChange={(e)=>dest({file:e.target.value})}/><Button disabled={busy} onClick={()=>void run(async()=>{const file=await window.api.invoke('notes:pickFile',draft.destination.vaultPath);if(file)dest({file})})}>{uiText("Choose file")}</Button></div><input aria-label={uiText("Obsidian section heading")} className={inputClass} placeholder={uiText("Section heading (optional, e.g. Study notes)")} value={draft.destination.heading} onChange={(e)=>dest({heading:e.target.value})}/><p className="text-sm text-muted">{uiText("Adds this note under the chosen heading, or at the end. Creates a missing file or heading. Saving again updates this note and keeps the rest of the file.")}</p></>}
      </div></details>
      {error&&<p role="alert" className="text-status-error">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3">{hasLocal&&draft.blockId===null&&<Button variant="ghost" disabled={busy} onClick={()=>void deleteLocal()}>{uiText('Delete local note')}</Button>}<Button disabled={busy} onClick={closeEditor}>{uiText("Close")}</Button><Button disabled={busy} onClick={()=>void run(async()=>window.api.invoke('notes:copy',draft,false))}>{uiText("Copy text")}</Button>{draft.image&&<Button disabled={busy} onClick={()=>void run(async()=>window.api.invoke('notes:copy',draft,true))}>{uiText("Copy drawing")}</Button>}<Button variant="primary" disabled={busy} onClick={()=>void save(false)}>{busy?uiText("Saving…"):uiText("Save in A14 Pomodoro")}</Button>{draft.destination.kind==='obsidian'&&<Button disabled={busy} onClick={()=>void save(true)}>{uiText("Send to Obsidian")}</Button>}</div>
    </div>}
  </Dialog>
}

export function SavedNotes({ itemId, blockId, recallText }: { itemId: number; blockId?: number; recallText?: string|null }): React.JSX.Element {
  const [notes,setNotes]=useState<StudyNote[]>([]),[editing,setEditing]=useState<StudyNote|null>(null),[fresh,setFresh]=useState(false),[error,setError]=useState('')
  const blocks=useBlocks((s)=>s.blocks)
  const load=()=>void window.api.invoke('notes:list',itemId,blockId).then(setNotes).catch((e)=>setError(String(e)))
  useEffect(load,[itemId,blockId])
  return <div className="flex flex-col gap-4">{blockId===undefined&&<Button variant="primary" className="self-start" onClick={()=>setFresh(true)}>{uiText("Write a note")}</Button>}{error&&<p role="alert" className="text-status-error">{error}</p>}{notes.map((n)=><article key={n.id} className="rounded-xl border border-line bg-writing p-4"><div className="mb-3 flex flex-wrap items-center gap-3"><h3 className="flex-1 font-semibold" dir="auto">{n.title}</h3><Button size="sm" onClick={()=>setEditing(n)}>{uiText("Edit note")}</Button>{n.blockId!==null&&blocks.some((b)=>b.id===n.blockId)&&<Button size="sm" onClick={()=>useUi.getState().openHistorySession(blocks.find((b)=>b.id===n.blockId)!.sessionId)}>{uiText("Open session")}</Button>}{n.link&&<Button size="sm" onClick={()=>void window.api.invoke('shell:open',n.link!)}>{uiText("Open external note")}</Button>}<span className="text-sm text-muted">{n.status==='synced'?uiText("Sent"):n.status==='failed'?uiText("Send failed · saved locally"):uiText("Local note")}</span></div>{n.id===`recall-${blockId}`&&n.text.trim()===recallText?.trim()?<p className="text-sm text-muted">{uiText("Saved recall copy")}</p>:<p dir="auto" className="whitespace-pre-wrap font-writing" style={{fontSize:'var(--tf-writing-size)'}}>{n.text}</p>}{n.image&&<img src={n.image} alt={uiText("Saved study whiteboard")} className="mt-3 w-full rounded-lg bg-white"/>}</article>)}{(fresh||editing)&&<NotesEditor itemId={itemId} blockId={blockId??null} note={editing??undefined} onClose={()=>{setFresh(false);setEditing(null);load()}}/>}</div>
}
