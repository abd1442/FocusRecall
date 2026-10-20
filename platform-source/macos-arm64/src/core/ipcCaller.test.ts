import { beforeEach,expect,it,vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { app, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
vi.mock('electron',()=>({app:{isPackaged:false}}))
import { assertCaller,protectRenderer,rendererDevToolsAllowed } from '../main/security'
let window:BrowserWindow,contents:EventEmitter&{id:number;mainFrame:{url:string};setWindowOpenHandler:ReturnType<typeof vi.fn>},frame:{url:string}
let id=1000
beforeEach(()=>{
 vi.stubEnv('ELECTRON_RENDERER_URL','http://localhost:5173')
 frame={url:'http://localhost:5173#panel'}
 contents=Object.assign(new EventEmitter(),{id:++id,mainFrame:frame,setWindowOpenHandler:vi.fn()})
 window={webContents:contents,isDestroyed:()=>false} as unknown as BrowserWindow
 protectRenderer(window,'panel')
})
const event=():IpcMainInvokeEvent=>({sender:contents,senderFrame:frame} as unknown as IpcMainInvokeEvent)
it('accepts a registered main frame and rejects subframes even with the same URL',()=>{
 expect(()=>assertCaller(event(),'session:get',[])).not.toThrow()
 expect(()=>assertCaller({...event(),senderFrame:{url:frame.url}} as IpcMainInvokeEvent,'session:get',[])).toThrow('Untrusted')
})
it('rejects an unregistered sender, a navigated renderer and restricted helper channels',()=>{
 expect(()=>assertCaller({...event(),sender:{id:-1}} as IpcMainInvokeEvent,'session:get',[])).toThrow()
 expect(()=>assertCaller(event(),'backup:restore',['fake'])).toThrow()
 frame.url='https://evil.example/';expect(()=>assertCaller(event(),'session:get',[])).toThrow()
})
it('blocks navigation, redirects, embedded webviews and window creation',()=>{
 for(const [name,args] of [['will-navigate',['https://evil.example/']],['will-frame-navigate',[]],['will-redirect',[]],['will-attach-webview',[]]] as const){const preventDefault=vi.fn();contents.emit(name,{preventDefault,url:'https://evil.example/'},...args);expect(preventDefault).toHaveBeenCalled()}
 expect(contents.setWindowOpenHandler.mock.calls[0][0]({url:'https://example.com'})).toEqual({action:'deny'})
 contents.emit('destroyed');expect(()=>assertCaller(event(),'session:get',[])).toThrow()
})

it('does not trust a renderer URL override or allow DevTools in packaged production',()=>{
 vi.stubGlobal('__FOCUSRECALL_QA__',false);(app as {isPackaged:boolean}).isPackaged=true
 try{
  expect(rendererDevToolsAllowed()).toBe(false)
  protectRenderer(window,'main')
  expect(()=>assertCaller(event(),'session:get',[])).toThrow('Untrusted')
 }finally{(app as {isPackaged:boolean}).isPackaged=false;vi.unstubAllGlobals()}
})
