import { t as uiText } from '../i18n'
import { useState } from 'react'
import { useSettings } from '../store/session'
import { Button, inputClass } from './ui'

export function NotesSettings(): React.JSX.Element {
  const {settings,set}=useSettings()
  const [error,setError]=useState('')
  const run=async(fn:()=>Promise<void>)=>{setError('');try{await fn()}catch(e){setError(e instanceof Error?e.message:String(e))}}
  return <div className="flex flex-col gap-4">
    <div aria-label={uiText("Notes saving workflow")} className="grid gap-3 rounded-xl border border-line bg-surface-2/30 p-4 sm:grid-cols-3">{[{symbol:'✎',title:'Write in FocusRecall',hint:'Keep text and drawings together'},{symbol:'↗',title:'Choose a destination',hint:'Choose a vault and note file'},{symbol:'✓',title:'Save and send',hint:'A local copy stays in your Library'}].map((step)=><div key={step.title} className="flex items-start gap-3"><span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-focus/10 text-xl text-focus">{step.symbol}</span><span><span className="block font-medium">{step.title}</span><span className="mt-1 block text-sm text-muted">{step.hint}</span></span></div>)}</div>
    <label><span className="mb-2 block font-medium">{uiText("Default notes app")}</span><select aria-label={uiText("Default notes app")} className={inputClass} value={settings.defaultNotesApp==='notion'?'none':settings.defaultNotesApp} onChange={(e)=>void set('defaultNotesApp',e.target.value as 'none'|'obsidian')}><option value="none">{uiText("FocusRecall only")}</option><option value="obsidian">{uiText("Obsidian")}</option></select></label>
    <label><span className="mb-2 block font-medium">{uiText("Obsidian vault folder")}</span><div className="flex flex-wrap gap-3"><input aria-label={uiText("Default Obsidian vault folder")} className={`${inputClass} min-w-0 flex-1`} value={settings.obsidianVaultPath} onChange={(e)=>void set('obsidianVaultPath',e.target.value)}/><Button onClick={()=>void run(async()=>{const path=await window.api.invoke('notes:pickVault');if(path){await set('obsidianVaultPath',path);await set('obsidianVaultName',path.split(/[\\/]/).pop()??'')}})}>{uiText("Choose vault")}</Button></div></label>
    <label><span className="mb-2 block font-medium">{uiText("Obsidian vault name")}</span><input aria-label={uiText("Default Obsidian vault name")} className={inputClass} value={settings.obsidianVaultName} onChange={(e)=>void set('obsidianVaultName',e.target.value)}/></label>
    {error&&<p role="alert" className="text-status-error">{error}</p>}
  </div>
}
