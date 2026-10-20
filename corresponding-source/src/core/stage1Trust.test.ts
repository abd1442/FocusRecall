import { expect,it } from 'vitest'
import { compare, DEFAULT_ANALYSIS } from './insights'
import { experimentResults, validateExperiment, weeklyReview, type StudyExperiment } from './studyTools'
import { generatePersonalInsights, preparationSuggestions, type InsightOrigin } from './personalInsights'
import { buildReport } from './report'
import { type FactorDef, type StatSession } from './statsData'
import { openDatabase } from '../main/db/database'
import { BlocksRepo } from '../main/repos/blocks'
import { SessionRepo } from '../main/repos/sessions'
import { LogRepo } from '../main/repos/logs'
import { adaptiveTarget } from './modes'
import { validateIpcArgs } from './ipcValidation'
const place:FactorDef={key:'field:20',semanticKey:'place',label:'Place',group:'setup',multi:false,options:['Library','Home']}
function row(i:number,p:Partial<StatSession>={}):StatSession {
 const day=new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10),start=Date.parse(day+'T10:00:00Z')
 return {id:i+1,itemId:1,itemIds:[1],activity:'revision',day,start,end:start+1200000,focusSeconds:1200,outcomes:{focus:i%2?2:4,recall:i%2?2:4},untouchedOutcomes:[],factors:{[place.key]:[i%2?'Home':'Library']},untouchedFactors:[],distractions:[],...p} as StatSession
}
const origin:InsightOrigin={id:'place-library-focus',title:'Library goes with higher focus',factorKey:place.key,option:'Library',outcome:'focus',range:{from:'2026-09-01',to:'2026-10-10'},calculation:'Matched cohorts',limitations:'Association only',evidence:'Repeated',contexts:[{itemId:1,activity:'revision'}]}
const trial:StudyExperiment={id:'trial',name:'Library',change:'Study at Library',itemId:1,activity:'revision',origin,baselineFrom:'2026-10-01',changeOn:'2026-10-08',endDay:'2026-10-14',outcome:'focus',notes:'',includeUntouched:false,status:'planned'}
const trialRows=()=>Array.from({length:12},(_,i)=>row(i,{day:`2026-10-${String(i<6?i+1:i+2).padStart(2,'0')}`,outcomes:{focus:i<6?2:4},factors:{[place.key]:[i<6?'Home':'Library']}}))
it('never generates health, unknown-field, negative-direction or unconfirmed trial advice, including exports',()=>{
 for(const semanticKey of ['sleep-hours','sleep','food','drinks','physical','stress',null]){
  const factor={...place,semanticKey,label:'Health observation'},rows=Array.from({length:40},(_,i)=>row(i))
  const cards=generatePersonalInsights(rows,[factor],DEFAULT_ANALYSIS,{today:'2026-12-31'}).cards
  expect(cards.length).toBeGreaterThan(0);expect(cards.every(c=>c.action===null&&c.trial===undefined)).toBe(true)
  expect(preparationSuggestions(rows,[factor],1,'revision','2026-10-15')).toEqual([])
  const md=buildReport({title:'Test',periodLabel:'Test',previousLabel:'Prior',sessions:rows,previous:[],factors:[factor],options:DEFAULT_ANALYSIS,itemName:()=> 'Test'})
  expect(md).not.toContain('- Try ')
 }
 const rows=Array.from({length:40},(_,i)=>row(i)),cards=generatePersonalInsights(rows,[place],DEFAULT_ANALYSIS,{today:'2026-12-31'}).cards
 expect(cards.some(c=>c.trial)).toBe(true)
 for(const c of cards.filter(c=>c.trial)){expect(c.trial!.option).toBe('Library');expect(c.trial!.contexts).toEqual([{itemId:1,activity:'revision'}]);expect(c.action).not.toContain('Try Home')}
 const defaults=generatePersonalInsights(rows,[place],{...DEFAULT_ANALYSIS,includeUntouched:true},{today:'2026-12-31'}).cards
 expect(defaults.every(c=>!c.replicated&&!c.action)).toBe(true)
 expect(generatePersonalInsights(rows.map(s=>({...s,activity:null})),[place],DEFAULT_ANALYSIS,{today:'2026-12-31'}).cards).toEqual([])
})
it('keeps source context through IPC and validation and rejects unrelated subjects/activities',()=>{
 expect(validateExperiment(trial).origin).toEqual(origin)
 expect(()=>validateIpcArgs('tools:saveExperiment',[trial])).not.toThrow()
 expect(()=>validateExperiment({...trial,itemId:2})).toThrow('original finding')
 expect(()=>validateExperiment({...trial,activity:'video'})).toThrow('original finding')
 expect(()=>validateExperiment({...trial,outcome:'recall'})).toThrow('original finding')
 const {origin:_,activity:__,...legacy}=trial;expect(validateExperiment(legacy)).toEqual(legacy)
})
it('requires actual recorded change, distinct days, confirmed answers and the original activity',()=>{
 const rows=trialRows(),r=experimentResults(rows,trial,'2026-10-15')
 expect(r).toMatchObject({difference:2,observedDifference:2,adherenceVerified:true,before:{n:6,days:6,conditionMatched:6},after:{n:6,days:6,conditionMatched:6}})
 for(const bad of [rows.map(s=>({...s,untouchedFactors:[place.key]})),rows.map(s=>({...s,factors:{[place.key]:['Home']}})),rows.map(s=>({...s,activity:'video'})),rows.map(s=>({...s,day:s.day<trial.changeOn?'2026-10-01':'2026-10-08'})),rows.map(s=>({...s,untouchedOutcomes:['focus'] as const as unknown as StatSession['untouchedOutcomes']}))])expect(experimentResults(bad,trial,'2026-10-15').difference).toBeNull()
 expect(experimentResults(rows,{...trial,includeUntouched:true},'2026-10-15').difference).toBeNull()
 expect(experimentResults(rows,{...trial,origin:undefined},'2026-10-15')).toMatchObject({difference:null,observedDifference:2,status:'Change not verified'})
})
it('balances shared activity proportions rather than manufacturing improvement',()=>{
 const rows=[...Array.from({length:10},(_,i)=>row(i,{day:'2026-10-01',activity:'easy',outcomes:{focus:5}})),...Array.from({length:2},(_,i)=>row(i+10,{day:'2026-10-02',activity:'hard',outcomes:{focus:1}})),...Array.from({length:2},(_,i)=>row(i+12,{day:'2026-10-09',activity:'easy',outcomes:{focus:5}})),...Array.from({length:10},(_,i)=>row(i+14,{day:'2026-10-10',activity:'hard',outcomes:{focus:1}}))]
 expect(experimentResults(rows,{...trial,origin:undefined,activity:undefined},'2026-10-15').observedDifference).toBeNull()
 const expanded=rows.map((s,i)=>({...s,day:s.day<trial.changeOn?'2026-10-0'+(1+i%6):'2026-10-'+String(8+i%6).padStart(2,'0')}))
 expect(experimentResults(expanded,{...trial,origin:undefined,activity:undefined},'2026-10-15').observedDifference).toBe(0)
})
it('compares partial weeks with the same elapsed weekdays and never treats future days as observed',()=>{
 const rows=['2026-10-05','2026-10-07','2026-10-10','2026-10-12','2026-10-14','2026-10-16'].map((day,i)=>row(i,{day}))
 const r=weeklyReview(rows,[place],'2026-10-12','2026-10-14')
 expect(r).toMatchObject({through:'2026-10-14',previousFrom:'2026-10-05',previousThrough:'2026-10-07',rows:2,previousSessions:2,focusSeconds:2400,previousSeconds:2400})
 expect(weeklyReview(rows,[],'2026-10-19','2026-10-14')).toMatchObject({rows:0,previousSessions:0,through:null,previousThrough:null})
})
it('daily factors use days, not repeated sessions as independent evidence',()=>{
 const sleep={...place,semanticKey:'sleep',group:'day' as const},rows=Array.from({length:80},(_,i)=>row(i,{day:i%2?'2026-10-02':'2026-10-01'}))
 expect(compare(rows,sleep,'Library','focus')).toMatchObject({n:0,nRest:0,strength:null,countUnit:'study days'})
 expect(compare(rows.map(s=>({...s,itemIds:[1,2]})),place,'Library','focus').n).toBe(0)
})
it('historical untouched ratings stay stored but cannot qualify Adaptive or summaries',()=>{
 const db=openDatabase(':memory:')
 try{
  const logs=new LogRepo(db),repo=new SessionRepo(db),blocks=new BlocksRepo(db,logs),focus=logs.schema().fields.find(f=>f.key==='focus')!
  db.prepare("INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'QA','#123456',0,'2026-10-01')").run()
  db.prepare("INSERT INTO items(id,category_id,name,color,default_unit,created_at) VALUES(100,100,'QA','#123456','pages','2026-10-01')").run()
  for(let i=0;i<5;i++){const at=`2026-10-0${i+1}T10:00:00Z`,sitting=repo.createSitting(at),session=repo.createSession(sitting,at),id=repo.insertBlock({sittingId:sitting,sessionId:session,itemId:100,timerMode:'flow',targetSeconds:1500,startedAt:at});db.prepare('UPDATE blocks SET focus_ended_at=?,focus_seconds=2400 WHERE id=?').run(at,id);repo.endSession(session,at);logs.saveValues(id,{[focus.id]:5},{},[focus.id]);blocks.saveRecall(id,{recallText:'Original note',toReviewText:'',recallRating:3,recallSeconds:10,recallRatingTouched:false})}
  const original=JSON.stringify(db.prepare('SELECT * FROM block_log_values ORDER BY block_id,field_id').all())
  expect(blocks.summaries().every(b=>b.focusRating===null)).toBe(true)
  expect(adaptiveTarget(blocks.summaries(),100,1500).basedOn).toBe(0)
  expect(blocks.history().flatMap(s=>s.blocks).every(b=>b.recallRating===3&&!b.recallRatingTouched&&b.recallText==='Original note')).toBe(true)
  expect(JSON.stringify(db.prepare('SELECT * FROM block_log_values ORDER BY block_id,field_id').all())).toBe(original)
  const id=blocks.summaries()[0].id;logs.saveValues(id,{[focus.id]:5},{},[]);expect(blocks.summaries().filter(b=>b.focusRating===5)).toHaveLength(1)
 }finally{db.close()}
})

it('does not offer a pooled favorable choice for a subject with the opposite result',()=>{
 const rows=Array.from({length:240},(_,i)=>{const subject=Math.floor(i/2)%2?2:1,library=i%2===0;return row(i,{itemId:subject,itemIds:[subject],factors:{[place.key]:[library?'Library':'Home']},outcomes:{focus:subject===1?(library?4:2):(library?2:3)}})})
 const cards=generatePersonalInsights(rows,[place],DEFAULT_ANALYSIS,{today:'2027-12-31'}).cards.filter(c=>c.trial)
 expect(cards.length).toBeGreaterThan(0)
 for(const c of cards){expect(c.trial!.contexts).toEqual([{itemId:1,activity:'revision'}]);expect(c.trial!.option).toBe('Library');expect(c.trial!.comparison?.rows).toEqual(c.rows);expect(c.trial!.calculation).toBe(c.calculation)}
})

it('keeps baseline outcomes visible before comparable after records exist',()=>{
 const rows=trialRows().filter(s=>s.day<trial.changeOn),r=experimentResults(rows,trial,'2026-10-15')
 expect(r.before).toMatchObject({n:6,mean:2,matchedN:0,conditionKnown:6})
 expect(r.after).toMatchObject({n:0,mean:null});expect(r.difference).toBeNull()
})

it('preparation cannot apply an activity-specific favorable association to contradictory activities',()=>{
 const rows=Array.from({length:80},(_,i)=>{const activity=Math.floor(i/2)%2?'video':'revision',library=i%2===0;return row(i,{activity,factors:{[place.key]:[library?'Library':'Home']},outcomes:{focus:activity==='revision'?(library?4:2):(library?2:3)}})})
 expect(preparationSuggestions(rows,[place],1,null,'2026-11-20')).toEqual([])
 expect(preparationSuggestions(rows,[place],1,'revision','2026-11-20')).toEqual([])
 expect(preparationSuggestions(rows,[place],1,'video','2026-11-20')).toEqual([])
})
