import { translate, type AppLanguage } from './localization'
import { canSuggestFocusComparison, FOCUS_COMPARISON_ACTION } from './recommendations'
import type { FactorDef } from './statsData'
import type { FrozenQuestion } from './followupEvidence'
import type { PersonalInsight, InsightOrigin } from './personalInsights'
import type { BlockSummary } from './stats'
import type { StudyExperiment } from './studyTools'

export interface DiscoverySnapshot {
  question?:FrozenQuestion
  id:string; title:string; from:string; to:string; n:number; nOther:number;
  days:number; daysOther:number; unit:string; delta:number; replicated:boolean; strong:boolean
}
export interface DiscoveryRecord {
  key:string; scope:string; scopeLabel:string; status:'saved'|'dismissed'|'seen'; checkedOn:string; snapshot:DiscoverySnapshot
}
export function discoverySnapshot(c:PersonalInsight):DiscoverySnapshot {
  return {id:c.id,title:c.title,from:c.range.from,to:c.range.to,n:c.n,nOther:c.nOther,days:c.days,daysOther:c.daysOther,unit:c.unit,delta:c.rows.length>1?c.rows[0].value-c.rows[1].value:0,replicated:c.replicated,strong:c.evidence==='Stronger evidence'}
}
export const discoveryKey=(scope:string,id:string):string=>JSON.stringify([scope,id])
/** Compare the same question in the same view. Counts alone never manufacture an update. */
export function discoveryChange(previous:DiscoverySnapshot|undefined,current:PersonalInsight|undefined):string {
  if(!current)return 'Not currently supported'
  if(!previous)return 'New to you'
  const next=discoverySnapshot(current)
  if(current.family==='distractions')return next.title!==previous.title?'Ranking changed':'Recorded summary'
  if(Math.sign(previous.delta)!==Math.sign(next.delta))return 'Direction changed'
  if((previous.replicated&&!next.replicated)||(previous.strong&&!next.strong))return 'Less support now'
  const fresh=next.to>previous.to && next.n+next.nOther>=previous.n+previous.nOther+5 && next.days+next.daysOther>=previous.days+previous.daysOther+3
  if(fresh&&((next.replicated&&!previous.replicated)||(next.strong&&!previous.strong)||Math.abs(next.delta-previous.delta)>=(current.outcome==='length'?5:.35)))return 'Updated finding'
  return current.sharedEvidence?(current.sharedEvidence.status==='exploratory'?'Exploratory association':'Recorded comparison'):next.replicated?'Established pattern':'Early pattern'
}
export function validateDiscovery(d:DiscoveryRecord):DiscoveryRecord {
  const s=d.snapshot
  for(const [v,max] of [[d.key,6000],[d.scope,4000],[d.scopeLabel,1000],[s.id,1000],[s.title,3000],[s.unit,100]] as const)if(typeof v!=='string'||!v.length||v.length>max)throw Error('Invalid discovery text.')
  if(d.key!==discoveryKey(d.scope,s.id)||!['saved','dismissed','seen'].includes(d.status))throw Error('Invalid discovery identity.')
  for(const date of [d.checkedOn,s.from,s.to])if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Invalid discovery date.')
  if(s.from>s.to||[s.n,s.nOther,s.days,s.daysOther].some(n=>!Number.isSafeInteger(n)||n<0)||!Number.isFinite(s.delta)||typeof s.replicated!=='boolean'||typeof s.strong!=='boolean')throw Error('Invalid discovery evidence.')
  if(s.question){const q=s.question
    for(const value of [q.algorithmVersion,q.factorKey,q.option,q.revision])if(typeof value!=='string'||!value.length||value.length>1000)throw Error('Invalid discovery evidence.')
    if(!['focus','recall','understanding','distractionsPerHour','lostShare','longestStretch','length','progressRate'].includes(q.outcome)||![-1,0,1].includes(q.direction))throw Error('Invalid discovery evidence.')
    for(const list of [q.contexts,q.alternatives])if(!Array.isArray(list)||list.length>2000||list.some(v=>typeof v!=='string'||v.length>2000))throw Error('Invalid discovery evidence.')
    for(const value of [q.from,q.to,q.cutoff])if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('Invalid discovery date.')
    if(q.from>q.to||q.to>q.cutoff||!q.alternatives.includes(q.option))throw Error('Invalid discovery evidence.')
  }
  return d
}
/** Keep only deliberate review flags and written recall. No invented review schedule. */
export function learningReturns(blocks:BlockSummary[],itemId:number|null=null):BlockSummary[] {
  return blocks.filter(b=>(itemId===null||b.itemId===itemId)&&!b.reviewDone&&(b.reviewMarked||!!b.recallText?.trim()))
    .sort((a,b)=>Number(b.reviewMarked)-Number(a.reviewMarked)||b.focusStartedAt.localeCompare(a.focusStartedAt)||b.id-a.id).slice(0,3)
}
export function suggestedExperiment(origin:InsightOrigin,today:string,endDay:string,baselineFrom:string,id:string,factor:FactorDef,language:AppLanguage='en',optionLabel=origin.option):StudyExperiment {
  if(factor.key!==origin.factorKey||!canSuggestFocusComparison(factor,origin.outcome))throw Error('This observation does not support an automatic comparison proposal.')
  const unique=origin.contexts.length===1?origin.contexts[0]:null
  return {id,name:translate(language,'Compare {option}',{option:optionLabel}).slice(0,100),change:translate(language,FOCUS_COMPARISON_ACTION,{option:optionLabel}),origin,itemId:unique?.itemId??0,activity:unique?.activity??null,baselineFrom,changeOn:today,endDay,outcome:origin.outcome,notes:'',status:'planned',includeUntouched:false}
}
