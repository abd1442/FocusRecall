import { t as uiText } from '../i18n'
import { useState } from 'react'
import { Button } from './ui'
import { confirmAction } from './appDialogs'

export function BackupSettings():React.JSX.Element {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false),[saved,setSaved]=useState(false)
  const run=async(work:()=>Promise<void>):Promise<void>=>{
    if(busy)return
    setBusy(true);setMessage('');setFailed(false)
    try{await work()}catch(e){setFailed(true);setMessage(e instanceof Error?e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/,''):String(e))}finally{setBusy(false)}
  }
  return <div className="flex flex-col gap-4 p-6">
    <h3 className="text-lg font-semibold">{uiText("Backup and restore")}</h3>
    <p className="text-muted">{uiText("Back up saved study records, notes and settings.")}</p>
    <p className="text-sm text-muted">{uiText("External vaults, exports and unsaved work need separate backups.")}</p>
    <div className="flex flex-wrap gap-3">
      <Button variant="primary" disabled={busy} onClick={()=>run(async()=>{const result=await window.api.invoke('backup:create');if(result){setSaved(true);setMessage(uiText('Backup created and verified: {name}',{name:result.name}))}})}>{uiText("Back Up Data")}</Button>
      <Button variant="quiet" disabled={busy} onClick={()=>run(async()=>{
        const backup=await window.api.invoke('backup:inspectRestore');if(!backup)return
        if(!await confirmAction(uiText('Restore {name}?\n\nThis replaces the current study database, including newer records and settings, with this backup. Save your work first. A verified safety backup of your current database will be kept. A14 Pomodoro restarts to restore safely. External Obsidian content is not changed.',{name:backup.name}),'Restore and restart','Restore previous data?',true))return
        setMessage(uiText('Preparing a safety backup and restarting…'));await window.api.invoke('backup:restore',backup.token)
      })}>{uiText("Restore Backup")}</Button>
      <Button variant="ghost" disabled={busy} onClick={()=>run(()=>window.api.invoke('backup:openFolder'))}>{uiText("Open backup folder")}</Button>
      {saved && <Button variant="ghost" disabled={busy} onClick={()=>run(()=>window.api.invoke('backup:reveal'))}>{uiText("Show saved backup")}</Button>}
    </div>
    <details className="text-sm text-muted"><summary className="min-h-11 cursor-pointer py-3">{uiText("Backup details")}</summary><p>{uiText("Includes saved sessions, subjects, logs, recall, notes, drawings, study tools and settings. Excludes external vaults, exported reports, Windows profile files, demo-mode choice and unsaved forms.")}</p><p className="mt-2">{uiText("Keeps three verified automatic snapshots before schema upgrades. Manual and pre-restore safety backups are kept separately.")}</p></details>
    {message && <p role={failed?'alert':'status'} className={failed?'text-status-error':'text-muted'}>{message}</p>}
  </div>
}
