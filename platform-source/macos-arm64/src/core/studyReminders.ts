import type { AppSettings } from './settings'
import type { StudyTimePattern } from './personalInsights'
export type ReminderSettings=Pick<AppSettings,'studyReminderDailyEnabled'|'studyReminderDailyTime'|'studyReminderSmartEnabled'|'studyReminderQuietStart'|'studyReminderQuietEnd'>
export interface ReminderState { dailyDay:string; smartDay:string; lastAttemptAt:number; pausedUntil:number }
export interface ReminderStatus { supported:boolean; pausedUntil:number; lastAttemptAt:number; lastError:string|null; patterns:StudyTimePattern[] }
export interface ReminderContext { now:Date; active:boolean; busy:boolean; appFocused:boolean }
export interface StudyReminder { kind:'daily'|'smart'; day:string; title:string; body:string }
export const EMPTY_REMINDER_STATE:ReminderState={dailyDay:'',smartDay:'',lastAttemptAt:0,pausedUntil:0}
export const reminderDay=(d:Date):string=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
export const clockMinutes=(time:string):number=>/^([01]\d|2[0-3]):[0-5]\d$/.test(time)?Number(time.slice(0,2))*60+Number(time.slice(3)):NaN
export function quietAt(minute:number,start:string,end:string):boolean {
  const a=clockMinutes(start),b=clockMinutes(end)
  if(!Number.isFinite(a)||!Number.isFinite(b))return true
  return a===b?false:a<b?minute>=a&&minute<b:minute>=a||minute<b
}
export function reminderReady(state:ReminderState,c:ReminderContext):boolean {
  const now=c.now.getTime()
  return Number.isFinite(now)&&c.active&&!c.busy&&!c.appFocused&&now>=state.pausedUntil&&(!state.lastAttemptAt||now-state.lastAttemptAt>=4*3600000)
}
export function chooseStudyReminder(settings:ReminderSettings,state:ReminderState,c:ReminderContext,_patterns:StudyTimePattern[]):StudyReminder|null {
  if(!reminderReady(state,c))return null
  const day=reminderDay(c.now),minute=c.now.getHours()*60+c.now.getMinutes(),scheduled=clockMinutes(settings.studyReminderDailyTime)
  if(settings.studyReminderDailyEnabled&&state.dailyDay!==day&&Number.isFinite(scheduled)&&minute>=scheduled&&minute<scheduled+60)return {kind:'daily',day,title:'Time for a study session?',body:'This is your daily FocusRecall reminder. Choose a subject and take one small step.'}
  // Legacy preferences and wire types remain readable; inferred timing is retired.
  return null
}
export function stateAfterReminder(state:ReminderState,reminder:StudyReminder,now:number):ReminderState {
  return {...state,lastAttemptAt:now,[reminder.kind==='daily'?'dailyDay':'smartDay']:reminder.day}
}
export function readReminderState(value:unknown):ReminderState {
  const o=(value&&typeof value==='object'?value:{}) as Partial<ReminderState>
  return {dailyDay:typeof o.dailyDay==='string'?o.dailyDay:'',smartDay:typeof o.smartDay==='string'?o.smartDay:'',lastAttemptAt:typeof o.lastAttemptAt==='number'&&Number.isFinite(o.lastAttemptAt)?Math.max(0,o.lastAttemptAt):0,pausedUntil:typeof o.pausedUntil==='number'&&Number.isFinite(o.pausedUntil)?Math.max(0,o.pausedUntil):0}
}
