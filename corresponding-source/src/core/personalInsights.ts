import { discoveryQuestions, screenEvidence, compareEvidence, contextOf, type EvidenceResult } from './evidence'
import { canSuggestFocusComparison, isStudyMethodFactor, FOCUS_COMPARISON_ACTION, METHOD_OBSERVATION_NOTE } from './recommendations'
import { factorOf, outcomeOf, type AnalysisOptions } from './insights'
import { countsAsLost } from './distractions'
import { lengthBucket, type FactorDef, type StatSession } from './statsData'
import { addDays } from './studyDay'
import { buildDistractionEvidence, type DistractionEvidence } from './distractionEvidence'
import { translate, type AppLanguage } from './localization'

type Outcome = 'focus' | 'recall' | 'length'
type Family = 'time'|'sleep'|'conditions'|'length'|'rest'|'trend'|'distractions'
export interface InsightOrigin {
  comparison?:{rows:{label:string;value:number;n:number}[];n:number;nOther:number;days:number;daysOther:number;unit:string}
  id:string; title:string; factorKey:string; option:string; outcome: 'focus'|'recall'; range:{from:string;to:string}; calculation:string; limitations:string; evidence:string; contexts:{itemId:number;activity:string|null}[]
}
export interface PersonalInsight {
  sharedEvidence?:EvidenceResult
  /** Display inputs only; never used by scoring, eligibility or saved comparisons. */
  presentation?: { methodComparison?:boolean; trimmedDifference?:number; daily?:boolean; includeUntouched?:boolean; withinSubject?:boolean; automaticTracking?:boolean; weekly?:boolean; target?:string; leadingDays?:number }
  trial?:InsightOrigin

  recordSupport?:DistractionEvidence
  total?:number
  context?:string
  profile?:{label:string;value:number;n:number;days:number}[]
  factorKey:string
  id:string; family:Family; title:string; explanation:string
  evidence:'Stronger evidence'|'Preliminary pattern'|'Recorded summary'
  rows:{label:string;value:number;n:number}[]
  n:number; nOther:number; days:number; daysOther:number; sessions:number
  unit:string; outcome:Outcome|null; range:{from:string;to:string}
  calculation:string; limitations:string; replicated:boolean
  action:string|null; section:string; score:number
}
export interface PersonalInsightInput {
  sleepFieldKey?:string
  today:string; all?:StatSession[]; sleepHours?:Map<string,{value:number;touched:boolean}>
  activityLabel?:(id:string)=>string; reasonLabel?:(id:string)=>string
}
interface Observation { s:StatSession; raw:number; side:boolean; cohort:string }
const mean=(xs:number[]):number=>xs.reduce((n,x)=>n+x,0)/xs.length
const days=(rows:Observation[]):number=>new Set(rows.map(x=>x.s.day)).size
const range=(ss:StatSession[]):{from:string;to:string}=>{const d=ss.map(s=>s.day).sort();return {from:d[0]??'',to:d[d.length-1]??''}}

function daily(rows:Observation[]):Observation[] {
  const grouped=new Map<string,Observation[]>()
  for(const r of rows){const key=r.cohort+'|'+r.s.day+'|'+r.side;const a=grouped.get(key)??[];a.push(r);grouped.set(key,a)}
  return [...grouped.values()].map(a=>({...a[0],raw:mean(a.map(r=>r.raw))}))
}
function finding(ss:StatSession[],factor:FactorDef,option:string,outcome:Outcome,o:AnalysisOptions,input:PersonalInsightInput,family:Family,extraCohort?:(s:StatSession)=>string):PersonalInsight|null {
  const original:Observation[]=[]
  const cohortOf=(s:StatSession):string=>`${s.itemId}|${s.activity??'unknown'}|${extraCohort?.(s)??''}${outcome==='length'?`|${s.timerMode}|${s.targetSeconds}`:''}`
  for(const s of ss){
    const value=outcome==='length'?s.focusSeconds/60:outcomeOf(s,outcome,o),answers=factorOf(s,factor.key,o)
    if(s.itemIds.length!==1 || s.activity===null || value===undefined || !Number.isFinite(value) || !answers?.length)continue
    if(outcome==='length' && (value<=0 || value>24*60))continue
    original.push({s,raw:value,side:answers.includes(option),cohort:cohortOf(s)})
  }
  const compared=outcome==='length'?ss.map(s=>({...s,outcomes:{...s.outcomes,length:s.focusSeconds/60}})):ss
  const sharedEvidence=compareEvidence(compared,factor,option,outcome,o,extraCohort)
  if(sharedEvidence.status!=='exploratory'&&!(family==='trend'&&sharedEvidence.status==='descriptive'&&sharedEvidence.estimate!==0))return null
  const contextKeys=new Set(sharedEvidence.scope.contexts)
  const supported=original.filter(r=>contextKeys.has(contextOf(r.s,extraCohort?.(r.s)??(outcome==='length'?JSON.stringify([r.s.timerMode,r.s.targetSeconds]):''))))
  const byDay=true,rows=daily(supported),a=rows.filter(r=>r.side),b=rows.filter(r=>!r.side)
  const [firstGroup,secondGroup]=sharedEvidence.groups
  const n=firstGroup.days,nOther=secondGroup.days,meanA=firstGroup.mean,meanB=secondGroup.mean,diff=sharedEvidence.estimate!,trimDiff=sharedEvidence.sensitivityChecks.trimmedDifference!
  const shared=new Set([...a,...b].map(r=>r.cohort))
  // A split of the discovery window is not independent replication.
  const replicated=false,strong=false
  const direction=diff>0?'higher':'lower',label=input.activityLabel?.(ss[0]?.activity??'')??ss[0]?.activity??'this activity'
  const titles:Record<Family,string>={
    time:`${option} starts are associated with ${direction} reported ${outcome}.`,
    sleep:`Days with ${option} of sleep show ${direction} reported ${outcome}.`,
    conditions:outcome==='length'?`${factor.label}: ${option} is associated with ${Math.abs(diff).toFixed(1)}-minute-${diff>0?'longer':'shorter'} focused sessions.`:`${factor.label}: ${option} goes with ${direction} reported ${outcome}.`,
    length:`For ${label}, ${option} focused sessions show ${direction} reported ${outcome}.`,
    rest:`After ${option} of recorded rest, reported ${outcome} is ${direction}.`,
    trend:`Your reported ${outcome} was ${direction} in the latest four weeks.`,distractions:''
  }
  const id=`${factor.key}:${option}:${outcome}`,paired=[...a,...b].map(r=>r.s)
  const pairedIds=new Set(paired.map(s=>s.id)),pairedKeys=new Set([...a,...b].map(r=>`${r.cohort}|${r.s.day}|${r.side}`))
  const alternativeLabels=[...new Set(b.flatMap(r=>factorOf(r.s,factor.key,o)??[]))]
  const otherLabel=family==='trend'?'Previous four weeks':!factor.multi&&alternativeLabels.length===1?alternativeLabels[0]:family==='length'?'Other session lengths':family==='time'?'Other start times':family==='sleep'?'Other sleep ranges':family==='rest'?'Other recorded breaks':'Other recorded setups'
  // Multi-category charts use the exact same shared cohort weights as the
  // headline. Omit categories missing a shared cohort or minimum observations.
  const profile:NonNullable<PersonalInsight['profile']>=[]
  if(!factor.multi && ['time','sleep','length','rest'].includes(family)){
    const weights=new Map([...shared].map(key=>[key,Math.min(a.filter(r=>r.cohort===key).length,b.filter(r=>r.cohort===key).length)]))
    for(const label of [...new Set(rows.flatMap(r=>factorOf(r.s,factor.key,o)??[]))]){
      const selected=rows.filter(r=>shared.has(r.cohort)&&factorOf(r.s,factor.key,o)?.includes(label)),count=byDay?days(selected):selected.length
      if(count<5||days(selected)<3)continue
      let value=0,total=0,complete=true
      for(const [key,weight] of weights){const group=selected.filter(r=>r.cohort===key);if(group.length<2){complete=false;break}value+=mean(group.map(r=>r.raw))*weight;total+=weight}
      if(complete&&total)profile.push({label,value:value/total,n:count,days:days(selected)})
    }
  }
  const target = diff > 0 ? option : !factor.multi && alternativeLabels.length === 1 ? alternativeLabels[0] : null
  // A pooled association must not recommend a choice for a constituent
  // subject/activity where that choice performed worse or lacks repetition.
  const contexts = [...new Map(paired.map(s => [s.itemId+'|'+(s.activity??''), {itemId:s.itemId,activity:s.activity}])).values()].filter(c=>{
    if(!c.activity)return false
    const own=rows.filter(r=>r.s.itemId===c.itemId&&r.s.activity===c.activity)
    const yes=own.filter(r=>diff>0?r.side:!r.side),no=own.filter(r=>diff>0?!r.side:r.side)
    return days(yes)>=5&&days(no)>=5&&mean(yes.map(r=>r.raw))-mean(no.map(r=>r.raw))>=.35
  })
  const actionable = sharedEvidence.status==='exploratory' && !o.includeUntouched && canSuggestFocusComparison(factor,outcome) && target !== null && contexts.length>0
  const trial:InsightOrigin|undefined = actionable ? {id,title:titles[family],factorKey:factor.key,option:target!,outcome:outcome as 'focus'|'recall',range:range(paired),calculation:'',limitations:'Observational self-ratings, not proof of cause. A before/after trial can still be confounded.',evidence:strong?'Stronger evidence':'Preliminary pattern',contexts} : undefined
  const card:PersonalInsight = {sharedEvidence,id,trial,profile,context:family==='length'?label:factor.label,factorKey:factor.key,family,title:titles[family],explanation:`${Math.abs(diff).toFixed(2)} ${outcome==='length'?'focused minutes':'rating steps'} ${direction} in comparable recorded study. This is an association, not an optimum or proof of cause.`,evidence:strong?'Stronger evidence':'Preliminary pattern',rows:[{label:option,value:meanA,n},{label:otherLabel,value:meanB,n:nOther}],n,nOther,days:days(a),daysOther:days(b),sessions:original.filter(r=>byDay?pairedKeys.has(`${r.cohort}|${r.s.day}|${r.side}`):pairedIds.has(r.s.id)).length,unit:byDay?'study days':'sessions',outcome,range:range(paired),calculation:`Balanced mean ${meanA.toFixed(2)} − ${meanB.toFixed(2)} = ${diff.toFixed(2)} ${outcome==='length'?'focused minutes':'rating steps'}. Shared subject/activity cohorts need two observations per side and have weight equal to the smaller group. ${byDay?'Repeated sessions are averaged within day/cohort; evidence gates use distinct days.':''} 20% trimmed cohort difference: ${trimDiff.toFixed(2)}. ${replicated?'Direction repeated in earlier and later chronological halves.':'Independent temporal replication is insufficient.'}`,limitations:`Only single-subject sessions with confirmed activity and eligible ${outcome==='length'?'recorded focus durations':'recorded ratings'} and factor answers. ${o.includeUntouched?'Untouched default ratings included by your option.':'Unanswered/untouched ratings excluded.'} Matching controls recorded subject/activity composition${outcome==='length'?' plus timer mode and chosen target; longer is not necessarily better':''}${family==='rest'?' and preceding focused-length bucket':''}; unrecorded activities, other conditions, time and logging changes may still differ. ${outcome==='length'?'Focused duration is recorded time, not a learning outcome.':'These are self-ratings, not objective mastery.'} ${o.withinSubject?'Your within-subject option is compatible with these within-cohort differences; subject centering cancels within each matched cohort.':''}`,replicated,action:actionable?FOCUS_COMPARISON_ACTION.replace('{option}',target!):null,section:family==='time'?'time':family==='rest'?'rest':family==='length'?'methods':family==='trend'?'rhythm':'factors',score:(strong?100:20)+Math.min(20,Math.min(n,nOther)) +Math.min(5,Math.abs(diff)/(outcome==='length'?10:1))*5}
  if(isStudyMethodFactor(factor))card.limitations=METHOD_OBSERVATION_NOTE+' '+card.limitations
  card.presentation={methodComparison:isStudyMethodFactor(factor),trimmedDifference:trimDiff,daily:byDay,includeUntouched:o.includeUntouched,withinSubject:o.withinSubject,target:target??undefined}
  if(card.trial){card.trial.calculation=card.calculation;card.trial.limitations=card.limitations;card.trial.comparison={rows:card.rows.map(r=>({...r})),n,nOther,days:card.days,daysOther:card.daysOther,unit:card.unit}}
  return card
}

/** Recorded duration is attributed once per wall-clock segment; manual reasons take precedence over detected duplicates. */
function distractionSummary(ss:StatSession[],input:PersonalInsightInput):PersonalInsight[] {
  const tallies=new Map<string,{count:number;seconds:number;days:Set<string>;source:Set<string>}>()
  const byDay=new Map<string,Map<string,{count:number;seconds:number;creditedEvents:Set<string>}>>()
  for(const s of ss){
    const intervals:{start:number;end:number;key:string;priority:number;event:string}[]=[]
    for(const [index,d] of s.distractions.entries()){
      if(!countsAsLost(d))continue
      const key=d.source==='auto'?d.label??d.app??'Detected app':input.reasonLabel?.(d.kind)??d.kind??'Recorded interruption'
      const t=tallies.get(key)??{count:0,seconds:0,days:new Set<string>(),source:new Set<string>()};t.count++;t.days.add(s.day);t.source.add(d.source);tallies.set(key,t)
      const day=byDay.get(s.day)??new Map(),entry=day.get(key)??{count:0,seconds:0,creditedEvents:new Set<string>()};entry.count++;day.set(key,entry);byDay.set(s.day,day)
      for(const range of s.wallRanges??[{start:s.start,end:s.end}]){
        const start=Math.max(range.start,d.startedAt),end=Math.min(range.end,d.startedAt+Math.max(0,d.durationSeconds)*1000)
        if(Number.isFinite(start)&&end>start)intervals.push({start,end,key,priority:d.source==='pause'?0:d.source==='auto'?1:2,event:`${s.id}:${index}`})
      }
    }
    const events=intervals.flatMap((r,i)=>[{at:r.start,id:i,open:true},{at:r.end,id:i,open:false}]).sort((a,b)=>a.at-b.at)
    const active=new Set<number>();let last=events[0]?.at??0
    for(const e of events){
      if(e.at>last && active.size){const chosen=[...active].sort((a,b)=>intervals[a].priority-intervals[b].priority||a-b)[0],interval=intervals[chosen],seconds=(e.at-last)/1000; tallies.get(interval.key)!.seconds+=seconds;const daily=byDay.get(s.day)!.get(interval.key)!;daily.seconds+=seconds;daily.creditedEvents.add(interval.event)}
      if(e.open)active.add(e.id);else active.delete(e.id);last=e.at
    }
  }
  const all=[...tallies].map(([label,t])=>({label,...t}));if(!all.length)return []
  const minutes=[...all].sort((a,b)=>b.seconds-a.seconds),counts=[...all].sort((a,b)=>b.count-a.count)
  const cards:PersonalInsight[]=[]
  for(const [kind,list] of [['duration',minutes],['frequency',counts]] as const){
    const top=list[0];if(kind==='duration' && top.seconds<=0)continue
    cards.push({recordSupport:buildDistractionEvidence([...byDay].map(([day,reasons])=>({day,reasons:[...reasons].map(([label,t])=>({label,events:kind==='duration'?t.creditedEvents.size:t.count,seconds:t.seconds}))})),kind==='duration'?'minutes':'events'),total:all.reduce((sum,t)=>sum+(kind==='duration'?t.seconds/60:t.count),0),id:'distraction-'+kind,factorKey:'distraction-'+kind,family:'distractions',title:`${top.label} ${kind==='duration'?'accounts for the most attributed recorded distraction time':'is your most frequently recorded distraction'}.`,explanation:kind==='duration'?`${(top.seconds/60).toFixed(1)} recorded minutes across ${top.count} events.`:`${top.count} recorded events across ${top.days.size} study days. Frequency and time lost are different measures.`,evidence:'Recorded summary',rows:list.slice(0,5).map(t=>({label:t.label,value:kind==='duration'?t.seconds/60:t.count,n:t.count})),n:all.reduce((n,t)=>n+t.count,0),nOther:0,days:new Set(ss.flatMap(s=>s.distractions.filter(countsAsLost).map(()=>s.day))).size,daysOther:0,sessions:ss.length,unit:kind==='duration'?'minutes':'events',outcome:null,range:range(ss),calculation:kind==='duration'?'Lost-counting intervals are clipped to each session and swept once. Manual reasons take precedence over overlapping auto/idle records; no time segment is counted twice.':'Counts recorded lost-counting events, not keyboard/mouse absence without confirmation.',limitations:`Unrecorded time is not classified as distraction. ${all.some(t=>t.source.has('auto'))?'Includes previously recorded automatic tracking; disabling tracking preserves this history.':'No automatic tracking is required; these are manually recorded or confirmed events.'} Unknown reasons remain unknown.`,replicated:false,action:null,section:'distractions',score:50+Math.min(30,top.count)})
  }
  for(const card of cards)card.presentation={automaticTracking:all.some(t=>t.source.has('auto')),leadingDays:all.find(t=>t.label===card.rows[0].label)?.days.size}
  return cards
}

export function generatePersonalInsights(sessions:StatSession[],factors:FactorDef[],o:AnalysisOptions,input:PersonalInsightInput) {
  const valid=sessions.filter(s=>s.day<=input.today && Number.isFinite(s.start)&&Number.isFinite(s.end)),cards:PersonalInsight[]=[]
  const previous=new Map<number,StatSession>(),before=new Map<number,StatSession>()
  for(const s of [...(input.all??valid)].sort((a,b)=>a.start-b.start)){const last=previous.get(s.sittingId);if(last)before.set(s.id,last);previous.set(s.sittingId,s)}
  const prepared=valid.map(s=>{
    const copy={...s,factors:{...s.factors}},h=Math.floor(s.hour/2)*2
    copy.factors['insight-time']=[`${String(h).padStart(2,'0')}:00–${String(h+2).padStart(2,'0')}:00`]
    const sleep=input.sleepHours?.get(s.day)
    if(sleep && Number.isFinite(sleep.value) && sleep.value>=0 && sleep.value<=24 && (sleep.touched||o.includeUntouched))copy.factors['insight-sleep']=[sleep.value<6?'under 6 h':sleep.value<7?'6–7 h':sleep.value<8?'7–8 h':sleep.value<9?'8–9 h':'9 h or more']
    if(s.activity)copy.factors['insight-length:'+s.activity]=[lengthBucket(s.focusSeconds/60)]
    const p=before.get(s.id),r=p?.rest
    if(p)copy.factors['insight-rest-context']=[lengthBucket(p.focusSeconds/60)]
    if(p && p.end<=s.start && r && !r.skipped && r.actualSeconds!==null && r.actualSeconds>0 && Number.isFinite(r.actualSeconds))copy.factors['insight-rest']=[r.actualSeconds<300?'under 5 min':r.actualSeconds<600?'5–10 min':r.actualSeconds<1200?'10–20 min':'20 min or more']
    if(s.day>=addDays(input.today,-55))copy.factors['insight-period']=[s.day>=addDays(input.today,-27)?'Latest four weeks':'Previous four weeks']
    return copy
  })
  const jobs:{factor:FactorDef;family:Family;rows:StatSession[];extra?:(s:StatSession)=>string}[]=[]
  const definition=(key:string,label:string,group:FactorDef['group']='derived'):FactorDef=>({key,label,group,options:[],multi:false})
  jobs.push({factor:definition('insight-time','Start time'),family:'time',rows:prepared},{factor:definition('insight-sleep','Hours of sleep','day'),family:'sleep',rows:prepared},{factor:definition('insight-rest','Actual recorded rest'),family:'rest',rows:prepared,extra:s=>s.factors['insight-rest-context']?.[0]??''},{factor:definition('insight-period','Reported outcome trend'),family:'trend',rows:prepared})
  const activities=new Map<string,StatSession[]>()
  for(const s of prepared)if(s.activity){const a=activities.get(s.activity)??[];a.push(s);activities.set(s.activity,a)}
  for(const [activity,rows] of activities)jobs.push({factor:definition('insight-length:'+activity,'Focused length'),family:'length',rows})
  const available=factors.filter(f=>f.group!=='derived' && f.key!==input.sleepFieldKey).map(f=>({factor:f,family:'conditions' as const,rows:prepared,coverage:prepared.filter(s=>factorOf(s,f.key,o)?.length).length})).sort((a,b)=>b.coverage-a.coverage)
  jobs.push(...available)
  let examined=0
  for(const job of jobs){
    const labels=[...new Set(job.rows.flatMap(s=>factorOf(s,job.factor.key,o)??[]))]
    const outcomes:Outcome[]=job.family==='conditions'?['focus','recall','length']:['focus','recall']
    for(const option of labels){if(job.family==='trend' && option!=='Latest four weeks')continue
      for(const outcome of outcomes){if(examined>=160)break;examined++
        const c=finding(job.rows,job.factor,option,outcome,o,input,job.family,job.extra);if(c)cards.push(c)
      }
    }
    if(examined>=160)break
  }
  cards.push(...distractionSummary(valid,input))
  const questions=discoveryQuestions(factors,valid)
  const screened=cards.map(c=>c.sharedEvidence?{...c,sharedEvidence:screenEvidence(c.sharedEvidence,questions)}:c).filter(c=>!c.sharedEvidence||c.sharedEvidence.status==='exploratory'||c.family==='trend'&&c.sharedEvidence.status==='descriptive')
  const seen=new Set<string>(),unique=screened.sort((a,b)=>a.id.localeCompare(b.id)).filter(c=>{const key=c.family==='conditions'?c.factorKey:c.family==='distractions'?c.id:c.family;if(seen.has(key))return false;seen.add(key);return true})
  // Reserve room for other eligible questions rather than six versions of
  // the same conditions card. Never fill an absent family with advice.
  const ranked:PersonalInsight[]=[],deferred:PersonalInsight[]=[];let conditions=0
  for(const c of unique){if(c.family==='conditions'&&conditions>=2)deferred.push(c);else {ranked.push(c);if(c.family==='conditions')conditions++}}
  ranked.push(...deferred);ranked.splice(6)
  const hours=Array.from({length:24},(_,hour)=>{const rows=valid.filter(s=>s.hour===hour),ratings=rows.map(s=>outcomeOf(s,'focus',o)).filter((v):v is number=>v!==undefined&&Number.isFinite(v));return {hour,n:ratings.length,mean:ratings.length>=5?mean(ratings):null,sessions:rows.length}})
  return {analysisRows:prepared,sessionIds:valid.map(s=>s.id),cards:ranked,candidates:screened,examined,hours,coverage:{sessions:valid.length,days:new Set(valid.map(s=>s.day)).size,focus:valid.filter(s=>outcomeOf(s,'focus',o)!==undefined).length,recall:valid.filter(s=>outcomeOf(s,'recall',o)!==undefined).length,sleepDays:new Set(prepared.filter(s=>s.factors['insight-sleep']).map(s=>s.day)).size,mixed:valid.filter(s=>s.itemIds.length!==1).length,unknownActivity:valid.filter(s=>!s.activity).length}}
}

/** Weekly periods share the ordinary matched-cohort, answer-coverage and outlier gates. */
export function compareReviewPeriods(current:StatSession[],previous:StatSession[],today:string):PersonalInsight|null {
  const rows=[...previous.map(s=>({...s,factors:{...s.factors,'review-period':['Previous matched weekdays']}})),...current.map(s=>({...s,factors:{...s.factors,'review-period':['This week']}}))]
  const factor:FactorDef={key:'review-period',label:'Matched weekdays',group:'derived',multi:false,options:['This week','Previous matched weekdays']}
  for(const outcome of ['focus','recall'] as const){const card=finding(rows,factor,'This week',outcome,{includeUntouched:false,withinSubject:true},{today},'trend');if(card)return {...card,presentation:{...card.presentation,weekly:true},rows:card.rows.map((r,i)=>({...r,label:i?'Previous matched weekdays':'This week'})),title:`Reported ${outcome} is ${card.rows[0].value>card.rows[1].value?'higher':'lower'} in comparable sessions this week.`,action:null,trial:undefined}}
  return null
}

export interface PreparationSuggestion {
  id:string; label:string; explanation:string
  presentation?:{factorKey:string;context:string;option:string;outcome:string;n:number;nOther:number;activity:boolean}
}
export interface StudyTimePattern { startHour:number; endHour:number; sessions:number; otherSessions:number; days:number; otherDays:number }
/** Retired compatibility APIs: observational ratings do not establish a reliable
 * personal schedule or a preparation prescription. Never run a hidden search. */
export function studyTimePatterns(_sessions:StatSession[],_today:string):StudyTimePattern[] { return [] }
export function preparationSuggestions(_sessions:StatSession[],_factors:FactorDef[],_itemId:number,_activity:string|null,_today:string):PreparationSuggestion[] { return [] }

export function personalInsightsMarkdown(cards:PersonalInsight[],language:AppLanguage='en'):string {
  const plain=(s:string):string=>s.replace(/[\r\n]+/g,' ').replace(/[\\`*_[\]<>]/g,'\\$&')
  const t=(key:string,values?:Record<string,string|number>):string=>translate(language,key,values)
  return '\n\n## '+t('Personal study insights')+'\n\n'+(cards.length?cards.map(c=>`### ${plain(c.title)}\n\n${plain(c.explanation)}\n\n${t(c.evidence)}. ${t('{first}{comparison} usable {unit}. {from} to {to}.',{first:c.n,comparison:c.nOther?t(' vs {other}',{other:c.nOther}):'',unit:t(c.unit),from:c.range.from,to:c.range.to})}\n\n${c.rows.map(r=>`${plain(r.label)}: ${r.value.toFixed(2)} (n=${r.n})`).join('; ')}.\n\n${t('How determined: {calculation}',{calculation:plain(c.calculation)})}\n\n${t('Limits: {limitations}',{limitations:plain(c.limitations)})}\n`).join('\n'):t('No reliable personal comparison in this period. No advice is inferred from missing evidence.')+'\n')
}
