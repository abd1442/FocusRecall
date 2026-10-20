import { expect,it } from 'vitest'
import { generatePersonalInsights,preparationSuggestions,studyTimePatterns } from './personalInsights'
import { DEFAULT_ANALYSIS } from './insights'
import { indexedHoursBefore,hoursBeforeMoment } from './learning'
import { insightReliability } from './insightPresentation'
import { type StatSession, type FactorDef,filterSessions,NO_FILTER } from './statsData'
const place:FactorDef={key:'custom:place',semanticKey:'place',label:'My study place',group:'setup',options:['Library','Home'],multi:false}
function row(i:number,p:Partial<StatSession>={}):StatSession {
  const start=Date.UTC(2026,8,1+i,10),day=new Date(start).toISOString().slice(0,10)
  return {id:i+1,start,end:start+1800000,day,hour:10,weekday:1,sittingId:i+1,positionInSitting:1,positionInDay:1,itemId:1,itemIds:[1],categoryId:1,topCategoryId:1,activity:'revision',timerMode:'flow',focusSeconds:1800,targetSeconds:1500,overTarget:false,outcomes:{focus:i%2?2:4,recall:i%2?2:4},untouchedOutcomes:[],factors:{[place.key]:[i%2?'Home':'Library']},untouchedFactors:[],difficulty:null,difficultyTouched:false,progressAmount:null,progressUnit:null,distractions:[],quality:'clean',goalResult:null,hasGoal:false,resisted:0,stuck:0,parked:0,windowSwitches:0,appSeconds:{},rest:null,restBefore:null,stage:'First 20 hours',stageIndex:0,hoursOnSubject:0,priorKnowledge:null,newField:null,buildsOn:false,...p}
}
const run=(ss:StatSession[],factors=[place],extra:Partial<Parameters<typeof generatePersonalInsights>[3]>={})=>generatePersonalInsights(ss,factors,DEFAULT_ANALYSIS,{today:'2026-12-31',...extra})
it('retired timing recommendations remain empty for frequent and highly rated histories',()=>{
 const ss=Array.from({length:40},(_,i)=>row(i,{hour:i%2?14:8}))
 // Exploratory windows must not automatically become reminder recommendations.
 expect(studyTimePatterns(ss,'2026-10-15')).toEqual([])
 expect(studyTimePatterns(ss.map(s=>({...s,untouchedOutcomes:['focus']} as StatSession)),'2026-10-15')).toEqual([])
 expect(studyTimePatterns(ss.map(s=>({...s,outcomes:{focus:3}})),'2026-10-15')).toEqual([])
 expect(studyTimePatterns(ss.slice(0,12),'2026-10-15')).toEqual([])
})
it('retired timing recommendations remain empty for stale, reversed and confounded histories',()=>{
 const ss=Array.from({length:40},(_,i)=>row(i,{hour:i%2?14:8}))
 expect(studyTimePatterns(ss,'2027-10-15')).toEqual([])
 expect(studyTimePatterns(ss.map((s,i)=>({...s,itemId:i%2?2:1,itemIds:[i%2?2:1]})),'2026-10-15')).toEqual([])
 expect(studyTimePatterns(ss.map((s,i)=>({...s,outcomes:{focus:i<20?(i%2?2:4):(i%2?5:1)}})),'2026-10-15')).toEqual([])
})
it('retired preparation recommendations remain empty for every subject and activity',()=>{
 const ss=Array.from({length:40},(_,i)=>row(i))
 const checks=preparationSuggestions(ss,[place],1,'revision','2026-10-15')
 expect(checks).toEqual([]) // No automatic recommendation from a searched association.
 expect(preparationSuggestions(ss,[place],2,null,'2026-10-15')).toEqual([])
 expect(preparationSuggestions(ss,[place],1,'watching','2026-10-15')).toEqual([])
})
it('retired preparation does not infer advice from sparse, unanswered, stale or future history',()=>{
 const ss=Array.from({length:40},(_,i)=>row(i))
 for(const rows of [[],ss.slice(0,16),ss.map(s=>({...s,untouchedOutcomes:['focus','recall'] as StatSession['untouchedOutcomes']}))])expect(preparationSuggestions(rows,[place],1,null,'2026-10-15')).toEqual([])
 expect(preparationSuggestions(ss,[place],1,null,'2027-10-15')).toEqual([])
 expect(preparationSuggestions(ss,[place],1,null,'2026-08-01')).toEqual([])
})
it('retired preparation does not infer advice from reversed or non-setup histories',()=>{
 const ss=Array.from({length:40},(_,i)=>row(i,{outcomes:{focus:i<20?(i%2?2:4):(i%2?5:1)}}))
 expect(preparationSuggestions(ss,[place],1,null,'2026-10-15')).toEqual([])
 expect(preparationSuggestions(Array.from({length:40},(_,i)=>row(i)),[{...place,group:'day'}],1,null,'2026-10-15')).toEqual([])
})
it('retired preparation suggestions stay empty across a large family of factors',()=>{
 const factors=Array.from({length:7},(_,i)=>({...place,key:'setup-'+i,label:'Setup '+i}))
 const ss=Array.from({length:40},(_,i)=>row(i,{factors:Object.fromEntries(factors.map(f=>[f.key,[i%2?'Home':'Library']]))}))
 const checks=preparationSuggestions(ss,factors,1,null,'2026-10-15')
 expect(checks).toEqual([]) // A larger search family does not create confirmed advice.
})
it('empty or unanswered data never produces personal advice',()=>{
  expect(run([]).cards).toHaveLength(0)
  const ss=Array.from({length:40},(_,i)=>row(i,{untouchedOutcomes:['focus','recall']}))
  expect(run(ss).cards).toHaveLength(0);expect(run(ss).coverage.focus).toBe(0)
})
it('uses actual means/counts and replicates the same direction over distinct days',()=>{
  const result=run(Array.from({length:40},(_,i)=>row(i)))
  const c=result.cards.find(c=>c.family==='conditions')!;expect(c).toBeDefined()
  expect(c.rows.map(r=>r.value).sort()).toEqual([2,4]);expect(c.n).toBe(20);expect(c.nOther).toBe(20)
  expect(c.evidence).toBe('Preliminary pattern');expect(c.replicated).toBe(false);expect(c.action).not.toBeNull()
})
it('requires five usable outcomes each side; a single lucky rating cannot win',()=>{
  expect(run(Array.from({length:8},(_,i)=>row(i))).cards.filter(c=>c.family==='conditions')).toHaveLength(0)
  const ss=Array.from({length:20},(_,i)=>row(i,{outcomes:{focus:i===0?5:3}}))
  expect(run(ss).cards.filter(c=>c.family==='conditions')).toHaveLength(0)
})
it('rejects conflicting earlier and later patterns',()=>{
  const ss=Array.from({length:40},(_,i)=>row(i,{outcomes:{focus:i<20?(i%2?2:4):(i%2?5:1)}}))
  expect(run(ss).cards.filter(c=>c.family==='conditions')).toHaveLength(0)
})
it('cannot manufacture an association when subjects or activities are not comparable',()=>{
  const ss=Array.from({length:40},(_,i)=>row(i,{itemId:i%2?2:1,itemIds:[i%2?2:1]}))
  expect(run(ss).cards.filter(c=>c.family==='conditions')).toHaveLength(0)
  expect(run(ss.map((s,i)=>({...s,itemId:1,itemIds:[1],activity:i%2?'reading':'revision'}))).cards.filter(c=>c.family==='conditions')).toHaveLength(0)
})
it('sleep uses distinct recorded days rather than multiplying one night by many sessions',()=>{
  const ss=Array.from({length:40},(_,i)=>row(i,{day:i%2?'2026-09-01':'2026-09-02'}))
  const sleep=new Map([['2026-09-01',{value:5,touched:true}],['2026-09-02',{value:7.5,touched:true}]])
  expect(run(ss,[],{sleepHours:sleep}).cards.filter(c=>c.family==='sleep')).toHaveLength(0)
  const enough=Array.from({length:40},(_,i)=>row(i)),hours=new Map(enough.map((s,i)=>[s.day,{value:i%2?5:7.5,touched:true}]))
  const c=run(enough,[],{sleepHours:hours}).cards.find(c=>c.family==='sleep')!;expect(c.unit).toBe('study days');expect(c.n).toBe(20)
  expect(run(enough,[],{sleepHours:new Map()}).cards.some(c=>c.family==='sleep')).toBe(false)
})
it('ignores planned-only rests and compares actual previous rest with matched preceding lengths',()=>{
  const ss=Array.from({length:40},(_,i)=>row(i))
  const predecessors=ss.map((s,i)=>row(i,{id:1000+i,start:s.start-3600000,end:s.start-1800000,sittingId:s.sittingId,outcomes:{},rest:{activity:'walk',plannedSeconds:600,actualSeconds:null,skipped:false,screen:false}}))
  expect(run(ss,[],{all:[...predecessors,...ss]}).cards.some(c=>c.family==='rest')).toBe(false)
  const actual=predecessors.map((s,i)=>({...s,rest:{...s.rest!,actualSeconds:i%2?200:700}}))
  const c=run(ss,[],{all:[...actual,...ss]}).cards.find(c=>c.family==='rest')!;expect(c).toBeDefined();expect(c.title).toContain('recorded rest')
})
it('supports activity-specific focused length without equating minutes with rating quality',()=>{
  const ss=Array.from({length:40},(_,i)=>row(i,{focusSeconds:i%2?3600:1200}))
  const c=run(ss,[],{activityLabel:()=> 'Revision'}).cards.find(c=>c.family==='length')!;expect(c.title).toContain('Revision');expect(c.rows.map(r=>r.value).sort()).toEqual([2,4])
})
it('counts manual distractions without tracking, distinguishes frequency/time and merges overlaps',()=>{
  const d={offsetSeconds:0,durationSeconds:60,startedAt:Date.UTC(2026,8,1,10),source:'pause' as const,kind:'phone',app:null,title:null,confirmed:true,itemId:1,label:null}
  const s=row(0,{outcomes:{},distractions:[d,{...d,startedAt:d.startedAt+30000}]})
  const cards=run([s],[],{reasonLabel:()=> 'Phone'}).cards
  expect(cards.find(c=>c.id==='distraction-duration')?.rows[0].value).toBe(1.5)
  expect(cards.find(c=>c.id==='distraction-frequency')?.rows[0].value).toBe(2)
  expect(run([row(0,{outcomes:{},distractions:[]})],[]).cards).toHaveLength(0)
  expect(run([row(0,{outcomes:{},distractions:[{...d,source:'idle',confirmed:false}]})],[]).cards).toHaveLength(0)
})
it('grades duration only from events receiving attributed time, without changing totals',()=>{
 const ss=Array.from({length:8},(_,i)=>{
  const s=row(i,{outcomes:{},factors:{}}),d={offsetSeconds:0,durationSeconds:60,startedAt:s.start,source:'pause' as const,kind:'phone',app:null,title:null,confirmed:true,itemId:1,label:null}
  return {...s,distractions:[...Array.from({length:40},()=>({...d})),{...d,kind:'browsing',offsetSeconds:120,startedAt:s.start+120000,durationSeconds:30}]}
 })
 const cards=run(ss,[]).cards,time=cards.find(c=>c.id==='distraction-duration')!,count=cards.find(c=>c.id==='distraction-frequency')!
 expect(time.total).toBe(12);expect(time.n).toBe(328);expect(count.total).toBe(328)
 expect(time.recordSupport).toMatchObject({events:16,leaderEvents:8,days:8,metric:'minutes'})
 expect(insightReliability(time)).toMatchObject({level:2,label:'Repeated pattern'})
 expect(insightReliability(count)).toMatchObject({level:3,label:'Well-supported pattern'})
})
it('keeps the true distraction total when only five ranked reasons are shown',()=>{
  const start=Date.UTC(2026,8,1,10)
  const distractions=Array.from({length:6},(_,i)=>({offsetSeconds:i*60,durationSeconds:60,startedAt:start+i*60000,source:'pause' as const,kind:'reason-'+i,app:null,title:null,confirmed:true,itemId:1,label:null}))
  const card=run([row(0,{outcomes:{},distractions})],[]).cards.find(c=>c.id==='distraction-duration')!
  expect(card.rows).toHaveLength(5);expect(card.total).toBe(6);expect(card.rows[0].value/card.total!).toBeCloseTo(1/6)
})
it('does not count a deleted part hole as distraction time',()=>{
  const start=Date.UTC(2026,8,1,10),distractions=[{offsetSeconds:0,durationSeconds:1800,startedAt:start,source:'pause' as const,kind:'phone',app:null,title:null,confirmed:true,itemId:1,label:null}]
  const c=run([row(0,{outcomes:{},distractions,wallRanges:[{start,end:start+300000},{start:start+1500000,end:start+1800000}]})],[]).cards.find(c=>c.id==='distraction-duration')!
  expect(c.total).toBe(10)
})
it('respects filters, untouched options, mixed subjects and deletion',()=>{
  const ss=Array.from({length:40},(_,i)=>row(i))
  expect(run(filterSessions(ss,{...NO_FILTER,itemId:999})).cards).toHaveLength(0)
  expect(run(ss.filter((_,i)=>i%2)).cards.filter(c=>c.family==='conditions')).toHaveLength(0)
  expect(run(ss.map(s=>({...s,itemIds:[1,2]}))).cards.filter(c=>c.outcome!==null)).toHaveLength(0)
  const untouched=ss.map(s=>({...s,untouchedOutcomes:['focus','recall'] as ('focus'|'recall')[]}))
  expect(generatePersonalInsights(untouched,[place],{...DEFAULT_ANALYSIS,includeUntouched:true},{today:'2026-12-31'}).cards.length).toBe(0)
})
it('indexed prior-hours preserves strict timestamps, shuffled inputs and imported hours',()=>{
  const parts=[{itemId:1,start:20,focusSeconds:120},{itemId:2,start:5,focusSeconds:3600},{itemId:1,start:10,focusSeconds:60},{itemId:1,start:10,focusSeconds:30}]
  const index=indexedHoursBefore(parts)
  for(const id of [1,2,3])for(const at of [0,5,10,11,20,30])expect(index(id,at,4.5)).toBe(hoursBeforeMoment(parts,id,at,4.5))
})
it('bounds exploratory work on a large synthetic history without mutating inputs',()=>{
  const ss=Array.from({length:3000},(_,i)=>row(i%60,{id:i+1})),before=ss[0].factors
  const result=run(ss);expect(result.examined).toBeLessThanOrEqual(160);expect(result.cards.length).toBeLessThanOrEqual(6);expect(ss[0].factors).toBe(before);expect(before['insight-time']).toBeUndefined()
})
it('names the actual comparator when all comparison observations use one condition',()=>{
  const card=run(Array.from({length:40},(_,i)=>row(i))).cards.find(c=>c.family==='conditions')!
  expect(new Set(card.rows.map(r=>r.label))).toEqual(new Set(['Library','Home']))
})
it('uses minutes for condition/session-length differences and matches chosen timer targets',()=>{
  const ss=Array.from({length:40},(_,i)=>row(i,{outcomes:{},focusSeconds:(i%2?20:30)*60}))
  const card=run(ss).cards.find(c=>c.outcome==='length')!
  expect(card.rows.map(r=>r.value).sort((a,b)=>a-b)).toEqual([20,30]);expect(card.explanation).toContain('focused minutes');expect(card.action).toBeNull()
  expect(run(ss.map(s=>({...s,targetSeconds:s.focusSeconds}))).cards.filter(c=>c.outcome==='length')).toHaveLength(0)
  expect(run(ss.map(s=>({...s,focusSeconds:25*60}))).cards.filter(c=>c.outcome==='length')).toHaveLength(0)
})
it('plots only eligible range means with the same cohort weighting as the conclusion',()=>{
  const ss=Array.from({length:40},(_,i)=>row(i,{hour:i%2?18:10}))
  const card=run(ss,[]).cards.find(c=>c.family==='time')!
  expect(card.profile).toHaveLength(2)
  expect(card.profile!.find(p=>p.label===card.rows[0].label)!.value).toBe(card.rows[0].value)
  expect(card.profile!.find(p=>p.label===card.rows[1].label)!.value).toBe(card.rows[1].value)
  expect(card.profile!.every(p=>p.n>=5&&p.days>=3)).toBe(true)
})
