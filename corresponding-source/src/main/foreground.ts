import { app } from 'electron'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { ForegroundSample } from '@core/tracking'

export interface WatcherSample extends ForegroundSample { pid: number }
export type WatcherStatus = { state: 'stopped' } | { state: 'running' } | { state: 'failed'; reason: string }
export interface ForegroundWatcher extends EventEmitter<{ sample: [WatcherSample]; status: [WatcherStatus] }> {
  start(): void
  stop(): void
  status(): WatcherStatus
  setTitlesEnabled?(enabled:boolean):void
  fail?():void
}
export interface NativeForeground { read(titles:boolean): Omit<WatcherSample,'at'> | null }

function loadNative():NativeForeground {
  if(process.platform!=='win32'||process.arch!=='x64')throw Error()
  // Fixed application-owned file. No PATH search, shell, runtime compilation or
  // permission elevation. ASAR resources are explicitly unpacked by the build.
  const root=app.isPackaged?join(process.resourcesPath,'app.asar.unpacked/resources'):join(process.cwd(),'resources')
  return createRequire(join(process.cwd(),'package.json'))(join(root,'native/win32-x64/foreground.node')) as NativeForeground
}

/** No helper process or background thread: a bounded Windows query every 2 s
 * only while the Tracker supplies an active, consented context. */
export class NativeForegroundWatcher extends EventEmitter<{ sample: [WatcherSample]; status: [WatcherStatus] }> implements ForegroundWatcher {
  private timer:NodeJS.Timeout|null=null
  private wanted=false
  private native:NativeForeground|null=null
  private titles=false
  private current:WatcherStatus={state:'stopped'}
  constructor(private load:()=>NativeForeground=loadNative,private now:()=>number=Date.now,private beforeRead:()=>void=()=>{}){super()}
  status():WatcherStatus{return this.current}
  setTitlesEnabled(enabled:boolean):void{this.titles=enabled===true}
  start():void {
    if(this.wanted)return
    this.wanted=true
    try{this.native=this.load()}catch{this.fail();return}
    this.poll()
    if(this.wanted&&this.native){this.timer=setInterval(()=>this.poll(),2000);this.timer.unref?.()}
  }
  stop():void {
    this.wanted=false
    if(this.timer)clearInterval(this.timer)
    this.timer=null;this.native=null
    if(this.current.state!=='failed')this.setStatus({state:'stopped'})
  }
  private poll():void {
    if(!this.wanted||!this.native)return
    try{
      this.beforeRead() // Timing recovery can stop the watcher before any OS query.
      if(!this.wanted||!this.native)return
      const s=this.native.read(this.titles)
      if(!s){this.setStatus({state:'failed',reason:'No accessible foreground window. Unobserved time is not assigned to an app.'});return}
      if(!Number.isInteger(s.pid)||s.pid<=0||typeof s.process!=='string'||!s.process.trim()||s.process.length>260||typeof s.title!=='string'||s.title.length>1023)throw Error()
      this.setStatus({state:'running'})
      this.emit('sample',{at:this.now(),pid:s.pid,process:s.process,title:this.titles?s.title:''})
    }catch{
      this.fail()
    }
  }
  fail():void {
    if(this.timer)clearInterval(this.timer)
    this.timer=null;this.native=null;this.wanted=true
    this.setStatus({state:'failed',reason:'Window monitoring is unavailable. Studying still works; turn tracking off and on to retry.'})
  }
  private setStatus(status:WatcherStatus):void {
    if(JSON.stringify(this.current)===JSON.stringify(status))return
    this.current=status;this.emit('status',status)
  }
}
