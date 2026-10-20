import { t as uiText } from '../i18n'
import { createRoot } from 'react-dom/client'
import { useEffect, useRef } from 'react'
import { Button } from './ui'

interface Request { message:string; title:string; action:string; alert:boolean; danger:boolean; finish:(accepted:boolean)=>void }
let pending:Promise<void>=Promise.resolve()
function request(message:string,title:string,action:string,alert=false,danger=false):Promise<boolean> {
  let finish!:(accepted:boolean)=>void
  const answer=new Promise<boolean>(resolve=>{finish=resolve})
  pending=pending.then(()=>new Promise<void>(done=>{
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
    const previous=document.activeElement as HTMLElement|null
    const complete=(accepted:boolean)=>{root.unmount();host.remove();if(previous?.isConnected)previous.focus();finish(accepted);done()}
    root.render(<AppDialog request={{message,title,action,alert,danger,finish:complete}}/>)
  }))
  return answer
}
export const confirmAction=(message:string,action='Continue',title='Confirm action',danger=false):Promise<boolean>=>request(uiText(message),uiText(title),uiText(action),false,danger)
export const showMessage=(message:string,title='Something needs your attention'):Promise<boolean>=>request(uiText(message),uiText(title),uiText('Got it'),true)

function AppDialog({request:r}:{request:Request}):React.JSX.Element {
  const dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null),settled=useRef(false)
  const finish=(accepted:boolean)=>{if(settled.current)return;settled.current=true;r.finish(accepted)}
  useEffect(()=>{dialog.current?.showModal();cancel.current?.focus()},[])
  return <dialog ref={dialog} aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message" className="app-confirm-dialog m-auto w-[min(34rem,calc(100vw/var(--tf-zoom,1)-3rem))] rounded-2xl border border-line bg-surface p-7 text-ink shadow-2xl" onCancel={e=>{e.preventDefault();finish(false)}} onKeyDown={e=>e.stopPropagation()}>
    <div aria-hidden="true" className={`mb-4 grid size-12 place-items-center rounded-xl text-2xl ${r.danger?'bg-overtime/15 text-overtime':'bg-focus/10 text-focus'}`}>{r.danger?'!':r.alert?'i':'?'}</div>
    <h2 id="app-dialog-title" className="text-2xl font-semibold">{r.title}</h2><p id="app-dialog-message" className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-muted">{r.message}</p>
    <div className="mt-7 flex justify-end gap-3">{!r.alert&&<button ref={cancel} type="button" className="min-h-11 rounded-lg border border-line px-5 text-base hover:bg-surface-2" onClick={()=>finish(false)}>{uiText("Cancel")}</button>}<Button autoFocus={r.alert} variant={r.danger?'danger':'primary'} className={r.danger?'border border-overtime bg-overtime/10 font-semibold':''} onClick={()=>finish(true)}>{r.action}</Button></div>
  </dialog>
}
