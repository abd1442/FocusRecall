import { app, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { roleCanInvoke, trustedPage, type RendererRole } from '@core/desktopSecurity'
import { validateIpcArgs } from '@core/ipcValidation'

declare const __FOCUSRECALL_QA__: boolean

export function rendererDevToolsAllowed():boolean{return !app.isPackaged||__FOCUSRECALL_QA__}

const callers = new Map<number,{window:BrowserWindow;role:RendererRole;page:string}>()
export function protectRenderer(window:BrowserWindow,role:RendererRole):void {
  const base=(!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) || pathToFileURL(join(__dirname,'../renderer/index.html')).href
  const page=base+(role==='main'?'':`#${role}`)
  const contents=window.webContents
  if(app.isPackaged&&!__FOCUSRECALL_QA__){contents.on('devtools-opened',()=>contents.closeDevTools())}
  if(app.isPackaged&&__FOCUSRECALL_QA__){window.setTitle('FocusRecall QA');contents.on('page-title-updated',event=>{event.preventDefault();window.setTitle('FocusRecall QA')})}
  callers.set(contents.id,{window,role,page})
  contents.once('destroyed',()=>callers.delete(contents.id))
  contents.on('will-navigate',(event,url)=>{if(!trustedPage(url,page))event.preventDefault()})
  contents.on('will-frame-navigate',(event)=>{if(!trustedPage(event.url,page))event.preventDefault()})
  contents.on('will-redirect',(event)=>event.preventDefault())
  contents.on('will-attach-webview',event=>event.preventDefault())
  contents.setWindowOpenHandler(()=>({action:'deny'}))
}
export function assertCaller(event:IpcMainInvokeEvent,channel:string,args:unknown[]):void {
  const caller=callers.get(event.sender.id)
  if(!caller || caller.window.isDestroyed() || event.senderFrame!==event.sender.mainFrame || !trustedPage(event.senderFrame.url,caller.page))throw Error('Untrusted IPC caller.')
  validateIpcArgs(channel,args)
  if(!roleCanInvoke(caller.role,channel,args))throw Error('This window cannot use that action.')
}
