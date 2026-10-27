import { describe,it,expect,vi } from 'vitest'
import { DEFAULT_SETTINGS } from './settings'
import { chooseStudyReminder,EMPTY_REMINDER_STATE,quietAt,readReminderState,reminderDay,stateAfterReminder,type ReminderContext,type ReminderState } from './studyReminders'
import { StudyReminderService } from '../main/studyReminders'
const now=(day=15,hour=18,minute=0):Date=>new Date(2026,9,day,hour,minute)
const context=(date=now()):ReminderContext=>({now:date,active:true,busy:false,appFocused:false})
const config={...DEFAULT_SETTINGS,studyReminderDailyEnabled:true,studyReminderSmartEnabled:true}
const pattern={startHour:8,endHour:10,sessions:20,otherSessions:20,days:10,otherDays:10}
describe('study reminder decisions',()=>{
 it('is opt-in and uses the chosen local time, with a bounded catch-up window',()=>{
  expect(chooseStudyReminder(DEFAULT_SETTINGS,EMPTY_REMINDER_STATE,context(),[pattern])).toBeNull()
  expect(chooseStudyReminder(config,EMPTY_REMINDER_STATE,context(now(15,17,59)),[])).toBeNull()
  expect(chooseStudyReminder(config,EMPTY_REMINDER_STATE,context(),[])?.kind).toBe('daily')
  expect(chooseStudyReminder(config,EMPTY_REMINDER_STATE,context(now(15,18,59)),[])?.kind).toBe('daily')
  expect(chooseStudyReminder(config,EMPTY_REMINDER_STATE,context(now(15,19)),[])).toBeNull()
 })
 it('does not replay a missed day, or repeat the same daily reminder after restart/time edits',()=>{
  const sent=stateAfterReminder(EMPTY_REMINDER_STATE,{kind:'daily',day:reminderDay(now()),title:'',body:''},now().getTime())
  expect(chooseStudyReminder({...config,studyReminderDailyTime:'23:00'},readReminderState(sent),context(now(15,23)),[])).toBeNull()
  expect(chooseStudyReminder(config,sent,context(now(16,8)),[])).toBeNull()
  expect(chooseStudyReminder(config,sent,context(now(16)),[])?.kind).toBe('daily')
 })
 it.each(['inactive','busy','focused','paused','cooldown','clock-backwards'])('suppresses interruption: %s',kind=>{
  const c=context(),s={...EMPTY_REMINDER_STATE}
  if(kind==='inactive')c.active=false
  if(kind==='busy')c.busy=true
  if(kind==='focused')c.appFocused=true
  if(kind==='paused')s.pausedUntil=c.now.getTime()+60000
  if(kind==='cooldown')s.lastAttemptAt=c.now.getTime()-3600000
  if(kind==='clock-backwards')s.lastAttemptAt=c.now.getTime()+3600000
  expect(chooseStudyReminder(config,s,c,[pattern])).toBeNull()
 })
 it('never revives inferred scheduling from legacy settings or injected patterns',()=>{
  const smart={...config,studyReminderDailyEnabled:false}
  for(const hour of [8,9,16,23])expect(chooseStudyReminder(smart,EMPTY_REMINDER_STATE,context(now(15,hour)),[{...pattern,startHour:hour,endHour:hour+1}])).toBeNull()
 })
 it('keeps a smart reminder away from the selected daily time and honors an explicitly chosen nighttime daily time',()=>{
  expect(chooseStudyReminder(config,EMPTY_REMINDER_STATE,context(now(15,16)),[{...pattern,startHour:16,endHour:18}])).toBeNull()
  expect(chooseStudyReminder({...config,studyReminderDailyTime:'23:00'},EMPTY_REMINDER_STATE,context(now(15,23)),[])?.kind).toBe('daily')
 })
 it('handles wrapped daytime/nighttime quiet ranges and invalid time values safely',()=>{
  expect(quietAt(23*60,'22:00','08:00')).toBe(true);expect(quietAt(8*60,'22:00','08:00')).toBe(false)
  expect(quietAt(12*60,'10:00','14:00')).toBe(true);expect(quietAt(9*60,'10:00','14:00')).toBe(false)
  expect(quietAt(12*60,'10:00','10:00')).toBe(false);expect(quietAt(12*60,'bad','08:00')).toBe(true)
  expect(chooseStudyReminder({...config,studyReminderDailyTime:'bad',studyReminderSmartEnabled:false},EMPTY_REMINDER_STATE,context(),[])).toBeNull()
 })
})
function harness(){
 let date=now(),stored:unknown=null,settings={...config},active=true,busy=false,focused=false
 const send=vi.fn(async(_title:string,_body:string)=>true),patterns=vi.fn(()=>[pattern]),write=vi.fn((value:ReminderState)=>{stored=structuredClone(value)})
 const deps={settings:()=>settings,read:()=>stored,write,context:()=>({active,busy,appFocused:focused}),patterns,supported:()=>true,send,now:()=>date}
 return {deps,send,patterns,write,service:new StudyReminderService(deps),time:(value:Date)=>{date=value},config:(value:Partial<typeof config>)=>{settings={...settings,...value}},active:(value:boolean)=>{active=value},busy:(value:boolean)=>{busy=value},focused:(value:boolean)=>{focused=value}}
}
describe('reminder service persistence and safety',()=>{
 it('keeps legacy personal reminders inert without reading analytics or altering preferences',async()=>{
  const h=harness();h.config({studyReminderDailyEnabled:false});h.time(now(15,8));await h.service.tick();await h.service.tick()
  expect(h.send).not.toHaveBeenCalled();expect(h.patterns).not.toHaveBeenCalled();expect(h.write).not.toHaveBeenCalled();expect(h.service.status().patterns).toEqual([])
 })
 it('persists before delivery and deduplicates after restart',async()=>{
  const h=harness();h.send.mockImplementation(async()=>{expect(h.write).toHaveBeenCalledOnce();return true})
  await h.service.tick();await h.service.tick();await new StudyReminderService(h.deps).tick()
  expect(h.send).toHaveBeenCalledOnce();expect(h.service.status().lastAttemptAt).toBe(now().getTime())
 })
 it('does not deliver if state reservation fails',async()=>{
  const h=harness();h.write.mockImplementation(()=>{throw Error('disk full')});await h.service.tick()
  expect(h.send).not.toHaveBeenCalled();expect(h.service.status().lastError).toContain('could not be sent')
 })
 it('records OS failure without repeated automatic delivery attempts',async()=>{
  const h=harness();h.send.mockResolvedValue(false);await h.service.tick();await h.service.tick();await new StudyReminderService(h.deps).tick()
  expect(h.send).toHaveBeenCalledOnce();expect(h.service.status().lastError).toContain('Windows')
 })
 it('prevents overlapping sends while native delivery is pending',async()=>{
  const h=harness();let finish!:(value:boolean)=>void;h.send.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
  const pending=h.service.tick();await h.service.tick();expect(h.send).toHaveBeenCalledOnce();finish(true);await pending
 })
 it('pauses through local midnight across restart and resumes explicitly',async()=>{
  const h=harness();const status=h.service.pause('today');expect(status.pausedUntil).toBe(now(16,0).getTime())
  await new StudyReminderService(h.deps).tick();expect(h.send).not.toHaveBeenCalled()
  h.service.pause('resume');await h.service.tick();expect(h.send).toHaveBeenCalledOnce()
 })
 it('allows testing without consuming the daily reminder, and rate-limits test clicks',async()=>{
  const h=harness();await h.service.test();expect(h.write).not.toHaveBeenCalled();await expect(h.service.test()).rejects.toThrow('Wait')
  h.time(now(15,18,1));await h.service.tick();expect(h.send).toHaveBeenCalledTimes(2)
 })
 it('blocks preparation and locked PCs, and does not compute patterns while reminders are disabled',async()=>{
  const h=harness();h.service.setPreparing(true);await h.service.tick();h.service.setPreparing(false);h.active(false);await h.service.tick();expect(h.send).not.toHaveBeenCalled()
  await expect(h.service.test()).rejects.toThrow('Unlock');h.active(true);h.config({studyReminderDailyEnabled:false,studyReminderSmartEnabled:false});await h.service.tick();expect(h.patterns).not.toHaveBeenCalled()
 })
 it('does not compute retired analytics on status, invalidation or a later day',()=>{
  const h=harness();h.service.status();h.service.invalidate();h.time(now(16,19));h.service.status();expect(h.patterns).not.toHaveBeenCalled()
 })
 it('returns a safe empty state for older profiles and malformed fields',()=>{
  expect(readReminderState(null)).toEqual(EMPTY_REMINDER_STATE)
  expect(readReminderState({dailyDay:3,lastAttemptAt:NaN,pausedUntil:-1})).toEqual(EMPTY_REMINDER_STATE)
 })
})
