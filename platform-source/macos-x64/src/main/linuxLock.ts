import { execFile, spawn } from 'node:child_process'

export type LockState = 'active' | 'locked' | 'unknown'
export interface LockProvider { name:string; path:string; iface:string }
export function lockProviders(desktop=process.env.XDG_CURRENT_DESKTOP??''):LockProvider[] {
  if(/(^|:)GNOME(:|$)|(^|:)ubuntu(:|$)/i.test(desktop))return [
    {name:'org.gnome.Shell.ScreenShield',path:'/org/gnome/ScreenSaver',iface:'org.gnome.ScreenSaver'},
    {name:'org.gnome.ScreenSaver',path:'/org/gnome/ScreenSaver',iface:'org.gnome.ScreenSaver'}]
  if(/(^|:)KDE(:|$)/i.test(desktop))return [{name:'org.freedesktop.ScreenSaver',path:'/ScreenSaver',iface:'org.freedesktop.ScreenSaver'}]
  return []
}
export const parseLockReply=(value:string):LockState=>/^\(false,\)\s*$/.test(value)?'active':/^\(true,\)\s*$/.test(value)?'locked':'unknown'
export interface LockTransport {
  read(provider:LockProvider):Promise<LockState>
  watch(provider:LockProvider,line:(value:string)=>void,exit:()=>void):()=>void
}
const transport:LockTransport={
  read:p=>new Promise(resolve=>execFile('/usr/bin/gdbus',['call','--session','--dest',p.name,'--object-path',p.path,'--method',p.iface+'.GetActive'],{timeout:1200,maxBuffer:4096,encoding:'utf8',env:{...process.env,LC_ALL:'C'}},(error,out)=>resolve(error?'unknown':parseLockReply(out)))),
  watch:(p,line,exit)=>{
    // One bounded read-only subscription, no titles, input capture or shell.
    const child=spawn('/usr/bin/gdbus',['monitor','--session','--dest',p.name,'--object-path',p.path],{stdio:['ignore','pipe','ignore'],env:{...process.env,LC_ALL:'C'}})
    let buffer='',stopped=false
    const stop=():void=>{if(stopped)return;stopped=true;child.kill()}
    child.stdout.on('data',(chunk:Buffer)=>{
      buffer+=chunk.toString();if(buffer.length>16384){stop();exit();return}
      let at:number;while((at=buffer.indexOf('\n'))>=0){const value=buffer.slice(0,at);buffer=buffer.slice(at+1);line(value)}
    })
    child.once('error',exit);child.once('exit',exit)
    return stop
  }
}
/** A lock pulse is delivered immediately, including lock/unlock between polls.
 * Query replies from before an event/owner change must never override it. */
export class LinuxLockWatch {
  state:LockState='unknown'
  private stop:(()=>void)|null=null
  private disposed=false
  private generation=0
  private busy=false
  private retryAt=0
  constructor(private changed:(state:LockState)=>void,private io=transport,private providers=lockProviders(),private now=Date.now){}
  private set(state:LockState):void{this.state=state;this.changed(state)}
  private disconnect():void{this.stop?.();this.stop=null}
  async start():Promise<void>{
    if(this.disposed||this.busy||this.stop||this.now()<this.retryAt)return
    this.busy=true;this.retryAt=this.now()+10000
    try{for(const provider of this.providers){
      if(this.disposed)break
      const token=++this.generation
      const ready=await new Promise<boolean>(resolve=>{
        let finished=false,events=0
        const done=(ok:boolean):void=>{if(!finished){finished=true;clearTimeout(timer);resolve(ok)}}
        const timer=setTimeout(()=>done(false),1800)
        try{this.stop=this.io.watch(provider,value=>{
          if(this.disposed||token!==this.generation)return
          if(value===`The name ${provider.name} does not have an owner`){events++;this.set('unknown');done(false);return}
          if(value.startsWith(`The name ${provider.name} is owned by :`)){
            const before=++events;this.set('unknown')
            void this.io.read(provider).then(state=>{
              if(this.disposed||token!==this.generation||before!==events)return
              this.set(state);done(state!=='unknown')
            }).catch(()=>{if(token===this.generation&&!this.disposed){this.set('unknown');done(false)}})
          }else{
            const prefix=`${provider.path}: ${provider.iface}.ActiveChanged `
            if(value.startsWith(prefix)){events++;const state=parseLockReply(value.slice(prefix.length));this.set(state);done(state!=='unknown')}
          }
        },()=>{if(token===this.generation&&!this.disposed){this.stop=null;events++;this.set('unknown');done(false)}})}catch{this.set('unknown');done(false)}
      })
      if(ready&&!this.disposed)return
      ++this.generation;this.disconnect()
    }}catch{++this.generation;this.disconnect();this.set('unknown')}finally{this.busy=false}
  }
  dispose():void{this.disposed=true;++this.generation;this.stop?.();this.stop=null;this.state='unknown'}
}
