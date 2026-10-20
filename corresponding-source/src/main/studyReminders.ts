import type { StudyTimePattern } from '@core/personalInsights'
import { chooseStudyReminder,readReminderState,reminderReady,type ReminderContext,type ReminderSettings,type ReminderState,type ReminderStatus,stateAfterReminder } from '@core/studyReminders'
export interface ReminderDependencies {
  settings:()=>ReminderSettings; read:()=>unknown; write:(state:ReminderState)=>void
  context:()=>Omit<ReminderContext,'now'>; patterns:()=>StudyTimePattern[]
  supported:()=>boolean; send:(title:string,body:string)=>Promise<boolean>; now?:()=>Date
}
export class StudyReminderService {
  private state:ReminderState
  private timer:NodeJS.Timeout|null=null
  private lastError:string|null=null
  private inFlight=false;private preparing=false;private lastTestAt=0
  constructor(private deps:ReminderDependencies){this.state=readReminderState(deps.read())}
  private now():Date{return this.deps.now?.()??new Date()}
  setPreparing(active:boolean):void{this.preparing=active}
  invalidate():void{} // Compatibility hook; personal analysis is retired.
  status():ReminderStatus {
    return {supported:this.deps.supported(),pausedUntil:this.state.pausedUntil,lastAttemptAt:this.state.lastAttemptAt,lastError:this.lastError,patterns:[]}
  }
  pause(mode:'hour'|'today'|'resume'):ReminderStatus {
    const now=this.now(),until=mode==='resume'?0:mode==='hour'?now.getTime()+3600000:new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime()
    const next={...this.state,pausedUntil:until};this.deps.write(next);this.state=next;return this.status()
  }
  async test():Promise<ReminderStatus>{
    if(!this.deps.supported())throw Error('Windows notifications are not available.')
    const now=this.now().getTime()
    if(this.inFlight||this.lastTestAt&&now-this.lastTestAt<10000)throw Error('Wait a few seconds before testing again.')
    if(!this.deps.context().active)throw Error('Unlock your PC and return before testing a notification.')
    this.lastTestAt=now;this.inFlight=true
    try{this.lastError=await this.deps.send('FocusRecall test reminder','Study reminders appear here. Click to open FocusRecall.')?null:'Windows did not accept the notification. Check Windows notification settings.'}
    finally{this.inFlight=false}
    return this.status()
  }
  async tick():Promise<void>{
    if(this.inFlight||!this.deps.supported())return
    const settings=this.deps.settings()
    if(!settings.studyReminderDailyEnabled)return
    const context={...this.deps.context(),now:this.now()};context.busy=context.busy||this.preparing
    if(!reminderReady(this.state,context))return
    const reminder=chooseStudyReminder(settings,this.state,context,[])
    if(!reminder)return
    this.inFlight=true
    try{
      // Persist a reservation before delivery, so restart or failure cannot spam retries.
      const next=stateAfterReminder(this.state,reminder,context.now.getTime());this.deps.write(next);this.state=next
      this.lastError=await this.deps.send(reminder.title,reminder.body)?null:'Windows did not accept the reminder. Check notification settings or try a test.'
    }catch{this.lastError='The reminder could not be sent. Your study records were not changed.'}
    finally{this.inFlight=false}
  }
  start():void{if(!this.timer)this.timer=setInterval(()=>{void this.tick().catch(()=>{this.lastError='Reminders are temporarily unavailable.'})},30000)}
  dispose():void{if(this.timer)clearInterval(this.timer);this.timer=null}
}
