import { freezeQuestion } from './followupEvidence'
import { expect, it } from 'vitest'
import { discoveryChange, discoveryKey, discoverySnapshot, learningReturns, suggestedExperiment, validateDiscovery, type DiscoveryRecord } from './discoveries'
import { compareReviewPeriods, generatePersonalInsights, type PersonalInsight } from './personalInsights'
import { DEFAULT_ANALYSIS } from './insights'
import { weeklyReview, validateExperiment } from './studyTools'
import type { StatSession, FactorDef } from './statsData'
import type { BlockSummary } from './stats'
import { openDatabase } from '../main/db/database'
import { SettingsRepo } from '../main/repos/settings'
import { StudyToolsRepo } from '../main/repos/studyTools'
import { validateIpcArgs } from './ipcValidation'
const place:FactorDef={key:'place',semanticKey:'place',label:'Place',group:'setup',options:['Library','Home'],multi:false}
const today='2026-10-15'
function row(i:number,patch:Partial<StatSession>={}):StatSession {
 const start=Date.UTC(2026,7,1+i),day=new Date(start).toISOString().slice(0,10)
 return {id:i+1,start,end:start+1800000,day,hour:10,sittingId:i+1,itemId:1,itemIds:[1],activity:'revision',timerMode:'flow',targetSeconds:1500,focusSeconds:1800,outcomes:{focus:i%2?2:4,recall:i%2?2:4},untouchedOutcomes:[],factors:{place:[i%2?'Home':'Library']},untouchedFactors:[],distractions:[],rest:null,...patch} as StatSession
}
const cards=(rows:StatSession[])=>generatePersonalInsights(rows,[place],DEFAULT_ANALYSIS,{today}).candidates
const card=():PersonalInsight=>cards(Array.from({length:60},(_,i)=>row(i))).find(c=>c.factorKey==='place'&&c.outcome==='focus')!
const record=():DiscoveryRecord=>({key:discoveryKey('all',card().id),scope:'all',scopeLabel:'All subjects',status:'saved',checkedOn:today,snapshot:discoverySnapshot(card())})
it('has useful records but invents no comparison for sparse or unanswered histories',()=>{
 for(const n of [0,1,4,9])expect(cards(Array.from({length:n},(_,i)=>row(i)))).toEqual([])
 expect(cards(Array.from({length:60},(_,i)=>row(i,{untouchedOutcomes:['focus','recall']})))).toEqual([])
 expect(card().replicated).toBe(false)
})
it('does not manufacture updates from more counts or revisiting the same records',()=>{
 const c=card(),snapshot=discoverySnapshot(c)
 expect(discoveryChange(undefined,c)).toBe('New to you')
 expect(discoveryChange(snapshot,c)).toBe('Exploratory association')
 expect(discoveryChange(snapshot,{...c,n:c.n+50,nOther:c.nOther+50})).toBe('Exploratory association')
 expect(discoveryChange({...snapshot,delta:snapshot.delta+.6},c)).toBe('Exploratory association')
})
it('notices meaningful change only with new dates, records and day coverage; downgrades lost support',()=>{
 const c=card(),old=discoverySnapshot(c)
 const next={...c,n:c.n+5,days:c.days+4,range:{...c.range,to:today},rows:c.rows.map((r,i)=>({...r,value:r.value+(i?0:.5)}))}
 expect(discoveryChange(old,next)).toBe('Updated finding')
 expect(discoveryChange(old,{...next,days:c.days})).toBe('Exploratory association')
 expect(discoveryChange({...old,replicated:true,strong:true},{...c,replicated:false,evidence:'Preliminary pattern'})).toBe('Less support now')
 expect(discoveryChange(old,{...c,rows:[c.rows[1],c.rows[0]]})).toBe('Direction changed')
 expect(discoveryChange(old,undefined)).toBe('Not currently supported')
})
it('separates filter identities and stores no session records in the discovery snapshot',()=>{
 const c=card(),entry=record()
 expect(discoveryKey('one-subject',c.id)).not.toBe(entry.key)
 expect(validateDiscovery(entry)).toEqual(entry)
 expect(()=>validateDiscovery({...entry,key:'wrong'})).toThrow()
 expect(()=>validateDiscovery({...entry,checkedOn:'2026-02-30'})).toThrow()
 expect(()=>validateDiscovery({...entry,snapshot:{...entry.snapshot,n:-1}})).toThrow()
 expect(()=>validateIpcArgs('tools:saveDiscovery',[{...entry,status:'invalid'}])).toThrow()
 expect(()=>validateIpcArgs('tools:saveDiscovery',[entry])).not.toThrow()
 expect(Object.keys(entry.snapshot)).not.toContain('recallText')
})
it('preserves legacy tool data, independent windows, settings and study records when saving or hiding discoveries',()=>{
 const db=openDatabase(':memory:')
 try{
  const settings=new SettingsRepo(db);settings.writeRaw('studyTools',{views:[],experiments:[],reviews:[{week:'2026-10-05',note:'Keep me',nextStep:'Continue'}]})
  settings.set('focusTargetMinutes',35)
  const first=new StudyToolsRepo(settings),second=new StudyToolsRepo(settings),entry=record()
  const source=card();entry.snapshot.question=freezeQuestion(source.sharedEvidence!,source.factorKey,source.rows[0].label,Array.from({length:60},(_,i)=>row(i)),today)
  first.saveDiscovery(entry);second.saveReview({week:'2026-10-12',note:'Another window',nextStep:''})
  first.saveDiscovery({...entry,status:'dismissed'})
  expect(second.get().discoveries).toEqual([{...entry,status:'dismissed'}])
  expect(second.get().reviews).toHaveLength(2)
  expect(settings.getAll().focusTargetMinutes).toBe(35)
  expect(()=>first.saveDiscovery({...entry,snapshot:{...entry.snapshot,delta:NaN}})).toThrow()
  expect(second.get().discoveries).toHaveLength(1)
 }finally{db.close()}
})
it('keeps original experiment context and asks when more than one context is possible',()=>{
 const origin=card().trial!
 expect(origin).toBeDefined()
 const draft=suggestedExperiment(origin,today,'2026-10-28','2026-10-01','new-trial',place)
 expect(draft).toMatchObject({itemId:1,activity:'revision',outcome:'focus',includeUntouched:false,origin})
 expect(validateExperiment(draft)).toBe(draft)
 const ambiguous=suggestedExperiment({...origin,contexts:[...origin.contexts,{itemId:2,activity:'reading'}]},today,'2026-10-28','2026-10-01','choose-context',place)
 expect(ambiguous.itemId).toBe(0);expect(ambiguous.activity).toBeNull()
 expect(()=>validateExperiment(ambiguous)).toThrow('subject')
})
it('revisits explicit flags and written recall without scheduling, repeating completed flags or mutating records',()=>{
 const base={itemId:1,reviewDone:false,reviewMarked:false,recallText:null,focusStartedAt:'2026-10-01'}
 const rows=[{...base,id:1,recallText:'Question'},{...base,id:2,reviewMarked:true},{...base,id:3,reviewDone:true,reviewMarked:true},{...base,id:4,itemId:2,recallText:'Other subject'},{...base,id:5} ] as BlockSummary[]
 const before=structuredClone(rows)
 expect(learningReturns(rows,1).map(b=>b.id)).toEqual([2,1])
 expect(learningReturns(rows).map(b=>b.id)).toEqual([2,4,1])
 expect(rows).toEqual(before)
})
it('weekly review uses matched weekdays and rejects false change caused by subject/activity composition',()=>{
 const a=Array.from({length:12},(_,i)=>row(i,{day:'2026-10-'+String(1+i%3).padStart(2,'0'),outcomes:{focus:2}}))
 const b=Array.from({length:12},(_,i)=>row(20+i,{day:'2026-10-'+String(8+i%3).padStart(2,'0'),outcomes:{focus:4}}))
 // Repeated sessions on only three days per side cannot support interpretation.
 expect(compareReviewPeriods(b,a,today)).toBeNull()
 const expandedA=a.map((s,i)=>({...s,day:'2026-10-'+String(1+i%6).padStart(2,'0')})),expandedB=b.map((s,i)=>({...s,day:'2026-10-'+String(8+i%6).padStart(2,'0')}))
 const compared=compareReviewPeriods(expandedB,expandedA,today)!
 expect(compared.title).toContain('higher');expect(compared.rows[1].label).toBe('Previous matched weekdays');expect(compared.action).toBeNull()
 expect(compareReviewPeriods(b.map(s=>({...s,activity:'unrelated'})),a,today)).toBeNull()
 expect(compareReviewPeriods(b.map(s=>({...s,untouchedOutcomes:['focus']})),a,today)).toBeNull()
 const weekly=weeklyReview([...a,...b,row(70,{day:'2026-10-14'})],[place],'2026-10-08','2026-10-10')
 expect(weekly.previousThrough).toBe('2026-10-03')
 expect(weekly.rows).toBe(12);expect(weekly.previousSessions).toBe(12)
})
it('weeks do not reuse later evidence or suggest health changes',()=>{
 const ss=Array.from({length:60},(_,i)=>row(i)),past=weeklyReview(ss,[place],'2026-08-01',today)
 expect(past.working).toBeNull()
 const health:FactorDef={...place,key:'sleep',semanticKey:'sleep-hours',group:'day'}
 const healthRows=ss.map(s=>({...s,factors:{sleep:s.factors.place}}))
 expect(weeklyReview(healthRows,[health],'2026-09-19',today).working).toBeNull()
})
