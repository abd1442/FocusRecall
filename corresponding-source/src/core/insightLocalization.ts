import { FOCUS_COMPARISON_ACTION, METHOD_OBSERVATION_NOTE } from './recommendations'
import { evidenceCopy } from './evidenceCopy'
import type { PersonalInsight, PreparationSuggestion, InsightOrigin } from './personalInsights'
import type { LogSchema } from './logfields'
import { fieldDisplay, reasonDisplayName } from './localizedFields'
import type { ReasonOption } from './distractions'
import { translate, type AppLanguage } from './localization'
import { factorCopy } from './localizedStats'
import { localizedCount } from './localizedCount'

const derivedLabels = new Set(['Other start times','Other sleep ranges','Other session lengths','Other recorded breaks','Other recorded setups','Latest four weeks','Previous four weeks','Start time','Hours of sleep','Actual recorded rest','Reported outcome trend','Focused length','This week','Previous matched weekdays'])

/** A display copy only. Analytical keys, comparisons and saved evidence stay
 * canonical. User-renamed fields and options must keep their original text. */
export function displayInsight(source:PersonalInsight, schema:LogSchema, language:AppLanguage,reasons:ReasonOption[]=[]):PersonalInsight {
  if(language==='en'&&!source.sharedEvidence&&source.family!=='distractions')return source
  const field=schema.fields.find(f=>'field:'+f.id===source.factorKey)
  const displayed=field&&fieldDisplay(language,field)
  const label=(value:string):string=>{
    if(source.family==='distractions'){
      const matching=reasons.filter(r=>r.label===value)
      if(matching.length===1)return reasonDisplayName(language,matching[0])
    }
    if(field&&displayed){
      const option=field.options.find(o=>o.label===value)
      if(option)return displayed.options.find(o=>o.id===option.id)?.label??value
      const scaleIndex=field.scale?.labels.indexOf(value)??-1
      if(scaleIndex>=0)return displayed.scale?.labels[scaleIndex]??value
    }
    if(derivedLabels.has(value))return translate(language,value)
    // These ranges are generated only for built-in time/sleep/length/rest
    // families. Never parse or translate a user's custom option as a range.
    if(source.family!=='conditions'&&source.family!=='distractions'){
      const range=/^(\d+(?:\.\d+)?) to (\d+(?:\.\d+)?) min$/.exec(value)
      if(range)return translate(language,'{from} to {to} min',{from:range[1],to:range[2]})
      if(['under 15 min','15 to 30 min','30 to 45 min','45 to 60 min','60 min and more','under 6 h','6–7 h','7–8 h','8–9 h','9 h or more','under 5 min','5–10 min','10–20 min','20 min or more'].includes(value))return translate(language,value)
    }
    return value
  }
  const activity=schema.fields.find(f=>f.key==='activity')
  const option=source.family==='length'&&activity?.options.find(o=>o.label===source.context)
  const context=option&&activity?fieldDisplay(language,activity).options.find(o=>o.id===option.id)?.label:source.context
  const shown={...source,context:field&&displayed?displayed.label:context&&derivedLabels.has(context)?translate(language,context):context,
    rows:source.rows.map(row=>({...row,label:label(row.label)})),profile:source.profile?.map(row=>({...row,label:label(row.label)}))}
  const t=(key:string,values?:Record<string,string|number>):string=>translate(language,key,values)
  const p=source.presentation,[first,other]=shown.rows
  if(!p||!first)return shown
  if(source.family==='distractions'){
    if(source.recordSupport){const e=source.recordSupport;shown.recordSupport={...e,leader:e.leader&&label(e.leader),earlier:{...e.earlier,leader:e.earlier.leader&&label(e.earlier.leader)},later:{...e.later,leader:e.later.leader&&label(e.later.leader)}}}
    shown.title=t(source.unit==='minutes'?'{reason} accounts for the most attributed recorded distraction time.':'{reason} is your most frequently recorded distraction.',{reason:first.label})
    shown.explanation=source.unit==='minutes'?t('Recorded minutes: {minutes} · {events}.',{minutes:first.value.toFixed(1),events:localizedCount(first.n,'event',language)}):t('{events} · {days}. Frequency and time lost are different measures.',{events:localizedCount(first.n,'event',language),days:localizedCount(p.leadingDays??source.days,'studyDay',language)})
    shown.calculation=t(source.unit==='minutes'?'Lost-counting intervals are clipped to each session and swept once. Manual reasons take precedence over overlapping auto/idle records; no time segment is counted twice.':'Counts recorded lost-counting events, not keyboard/mouse absence without confirmation.')
    shown.limitations=[t('Unrecorded time is not classified as distraction.'),t(p.automaticTracking?'Includes previously recorded automatic tracking; disabling tracking preserves this history.':'No automatic tracking is required; these are manually recorded or confirmed events.'),t('Unknown reasons remain unknown.')].join(' ')
    return shown
  }
  if(!other||!source.outcome)return shown
  const diff=first.value-other.value,direction=t(diff>0?'higher (comparison)':'lower (comparison)'),outcome=t(source.outcome),values={option:first.label,context:shown.context??'',outcome,direction,minutes:Math.abs(diff).toFixed(1)}
  const titles={
    time:'{option} starts are associated with {direction} reported {outcome}.',
    sleep:'Days with {option} of sleep show {direction} reported {outcome}.',
    conditions:source.outcome==='length'?'{context}: {option} is associated with {minutes} minutes {direction} focused sessions.':'{context}: {option} goes with {direction} reported {outcome}.',
    length:'For {context}, {option} focused sessions show {direction} reported {outcome}.',
    rest:'After {option} of recorded rest, reported {outcome} is {direction}.',
    trend:p.weekly?'Reported {outcome} is {direction} in comparable sessions this week.':'Your reported {outcome} was {direction} in the latest four weeks.'
  }
  shown.title=t(titles[source.family as keyof typeof titles],{...values,direction:source.outcome==='length'?t(diff>0?'longer (duration)':'shorter (duration)'):direction})
  shown.explanation=t('{difference} {unit} {direction} in comparable recorded study. This is an association, not an optimum or proof of cause.',{difference:Math.abs(diff).toFixed(2),unit:t(source.outcome==='length'?'focused minutes':'rating steps'),direction})
  shown.calculation=[t('Balanced mean {first} − {other} = {difference} {unit}.',{first:first.value.toFixed(2),other:other.value.toFixed(2),difference:diff.toFixed(2),unit:t(source.outcome==='length'?'focused minutes':'rating steps')}),t('Shared subject/activity cohorts need two observations per side and have weight equal to the smaller group.'),p.daily?t('Repeated sessions are averaged within day/cohort; evidence gates use distinct days.'):'',t('20% trimmed cohort difference: {difference}.',{difference:(p.trimmedDifference??diff).toFixed(2)}),t(source.replicated?'Direction repeated in earlier and later chronological halves.':'Independent temporal replication is insufficient.')].filter(Boolean).join(' ')
  shown.limitations=[t('Only single-subject sessions with confirmed activity and eligible {measurement} and factor answers.',{measurement:t(source.outcome==='length'?'recorded focus durations':'recorded ratings')}),t(p.includeUntouched?'Untouched default ratings included by your option.':'Unanswered/untouched ratings excluded.'),t('Matching controls recorded subject/activity composition; unrecorded activities, other conditions, time and logging changes may still differ.'),source.outcome==='length'?t('Timer mode and chosen target are also matched; longer is not necessarily better.'):'',source.family==='rest'?t('The preceding focused-length range is also matched.'):'',t(source.outcome==='length'?'Focused duration is recorded time, not a learning outcome.':'These are self-ratings, not objective mastery.'),p.withinSubject?t('Subject centering cancels within each matched cohort; your within-subject option remains compatible.'):''].filter(Boolean).join(' ')
  if(source.action&&p.target)shown.action=t(FOCUS_COMPARISON_ACTION,{option:label(p.target)})
  if(source.sharedEvidence){const e=evidenceCopy(source.sharedEvidence,language);shown.evidence='Preliminary pattern';shown.explanation=e.summary;shown.calculation=[e.coverage,e.method,e.uncertainty,t('Automatic searches use the same correction across factors, saved views, insights and reports.')].join(' ');shown.limitations=e.limitations}
  if(p.methodComparison)shown.limitations=t(METHOD_OBSERVATION_NOTE)+' '+shown.limitations
  return shown
}

export function displayPreparationSuggestion(source:PreparationSuggestion,schema:LogSchema,language:AppLanguage):PreparationSuggestion {
  const p=source.presentation
  if(language==='en'||!p)return source
  const factor={key:p.factorKey,label:p.context,group:'setup' as const,options:[],multi:false}
  return {...source,label:factorCopy(language,schema,factor)+': '+factorCopy(language,schema,factor,p.option),explanation:translate(language,p.activity?'Higher reported {outcome} in {first} comparable sessions versus {other} others for this subject and activity, with the pattern repeated over time. An association, not proof of cause.':'Higher reported {outcome} in {first} comparable sessions versus {other} others for this subject, with the pattern repeated over time. An association, not proof of cause.',{outcome:translate(language,p.outcome),first:p.n,other:p.nOther})}
}

/** Historical evidence keeps its original wording in storage. Summarize its
 * structured fields in the current language without guessing at private text. */
export function displayOrigin(source:InsightOrigin,schema:LogSchema,language:AppLanguage):InsightOrigin {
  const field=schema.fields.find(f=>'field:'+f.id===source.factorKey)
  const factor={key:source.factorKey,label:field?.label??translate(language,'Recorded condition'),group:'setup' as const,options:[],multi:false}
  const option=factorCopy(language,schema,factor,source.option),comparison=source.comparison
  return {...source,option,title:translate(language,'Recorded comparison: {condition} — {option}',{condition:factorCopy(language,schema,factor),option}),evidence:translate(language,source.evidence),calculation:comparison?translate(language,'Balanced shared-subject/activity comparison: {first} vs {other} {unit}. Independent replication is not established.',{first:comparison.n,other:comparison.nOther,unit:translate(language,comparison.unit)}):translate(language,'Saved comparison. Open its original view to inspect the supporting records.'),limitations:translate(language,'Observational self-ratings, not proof of cause. A before/after trial can still be confounded.')}
}
