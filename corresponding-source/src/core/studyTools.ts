import { compareEvidence } from './evidence'
import { compareReviewPeriods, generatePersonalInsights, type InsightOrigin } from './personalInsights'
import type { DiscoveryRecord } from './discoveries'
import { addDays } from './studyDay'
import { OUTCOMES, type OutcomeKey, type StatSession, type FactorDef } from './statsData'
import { DEFAULT_ANALYSIS, outcomeOf, factorOf, type AnalysisOptions } from './insights'

export type ViewRange = 'this-week'|'last-30'|'last-90'|'this-month'|'last-month'|'this-year'|'all'|'custom'
export interface ComparisonView { id:string; name:string; range:ViewRange; custom:{from:string;to:string}; filter:{itemId:number|null;categoryId:number|null;activity:string|null}; options:AnalysisOptions; outcome:OutcomeKey }
export interface StudyExperiment { activity?:string|null; origin?:InsightOrigin; id:string; name:string; change:string; itemId:number; baselineFrom:string; changeOn:string; endDay:string; outcome:OutcomeKey; notes:string; status:'planned'|'active'|'completed'; includeUntouched:boolean }
export interface WeeklyReflection { week:string; note:string; nextStep:string }
export interface StudyToolsData { views:ComparisonView[]; experiments:StudyExperiment[]; reviews:WeeklyReflection[]; discoveries?:DiscoveryRecord[] }
export const EMPTY_TOOLS:StudyToolsData={views:[],experiments:[],reviews:[]}
const date=(v:string):void=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||addDays(v,0)!==v)throw Error('Choose a valid date.')}
const text=(v:string,max:number):void=>{if(typeof v!=='string'||v.length>max)throw Error('Text is too long or invalid.')}
const identity=(v:string):void=>{if(typeof v!=='string'||!/^[a-z0-9-]{1,80}$/i.test(v))throw Error('Invalid identifier.')}
const outcome=(v:OutcomeKey):void=>{if(!OUTCOMES.some(o=>o.key===v))throw Error('Choose a valid outcome.')}
export function validateView(v:ComparisonView):ComparisonView {
  identity(v.id);text(v.name,100);if(!v.name.trim())throw Error('Name this view.')
  if(!['this-week','last-30','last-90','this-month','last-month','this-year','all','custom'].includes(v.range))throw Error('Invalid date range.')
  date(v.custom.from);date(v.custom.to);if(v.custom.from>v.custom.to)throw Error('The end date must follow the start date.')
  for(const id of [v.filter.itemId,v.filter.categoryId])if(id!==null&&(!Number.isSafeInteger(id)||id<1))throw Error('Invalid subject or category.')
  if(v.filter.activity!==null)text(v.filter.activity,200)
  if(typeof v.options.withinSubject!=='boolean'||typeof v.options.includeUntouched!=='boolean')throw Error('Invalid analysis options.')
  outcome(v.outcome);return v
}
export function validateExperiment(e:StudyExperiment):StudyExperiment {
  identity(e.id);text(e.name,100);text(e.change,2000);text(e.notes,10000)
  if(!e.name.trim()||!e.change.trim())throw Error('Name the experiment and describe the one change you want to try.')
  if(!Number.isSafeInteger(e.itemId)||e.itemId<1)throw Error('Choose a subject.')
  date(e.baselineFrom);date(e.changeOn);date(e.endDay)
  if(e.baselineFrom>=e.changeOn||e.changeOn>e.endDay)throw Error('Baseline must start before the change, and the end must be on or after the change.')
  outcome(e.outcome);if(!['planned','active','completed'].includes(e.status)||typeof e.includeUntouched!=='boolean')throw Error('Invalid experiment status.')
  if(e.activity !== undefined && e.activity !== null)text(e.activity,200)
  if(e.origin){
    const o=e.origin
    text(o.id,500);text(o.title,2000);text(o.factorKey,200);text(o.option,500);text(o.calculation,5000);text(o.limitations,5000);text(o.evidence,200)
    date(o.range.from);date(o.range.to);outcome(o.outcome)
    if(!Array.isArray(o.contexts)||!o.contexts.length||o.contexts.length>2000)throw Error('Invalid source study context.')
    for(const c of o.contexts){if(!Number.isSafeInteger(c.itemId)||c.itemId<1)throw Error('Invalid source subject.');if(c.activity!==null)text(c.activity,200)}
    if(o.comparison){const c=o.comparison;if(!Array.isArray(c.rows)||c.rows.length!==2||c.rows.some(r=>typeof r.label!=='string'||r.label.length>500||!Number.isFinite(r.value)||!Number.isSafeInteger(r.n)||r.n<0)||[c.n,c.nOther,c.days,c.daysOther].some(n=>!Number.isSafeInteger(n)||n<0))throw Error('Invalid source comparison.');text(c.unit,100)}
    if(!e.activity)throw Error('Choose an original recorded activity.')
    if(e.outcome!==o.outcome || !o.contexts.some(c=>c.itemId===e.itemId&&c.activity===(e.activity??null)))throw Error('Choose a subject and activity from the original finding.')
  }
  return e
}
export function validateReview(r:WeeklyReflection):WeeklyReflection {date(r.week);text(r.note,10000);text(r.nextStep,2000);return r}

/** A descriptive, matched before/after comparison. No causal estimate is made. */
export function experimentResults(sessions:StatSession[],e:StudyExperiment,today:string) {
  const own=sessions.filter(s=>s.itemIds.length===1&&s.itemIds[0]===e.itemId&&s.day>=e.baselineFrom&&s.day<=e.endDay&&s.day<=today&&(e.activity===undefined||s.activity===e.activity))
  // Untouched values may be displayed by explicit advanced opt-in, but cannot
  // establish adherence or a supported result.
  const opts={...DEFAULT_ANALYSIS,includeUntouched:e.includeUntouched}
  const baseline=own.filter(s=>s.day<e.changeOn),changed=own.filter(s=>s.day>=e.changeOn)
  const common=new Set(baseline.filter(s=>s.activity!==null&&outcomeOf(s,e.outcome,opts)!==undefined).map(s=>s.activity).filter(activity=>changed.some(s=>s.activity===activity&&outcomeOf(s,e.outcome,opts)!==undefined)))
  const period=(rows:StatSession[],after:boolean)=>{
    const rated=rows.filter(s=>outcomeOf(s,e.outcome,opts)!==undefined),matching=rated.filter(s=>common.has(s.activity))
    const known=e.origin?rated.filter(s=>factorOf(s,e.origin!.factorKey)?.length):[]
    const adherent=e.origin?known.filter(s=>factorOf(s,e.origin!.factorKey)!.includes(e.origin!.option)===after):[]
    return {matchedN:matching.length,matchedDays:new Set(matching.map(s=>s.day)).size,total:rows.length,n:rated.length,mean:rated.length?rated.reduce((n,s)=>n+outcomeOf(s,e.outcome,opts)!,0)/rated.length:null,days:new Set(rated.map(s=>s.day)).size,conditionKnown:known.length,conditionMatched:adherent.length}
  }
  const before=period(baseline,false),after=period(changed,true)
  const compared=own.map(s=>({...s,factors:{...s.factors,'experiment-period':[s.day<e.changeOn?'before':'after']}}))
  const sharedEvidence=compareEvidence(compared,{key:'experiment-period',label:'period',options:['before','after'],multi:false,group:'derived'},'after',e.outcome,opts)
  const observedDifference=sharedEvidence.estimate
  const adherenceVerified=!!e.origin&&before.conditionKnown===before.n&&after.conditionKnown===after.n&&before.conditionMatched===before.n&&after.conditionMatched===after.n&&before.n>0&&after.n>0
  const enough=sharedEvidence.status!=='insufficient'
  const difference=enough&&adherenceVerified&&!e.includeUntouched?observedDifference:null
  const status=!e.origin?'Change not verified':!adherenceVerified?'Change not confirmed in the records':!enough?'More comparable records needed':e.includeUntouched?'Unconfirmed answers included':'Descriptive comparison available'
  return {sharedEvidence,before,after,difference,observedDifference,adherenceVerified,status,mixedExcluded:sessions.filter(s=>s.itemIds.includes(e.itemId)&&s.itemIds.length>1&&s.day>=e.baselineFrom&&s.day<=e.endDay&&s.day<=today).length}
}
export function weeklyReview(sessions:StatSession[],factors:FactorDef[],week:string,today:string) {
  const end=addDays(week,6),previous=addDays(week,-7)
  const through=today<week?null:today<end?today:end
  const previousThrough=through?addDays(through,-7):null
  const rows=sessions.filter(s=>s.day>=week&&s.day<=end&&s.day<=today)
  const prior=sessions.filter(s=>s.day>=previous&&s.day<week&&previousThrough!==null&&s.day<=previousThrough)
  const seconds=(xs:StatSession[])=>xs.reduce((n,s)=>n+s.focusSeconds,0)
  const finding=null // Retired weekly replication-based proposal; retain the result shape.
  const daily=Array.from({length:7},(_,i)=>{const day=addDays(week,i),sessions=rows.filter(s=>s.day===day);return {day,seconds:seconds(sessions),sessions:sessions.length}})
  const summary=(xs:StatSession[],key:OutcomeKey)=>{const values=xs.filter(s=>s.itemIds.length===1).map(s=>outcomeOf(s,key)).filter((v):v is number=>v!==undefined&&Number.isFinite(v));return {n:values.length,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null}}
  // Mixed sessions remain a separate bucket: attributing their whole duration to
  // the dominant subject would overstate that subject's time.
  const subjects=new Map<number|null,{itemId:number|null;seconds:number;sessions:number}>()
  for(const s of rows){const id=s.itemIds.length===1?s.itemIds[0]:null,p=subjects.get(id)??{itemId:id,seconds:0,sessions:0};p.seconds+=s.focusSeconds;p.sessions++;subjects.set(id,p)}
  const outcomes=(['focus','recall'] as const).map(key=>({key,current:summary(rows,key),previous:summary(prior,key)}))
  const matchedChange=compareReviewPeriods(rows,prior,today)
  const recent=sessions.filter(s=>through!==null&&s.day>=addDays(through,-89)&&s.day<=through)
  const working=generatePersonalInsights(recent,factors,DEFAULT_ANALYSIS,{today:through??today,all:recent}).candidates.find(c=>c.trial&&c.rows[0].value>c.rows[1].value&&c.trial.contexts.some(context=>rows.some(s=>s.itemId===context.itemId&&s.activity===context.activity)))??null
  return {matchedChange,working,through,previousThrough,previousFrom:previous,daily,subjects:[...subjects.values()].sort((a,b)=>b.seconds-a.seconds),outcomes,end,rows:rows.length,days:new Set(rows.map(s=>s.day)).size,focusSeconds:seconds(rows),previousSeconds:seconds(prior),previousSessions:prior.length,missingFocus:rows.filter(s=>outcomeOf(s,'focus')===undefined).length,missingRecall:rows.filter(s=>outcomeOf(s,'recall')===undefined).length,finding}
}
