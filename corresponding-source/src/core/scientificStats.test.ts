import { describe,expect,it } from 'vitest'
import { automaticDiscoveryThreshold,compareEvidence, EVIDENCE_VERSION } from './evidence'
import { evidenceCopy } from './evidenceCopy'
import { checkLaterRecords,freezeQuestion } from './followupEvidence'
import { activityBaseline,completedStatsSessions,subjectRevisits } from './statsEvidenceSummary'
import { compare,DEFAULT_ANALYSIS } from './insights'
import { generatePersonalInsights } from './personalInsights'
import { displayInsight } from './insightLocalization'
import { insightReliability } from './insightPresentation'
import { buildReport } from './report'
import { distractionNumbers } from './statsSections'
import { minuteContinuity } from './studyPatterns'
import { LANGUAGES,catalogs } from './localization'
import { discoveryKey,discoverySnapshot,validateDiscovery } from './discoveries'
import { validateIpcArgs } from './ipcValidation'
import type { FactorDef,StatSession } from './statsData'

const place:FactorDef={key:'place',semanticKey:'place',label:'Place',options:['Library','Home'],multi:false,group:'setup'}
function row(i:number,patch:Partial<StatSession>={}):StatSession {
  const start=Date.UTC(2026,0,1+i),day=new Date(start).toISOString().slice(0,10)
  return {id:i+1,start,end:start+1800000,day,itemId:1,itemIds:[1],activity:'reading',timerMode:'fixed',targetSeconds:1800,focusSeconds:1800,outcomes:{focus:i%2?2:4,recall:i%2?2:4,length:30},untouchedOutcomes:[],factors:{place:[i%2?'Home':'Library']},untouchedFactors:[],distractions:[],appSeconds:{},windowSwitches:0,rest:null,sittingId:i+1,hour:10,...patch} as StatSession
}
const rows=(n=60)=>Array.from({length:n},(_,i)=>row(i))
const calculate=(ss:StatSession[])=>compareEvidence(ss,place,'Library','focus',DEFAULT_ANALYSIS)
describe('shared scientific evidence',()=>{
  it('gives sessions within a context-day one vote, with hand-calculated means',()=>{
    const base=rows(60),duplicateDay=Array.from({length:99},(_,i)=>row(100+i,{day:base[0].day,outcomes:{focus:4},factors:{place:['Library']}}))
    const e=calculate([...base,...duplicateDay]);expect(e.estimate).toBe(2);expect(e.groups.map(g=>g.days)).toEqual([30,30]);expect(e.groups[0].sessions).toBe(129);expect(e.status).toBe('exploratory');expect(e.uncertainty).toMatchObject({low:2,high:2,unstable:false})
  })
  it('does not invent support from many sessions on two days',()=>{
    const e=calculate(rows(100).map((s,i)=>({...s,day:i%2?'2026-01-02':'2026-01-01'})))
    expect(e.status).toBe('insufficient');expect(e.estimate).toBeNull();expect(e.coverage.excludedContext).toBe(100)
  })
  it('matches subject AND activity and rejects composition-only differences',()=>{
    const ss=[...rows(40).map(s=>({...s,outcomes:{focus:4},itemId:1,itemIds:[1]})),...rows(40).map((s,i)=>({...s,id:100+i,outcomes:{focus:2},itemId:2,itemIds:[2],factors:{place:[i%5?'Home':'Library']}}))]
    const e=calculate(ss);expect(e.estimate).toBe(0);expect(e.status).toBe('descriptive')
    expect(calculate(rows().map((s,i)=>({...s,activity:i%2?'solving':'reading'}))).status).toBe('insufficient')
  })
  it('exposes missingness and rejects a highly unequal answer rate',()=>{
    const base=rows(80),ss=base.map((s,i)=>i%2===0&&i%4===0?{...s,outcomes:{}}:s),e=calculate(ss)
    expect(e.coverage).toMatchObject({total:80,factorAnswered:80,outcomeAnswered:60,both:60,retained:60});expect(e.answerRates).toMatchObject({first:.5,other:1,imbalanced:true});expect(e.status).toBe('descriptive')
  })
  it('raises the automatic discovery margin as more questions are searched',()=>{
    const e=calculate(rows(80).map((s,i)=>({...s,outcomes:{focus:(i%2?2:4)+(i%3===0?.5:-.5)}})))
    expect(automaticDiscoveryThreshold(e,160)).toBeGreaterThanOrEqual(automaticDiscoveryThreshold(e,2))
    expect(automaticDiscoveryThreshold(calculate(rows(12)),2)).toBe(Infinity)
  })
  it('does not promote conditions fully separated in time into automatic findings',()=>{
    const ss=rows(80).map((s,i)=>({...s,outcomes:{focus:i<40?4:2},factors:{place:[i<40?'Library':'Home']}})),e=calculate(ss)
    expect(e.estimate).toBe(2);expect(e.sensitivityChecks.overlappingDateRanges).toBe(false);expect(e.status).toBe('descriptive')
    expect(generatePersonalInsights(ss,[place],DEFAULT_ANALYSIS,{today:'2026-04-01'}).cards.filter(c=>c.factorKey==='place')).toEqual([])
  })
  it('rejects corrupt ratings but does not confuse an unchanged high-rating share with no ordinal difference',()=>{
    expect(calculate(rows().map(s=>({...s,outcomes:{focus:100}}))).coverage.outcomeAnswered).toBe(0)
    const e=calculate(rows().map((s,i)=>({...s,outcomes:{focus:i%2?4:5}})))
    expect(e.estimate).toBe(1);expect(e.sensitivityChecks.ordinalDirection).toBe(0);expect(e.status).toBe('exploratory')
  })
  it('does not authorize trials of health factors or unconfirmed defaults',()=>{
    const ss=rows(60)
    expect(calculate(ss).permittedActions).toContain('plan-comparison')
    expect(compareEvidence(ss,{...place,semanticKey:'sleep-hours',group:'day'},'Library','focus',DEFAULT_ANALYSIS).permittedActions).not.toContain('plan-comparison')
    expect(compareEvidence(ss,place,'Library','focus',{...DEFAULT_ANALYSIS,includeUntouched:true}).permittedActions).not.toContain('plan-comparison')
  })
  it('keeps defaults, unknown activity and mixed subjects from creating an interpretation',()=>{
    for(const ss of [rows().map(s=>({...s,untouchedOutcomes:['focus'] as StatSession['untouchedOutcomes']})),rows().map(s=>({...s,activity:null})),rows().map(s=>({...s,itemIds:[1,2]}))])expect(calculate(ss).status).toBe('insufficient')
    const e=compareEvidence(rows(),place,'Library','focus',{...DEFAULT_ANALYSIS,includeUntouched:true});expect(e.status).toBe('descriptive');expect(e.limitations).toContain('defaults')
  })
  it('shows fragility instead of a confident conclusion driven by one unusual day',()=>{
    const ss=rows(20).map((s,i)=>({...s,outcomes:{focus:i===0?5:3}})),e=calculate(ss)
    expect(e.status).toBe('descriptive');expect(e.uncertainty.dayLow).toBe(0);expect(e.uncertainty.low).toBeNull();expect(e.sensitivityChecks.trimmedDifference).toBe(0)
  })
  it('deduplicates records and changes revision on source correction or deletion',()=>{
    const ss=rows(),e=calculate(ss);expect(calculate([...ss,...ss]).dataRevision).toBe(e.dataRevision);expect(calculate([...ss].reverse()).dataRevision).toBe(e.dataRevision)
    expect(calculate(ss.slice(1)).dataRevision).not.toBe(e.dataRevision);expect(calculate(ss.map((s,i)=>i? s:{...s,outcomes:{focus:3}})).dataRevision).not.toBe(e.dataRevision)
  })
  it('uses the same estimate and coverage but distinguishes automatic and selected search scope',()=>{
    const ss=rows(),card=generatePersonalInsights(ss,[place],DEFAULT_ANALYSIS,{today:'2026-03-01'}).candidates.find(c=>c.id==='place:Library:focus')!,comparison=compare(ss,place,'Library','focus')
    expect(card.sharedEvidence?.estimate).toEqual(comparison.evidence?.estimate);expect(card.sharedEvidence?.coverage).toEqual(comparison.evidence?.coverage);expect(card.sharedEvidence?.testing.scope).toBe('automatic');expect(comparison.evidence?.testing.scope).toBe('selected');expect(card.rows.map(r=>r.value)).toEqual([comparison.mean,comparison.meanRest]);expect(card.replicated).toBe(false);expect(insightReliability(card).label).toBe('Exploratory association')
    const md=buildReport({title:'Report',periodLabel:'Period',previousLabel:'Prior',sessions:ss,previous:[],factors:[place],options:DEFAULT_ANALYSIS,itemName:()=> 'Subject'})
    const copy=evidenceCopy(card.sharedEvidence!);expect(md).toContain(copy.coverage);expect(md).toContain(copy.uncertainty);expect(md).toContain(copy.limitations)
  })
  it.each(LANGUAGES)('preserves evidence and qualifiers in $id',({id})=>{
    const ss=rows(),source=generatePersonalInsights(ss,[place],DEFAULT_ANALYSIS,{today:'2026-03-01'}).candidates.find(c=>c.id==='place:Library:focus')!,before=structuredClone(source),copy=evidenceCopy(source.sharedEvidence!,id),shown=displayInsight(source,{fields:[],groups:[]},id)
    expect(shown.rows.map(r=>r.value)).toEqual(source.rows.map(r=>r.value));expect(shown.calculation).toContain(copy.coverage);expect(shown.calculation).toContain(copy.uncertainty);expect(shown.limitations).toContain(copy.limitations);expect(source).toEqual(before)
    if(id!=='en')for(const key of ['Exploratory pattern','These are self-ratings, not measured retention or mastery.'])expect(catalogs[id][key]).toBeTruthy()
  })
})
describe('frozen subsequent evidence',()=>{
  const baseline=rows(60),e=calculate(baseline),question=freezeQuestion(e,'place','Library',baseline,'2026-03-01')
  it('does not call a split of existing data new evidence',()=>expect(checkLaterRecords(question,baseline).state).toBe('Not enough later comparison days'))
  it('checks fixed disjoint day checkpoints without searching for a new option',()=>{
    const later=Array.from({length:80},(_,i)=>row(60+i))
    const result=checkLaterRecords(question,[...baseline,...later]);expect(result.state).toBe('Later records point the same way');expect(result.checkpoint).toBe(80);expect(result.evidence?.groups.map(g=>g.days)).toEqual([40,40]);expect(result.evidence?.testing.questions).toBe(5);expect(result.evidence?.testing.scope).toBe('followup');expect(result.evidence?.testing.alpha).toBe(.01)
    expect(checkLaterRecords(question,[...baseline,...later.slice(0,11)]).checkpoint).toBe(10)
  })
  it('retains contradictory, inconclusive and one-condition-only later records',()=>{
    const later=Array.from({length:80},(_,i)=>row(60+i))
    expect(checkLaterRecords(question,[...baseline,...later.map(s=>({...s,outcomes:{focus:s.outcomes.focus===4?2:4}}))]).state).toBe('Later records point the other way')
    expect(checkLaterRecords(question,[...baseline,...later.map(s=>({...s,outcomes:{focus:3}}))]).state).toBe('Later records are inconclusive')
    expect(checkLaterRecords(question,[...baseline,...later.map(s=>({...s,factors:{place:['Library']}}))]).state).toBe('Not enough later comparison days')
  })
  it('invalidates edited discovery records and old algorithm versions',()=>{
    expect(checkLaterRecords(question,baseline.slice(1)).state).toBe('Original records changed; save the question again');expect(checkLaterRecords({...question,algorithmVersion:'old'},baseline).state).toBe('Analysis method changed; save the question again');expect(question.algorithmVersion).toBe(EVIDENCE_VERSION)
  })
  it('validates and transports frozen questions while retaining old snapshots',()=>{
    const card=generatePersonalInsights(baseline,[place],DEFAULT_ANALYSIS,{today:'2026-03-01'}).candidates.find(c=>c.id==='place:Library:focus')!,entry={key:discoveryKey('all',card.id),scope:'all',scopeLabel:'All',status:'saved' as const,checkedOn:'2026-03-01',snapshot:{...discoverySnapshot(card),question}}
    expect(validateDiscovery(entry)).toBe(entry);expect(()=>validateIpcArgs('tools:saveDiscovery',[entry])).not.toThrow();expect(()=>validateDiscovery({...entry,snapshot:{...entry.snapshot,question:{...question,cutoff:'2025-01-01'}}})).toThrow()
  })
})
describe('activity and exposure',()=>{
  it('keeps future and incomplete records outside every Stats surface without changing source data',()=>{
    const ss=rows(4),before=structuredClone(ss),now=Date.UTC(2026,0,2,12)
    expect(completedStatsSessions(ss,'2026-01-02',now).map(s=>s.id)).toEqual([1,2])
    expect(completedStatsSessions([{...ss[0],end:now+1}],'2026-01-02',now)).toEqual([])
    expect(ss).toEqual(before)
  })
  it('uses actual minor subject parts, deduplicated days and calendar gaps',()=>{
    const parts=[{itemId:1,categoryId:1,topCategoryId:1,focusSeconds:1200},{itemId:2,categoryId:1,topCategoryId:1,focusSeconds:600}]
    const a=row(0,{itemIds:[1,2],subjectParts:parts}),b=row(3,{itemId:2,itemIds:[2],focusSeconds:600}),summary=subjectRevisits([a,a,b])
    expect(summary.find(r=>r.itemId===2)).toMatchObject({days:2,last:'2026-01-04',medianGap:3,minGap:3,maxGap:3,largestDayShare:.5,focusSeconds:1200});expect(summary.find(r=>r.itemId===1)?.days).toBe(1)
  })
  it('keeps recent and earlier baseline windows nonoverlapping with different denominators',()=>{
    const ss=rows(90),r=activityBaseline(ss,'2026-03-31');expect(r.recent.from).toBe('2026-03-04');expect(r.earlier.to).toBe('2026-03-03');expect(r.recent.calendarDays).toBe(28);expect(r.earlier.calendarDays).toBe(56);expect(r.recent.minutesPerRecordedDay).toBe(30)
    expect(activityBaseline([], '2026-03-31').recent.minutesPerRecordedDay).toBeNull()
  })
  it('uses partial focus exposure for interruption starts',()=>{
    const s=row(0,{focusSeconds:330,distractions:[{source:'manual',confirmed:true,offsetSeconds:315,durationSeconds:2,startedAt:315000} as StatSession['distractions'][number]]}),d=distractionNumbers([s],x=>x)
    expect(d.byMinute[0]).toMatchObject({count:0,exposureHours:300/3600});expect(d.byMinute[1]).toMatchObject({count:1,exposureHours:30/3600,eventsPerHour:120})
  })
  it('excludes deleted-part holes and overlapping wall ranges from continuity exposure',()=>{
    const s=row(0,{start:0,end:180000,wallRanges:[{start:0,end:30000},{start:10000,end:30000},{start:120000,end:150000}],distractions:[]})
    expect(minuteContinuity([s])).toEqual([{minute:1,share:1,n:1},{minute:3,share:1,n:1}])
  })
})
it('does not promote null searches into confirmed evidence across the whole discovery pipeline',()=>{
  let seed=12345
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  for(let trial=0;trial<30;trial++){
    const ss=Array.from({length:80},(_,i)=>row(i,{outcomes:{focus:1+Math.floor(rand()*5),recall:1+Math.floor(rand()*5)},factors:{place:[rand()<.5?'Library':'Home']}}))
    const result=generatePersonalInsights(ss,[place],DEFAULT_ANALYSIS,{today:'2026-04-01'})
    expect(result.cards.every(c=>!c.replicated&&c.evidence!=='Stronger evidence')).toBe(true)
  }
  // Some chance discoveries are expected; they must remain explicitly exploratory.
})
