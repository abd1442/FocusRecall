import { expect,it } from 'vitest'
import { insightDifference,orderedInsightProfile,insightTakeaway,insightRecordBasis,insightReliability } from './insightPresentation'
import type { PersonalInsight } from './personalInsights'
import { displayInsight } from './insightLocalization'
import { SEED_GROUPS, seedOptions, type LogField } from './logfields'
const example=(extra:Partial<PersonalInsight>):PersonalInsight=>({id:'test',factorKey:'test',family:'conditions',title:'test',explanation:'',evidence:'Preliminary pattern',rows:[{label:'Music',value:4,n:20},{label:'Silence',value:3,n:20}],n:20,nOther:20,days:8,daysOther:8,sessions:40,unit:'sessions',outcome:'focus',range:{from:'2026-10-01',to:'2026-10-15'},calculation:'',limitations:'',replicated:false,action:null,section:'factors',score:20,...extra})
it('localizes generated takeaways without translating private labels or changing evidence',()=>{
  const card=example({rows:[{label:'My private Home عربي',value:4,n:20},{label:'My private Other 中文',value:3,n:20}]})
  const original=JSON.stringify(card)
  expect(insightTakeaway(card,'de').text).toContain('My private Home عربي')
  expect(insightTakeaway(card,'de').text).toContain('Fokus')
  expect(insightTakeaway(card,'ar').comparison).toContain('My private Other 中文')
  expect(insightRecordBasis(card,'es').unit).toBe('sesiones')
  expect(insightRecordBasis(card,'es').comparison).toBe('20 sesiones frente a 20 sesiones')
  expect(JSON.stringify(card)).toBe(original)
})
it('localizes only unchanged built-in factor labels and preserves analysis and custom names',()=>{
  const seed=SEED_GROUPS.flatMap(g=>g.fields).find(f=>f.key==='place')!
  const field:LogField={id:2,key:seed.key,label:seed.label,groupId:1,type:seed.type,options:seedOptions(seed.options),scale:null,sortOrder:0,archived:false}
  const card=example({factorKey:'field:2',context:'Place',rows:[{label:'Bedroom',value:4,n:20},{label:'Other recorded setups',value:3,n:20}]})
  const before=JSON.stringify(card),shown=displayInsight(card,{groups:[],fields:[field]},'ar')
  expect(shown.rows[0].label).toBe('غرفة النوم');expect(shown.context).toBe('المكان')
  expect(shown.rows.map(r=>r.value)).toEqual(card.rows.map(r=>r.value));expect(shown.id).toBe(card.id)
  expect(JSON.stringify(card)).toBe(before)
  const custom={...field,key:null,options:[{id:'private',label:'Bedroom'}]}
  expect(displayInsight(card,{groups:[],fields:[custom]},'ar').rows[0].label).toBe('Bedroom')
  const length=example({family:'length',rows:[{label:'30 to 45 min',value:4,n:20},{label:'60 min and more',value:3,n:20}]})
  expect(displayInsight(length,{groups:[],fields:[]},'de').rows[0].label).toBe('30 bis 45 Min.')
})
it('shows the actual rating difference rather than invented percentage improvement',()=>{
  expect(insightDifference(example({}))).toEqual({value:'+1.0',direction:'higher',unit:'rating points'})
  expect(insightDifference(example({outcome:'length'}))?.unit).toBe('focused min')
  expect(insightDifference(example({outcome:null}))).toBeNull()
})
it('orders measured ranges chronologically without modifying the result',()=>{
  const profile=['9 h or more','7–8 h','under 6 h','6–7 h'].map(label=>({label,value:3,n:5,days:5}))
  expect(orderedInsightProfile(example({profile})).map(p=>p.label)).toEqual(['under 6 h','6–7 h','7–8 h','9 h or more'])
  expect(profile[0].label).toBe('9 h or more')
})
it('summarizes both directions as recorded ratings, not an effect on learning',()=>{
  expect(insightTakeaway(example({}))).toEqual({text:'Music: higher focus ratings',comparison:'Compared with Silence',tone:'positive'})
  const card=example({outcome:'recall',rows:[{label:'Music with lyrics',value:2,n:20},{label:'Silence',value:4,n:20}]})
  expect(insightTakeaway(card)).toEqual({text:'Music with lyrics: lower recall ratings',comparison:'Compared with Silence',tone:'caution'})
  expect(insightTakeaway(example({outcome:'length'}))).toMatchObject({text:'Music: longer focused sessions',tone:'neutral'})
})
it('keeps daily evidence and interruption counts distinct from sessions or minutes',()=>{
  expect(insightRecordBasis(example({unit:'study days',n:1,nOther:2})).comparison).toBe('1 study day vs 2 study days')
  expect(insightRecordBasis(example({family:'distractions',outcome:null,n:1,unit:'minutes'}))).toMatchObject({count:1,unit:'event'})
  expect(insightRecordBasis(example({unit:'study days',n:12,nOther:14,sessions:62}))).toEqual({count:62,unit:'sessions',comparison:'12 study days vs 14 study days',status:'Early pattern'})
  expect(insightRecordBasis(example({family:'distractions',outcome:null,n:9,sessions:62,unit:'minutes',evidence:'Recorded summary'}))).toMatchObject({count:9,unit:'events',status:'Not enough evidence'})
  expect(insightRecordBasis(example({evidence:'Stronger evidence',replicated:true})).status).toBe('Well-supported pattern')
})
it('formats a single recorded interruption in English without mutating its canonical evidence',()=>{
  const card=example({family:'distractions',outcome:null,unit:'events',n:1,days:1,
    rows:[{label:'Private reason',value:1,n:1}],presentation:{leadingDays:1}})
  const original=JSON.stringify(card)
  expect(displayInsight(card,{groups:[],fields:[]},'en').explanation).toBe('1 event · 1 study day. Frequency and time lost are different measures.')
  expect(JSON.stringify(card)).toBe(original)
})
it('requires time replication and coverage, not just a large session count, for support levels',()=>{
  expect(insightReliability(example({n:500,nOther:500,sessions:1000,days:30,daysOther:30,replicated:false}))).toMatchObject({level:1,label:'Early pattern'})
  expect(insightReliability(example({n:4,nOther:80}))).toMatchObject({level:0,label:'Not enough evidence'})
  expect(insightReliability(example({replicated:true,n:10,nOther:12,days:5,daysOther:5}))).toMatchObject({level:2,label:'Repeated pattern'})
  expect(insightReliability(example({replicated:true,evidence:'Stronger evidence'}))).toMatchObject({level:3,label:'Well-supported pattern'})
  expect(insightReliability(example({replicated:true,evidence:'Stronger evidence',days:7})).level).toBe(2)
  expect(insightReliability(example({family:'distractions',outcome:null,evidence:'Recorded summary'}))).toMatchObject({level:0,label:'Not enough evidence'})
})
it('does not invent a winner or a direction for equal or missing results',()=>{
  expect(insightTakeaway(example({rows:[{label:'Library',value:3,n:20},{label:'Home',value:3,n:20}]}))).toMatchObject({text:'Library: similar focus ratings',tone:'neutral'})
  expect(insightTakeaway(example({family:'distractions',outcome:null,unit:'minutes',rows:[{label:'Phone',value:3,n:2},{label:'Browsing',value:3,n:2}]})).text).toBe('Phone: joint most recorded distraction time')
  expect(insightTakeaway(example({rows:[]})).tone).toBe('neutral')
})
