import { canSuggestFocusComparison, isStudyMethodFactor, METHOD_OBSERVATION_NOTE } from './recommendations'
import { discoveryQuestions } from './evidence'
import { subjectRevisits } from './statsEvidenceSummary'
import { evidenceCopy } from './evidenceCopy'
// Descriptive report presentation. Analytical functions remain language-independent.
import { generatePersonalInsights, type PersonalInsight } from './personalInsights'
import { localizedDuration } from './localizedDuration'
import { localizedDate } from './localizedDate'
import { localizedCount } from './localizedCount'
import { translate, type AppLanguage } from './localization'
import { factorCopy } from './localizedStats'
import type { LogSchema } from './logfields'
import { displayInsight } from './insightLocalization'
import { diffText, compareFactor, screenComparison, STRENGTH_LABEL, type AnalysisOptions, type Comparison } from './insights'
import { outcomeDef, type FactorDef, type OutcomeKey, type StatSession } from './statsData'
import { overview } from './statsSections'

export interface ReportInput {
  language?:AppLanguage
  schema?:LogSchema
  personalInsights?:PersonalInsight[]
  title:string; periodLabel:string; previousLabel:string
  sessions:StatSession[]; previous:StatSession[]; factors:FactorDef[]
  options:AnalysisOptions; itemName:(id:number)=>string
}
const n1=(x:number):string=>Number.isFinite(x)?x.toFixed(1):'–'
const pct=(x:number):string=>Math.round(x*100)+' %'
// Escape user-authored names before combining them with Markdown formatting.
const reportName=(s:string):string=>s.replace(/[\r\n]+/g,' ').replace(/[\\\x60*_[\]<>]/g,'\\$&')

/** Stable question order shared by visual and written reports, not effect-size ranking. */
export function reportComparisons(sessions:StatSession[],factors:FactorDef[],options:AnalysisOptions):Comparison[] {
  const questions=discoveryQuestions(factors,sessions)
  return (['focus','recall','distractionsPerHour'] as OutcomeKey[]).flatMap(k=>[...factors].sort((a,b)=>a.key.localeCompare(b.key)).flatMap(f=>compareFactor(sessions,f,k,options))).map(c=>screenComparison(c,questions)).filter(c=>c.strength!==null).slice(0,6)
}

export function buildReport(r:ReportInput):string {
  const language=r.language??'en',t=(key:string,values?:Record<string,string|number>):string=>translate(language,key,values)
  const duration=(seconds:number):string=>localizedDuration(seconds,language)
  const change=(now:number,before:number):string=>{
    if(!Number.isFinite(now)||!Number.isFinite(before))return ''
    const d=now-before
    return Math.abs(d)<.05?t(' (no change)'):t(' ({difference} compared with the period before)',{difference:(d>0?'+':'−')+Math.abs(d).toFixed(1)})
  }
  const now=overview(r.sessions,r.options),before=overview(r.previous,r.options),out:string[]=[]
  const heading=(key:string):void=>{out.push('## '+t(key),'')}
  const bullet=(key:string,values?:Record<string,string|number>):void=>{out.push('- '+t(key,values))}
  out.push('# '+reportName(r.title),'','*'+reportName(r.periodLabel)+'*','')
  heading('What was measured')
  if(!r.sessions.length){out.push(t('No sessions in this period.'),'');return out.join('\n')}
  const subjects=new Set(r.sessions.flatMap(s=>s.itemIds))
  out.push(t('Sessions: {sessions}; study days: {days}; focus: {duration}; subjects: {subjects}.',{sessions:now.sessions,days:now.activeDays,duration:duration(now.focusSeconds),subjects:subjects.size})+' '+t('After each session: focus, understanding, difficulty and recall (rated by me), the study setup, and distractions (pressed, detected or idle).'),'')
  heading('Main findings')
  bullet('Focused time: {duration}{comparison}.',{duration:duration(now.focusSeconds),comparison:r.previous.length?t(' (the period before: {duration})',{duration:duration(before.focusSeconds)}):''})
  bullet('Average session: {duration}.',{duration:duration(now.averageSessionSeconds)})
  bullet('Average focus: {rating} of 5{comparison}.',{rating:n1(now.averageFocus),comparison:r.previous.length?change(now.averageFocus,before.averageFocus):''})
  if(Number.isFinite(now.averageRecall))bullet('Average recall: {rating} of 5{comparison}.',{rating:n1(now.averageRecall),comparison:r.previous.length?change(now.averageRecall,before.averageRecall):''})
  bullet('Distractions: {rate} per focused hour{comparison}; {share} of sessions were Clean.',{rate:n1(now.distractionsPerHour),comparison:r.previous.length?change(now.distractionsPerHour,before.distractionsPerHour):'',share:pct(now.cleanShare)})
  if(now.goals.set)bullet('Sessions with a goal: {set}; done {done}, partly {partly}, not done {notDone}.',{set:now.goals.set,done:now.goals.done,partly:now.goals.partly,notDone:now.goals.notDone})
  out.push('');heading('Recorded comparisons')
  const strong=reportComparisons(r.sessions,r.factors,r.options)
  if(strong.length)for(const c of strong.slice(0,6)){bullet('**{factor}: {option}** — {outcome}: {firstMean} vs {otherMean} (difference {difference}; {first} vs {other} {unit}; {evidence}).',{factor:reportName(factorCopy(language,r.schema??{groups:[],fields:[]},c.factor)),option:reportName(factorCopy(language,r.schema??{groups:[],fields:[]},c.factor,c.option)),firstMean:n1(c.mean),otherMean:n1(c.meanRest),outcome:t(outcomeDef(c.outcome).label),difference:diffText(c).replace(/(steps|per hour|points|min)$/,unit=>t(unit==='steps'?'rating steps':unit)),first:c.n,other:c.nRest,unit:t(c.countUnit??'sessions'),evidence:t(STRENGTH_LABEL[c.strength!])});if(c.evidence){const e=evidenceCopy(c.evidence,language);out.push(e.coverage,e.method,e.uncertainty,e.limitations,'')}}
  else out.push(t('No comparable groups with enough study days in this period.'))
  if(strong.some(c=>isStudyMethodFactor(c.factor)))out.push(t(METHOD_OBSERVATION_NOTE),'')
  out.push('');heading('What changed since the period before');out.push(t('Period totals and averages are unadjusted summaries; changing subjects, activities or recording can explain differences.'))
  if(!r.previous.length)out.push(t('No sessions in {period} to compare with.',{period:reportName(r.previousLabel)}))
  else {bullet('Sessions: {now} (before: {before}).',{now:now.sessions,before:before.sessions});bullet('Active days: {now} (before: {before}).',{now:now.activeDays,before:before.activeDays});bullet('Clean sessions: {now} (before: {before}).',{now:pct(now.cleanShare),before:pct(before.cleanShare)})}
  out.push('');heading('Returning to subjects')
  for(const visit of subjectRevisits(r.sessions)){out.push('**'+reportName(r.itemName(visit.itemId))+'**');bullet('Study days: {days}; last recorded visit {date}; {share}% of recorded time on the busiest day.',{days:visit.days,date:localizedDate(visit.last,language),share:Math.round(visit.largestDayShare*100)});if(visit.medianGap!==null)bullet('Median gap: {median}; range: {min} to {max}.',{median:localizedCount(visit.medianGap,'day',language),min:localizedCount(visit.minGap!,'day',language),max:localizedCount(visit.maxGap!,'day',language)})}
  out.push(t('Subject visits do not prove spaced retrieval of the same material.'))
  out.push('');heading('Limits of the data')
  bullet('These are patterns in my own sessions, not proof of cause. Things that go together (a place and a subject, a time and my energy) can explain each other.')
  bullet('Focus, understanding, difficulty and recall are my own ratings.')
  if(!r.options.includeUntouched)bullet('Sliders left at their default were not counted.')
  if(r.options.withinSubject)bullet('Sessions are averaged within each subject, activity and study day. Shared contexts are weighted by their smaller number of days.')
  bullet('Matched comparisons share one context-day method. Activity charts are descriptive summaries. Associations do not establish cause.')
  out.push('');heading('Optional focus comparisons')
  const today=[...r.sessions.map(s=>s.day)].sort().at(-1)??''
  const suggestions=(r.personalInsights??generatePersonalInsights(r.sessions,r.factors,r.options,{today,all:r.sessions}).cards).map(c=>displayInsight(c,r.schema??{groups:[],fields:[]},language)).filter(c=>c.action&&c.trial&&c.sharedEvidence?.status==='exploratory'&&r.factors.some(f=>f.key===c.factorKey&&canSuggestFocusComparison(f,c.outcome??''))).slice(0,3)
  if(suggestions.length)for(const c of suggestions)bullet('{action} Original finding: {finding} ({from} to {to}). Choose a subject/activity present in the supporting records. Association, not proof of benefit.',{action:reportName(c.action!),finding:reportName(c.title),from:localizedDate(c.range.from,language),to:localizedDate(c.range.to,language)})
  else bullet('No optional focus comparison in this period. You can plan your own.')
  out.push('');return out.join('\n')
}

const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s: string): string =>
  escape(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')

/** Enough Markdown for the report: headings, paragraphs, bullet lists, bold and italic. */
export function markdownToHtml(md: string): string {
  const html: string[] = []
  let list = false
  let para: string[] = []
  const flush = (): void => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  for (const raw of md.split('\n')) {
    const lineText = raw.trimEnd()
    const h = /^(#{1,3})\s+(.*)$/.exec(lineText)
    const li = /^-\s+(.*)$/.exec(lineText)
    if (!li && list) {
      html.push('</ul>')
      list = false
    }
    if (h) {
      flush()
      html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
    } else if (li) {
      flush()
      if (!list) {
        html.push('<ul>')
        list = true
      }
      html.push(`<li>${inline(li[1])}</li>`)
    } else if (!lineText.trim()) flush()
    else para.push(lineText.trim())
  }
  flush()
  if (list) html.push('</ul>')
  return html.join('\n')
}
