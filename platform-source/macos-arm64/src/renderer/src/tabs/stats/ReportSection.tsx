import { isStudyMethodFactor, METHOD_OBSERVATION_NOTE } from '@core/recommendations'
import { subjectRevisits } from '@core/statsEvidenceSummary'
import { displayInsight } from '../../statsCopy'
import { useLogSchema } from '../../store/logSchema'
import { formatDuration , formatDate , count ,  } from '../../i18n'
import { t as uiText , currentLanguage, useLanguage } from '../../i18n'
import { monthComparison } from '@core/studyDay'
import { useMemo, useRef, useState } from 'react'
import { buildReport, markdownToHtml, reportComparisons } from '@core/report'
import type { FactorDef, StatSession } from '@core/statsData'
import type { AnalysisOptions } from '@core/insights'
import { overview } from '@core/statsSections'

import { MiniBars } from './StudyRhythm'
import { reportSnapshot } from './reportSnapshot'
import { Button } from '../../components/ui'
import { ComparisonRow, Kpi, Panel, StatsSection } from './parts'
import { useToday } from '../Home'
import { useSettings } from '../../store/session'
import { generatePersonalInsights,personalInsightsMarkdown } from '@core/personalInsights'
import { InsightCards } from './PersonalOverview'

const monthLabel = (m: string): string => formatDate(new Date(m + '-15T12:00:00'), { month: 'long', year: 'numeric' })
const prevMonth = (m: string): string => {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** The page the PDF is printed from: the report in a calm, printable layout. */
function printable(title: string, body: string): string {
  const safeTitle = title.replace(/[&<>"']/g, value => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[value]!)
  return `<!doctype html><html lang="${currentLanguage()}" dir="${currentLanguage() === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${safeTitle}</title><style>
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #1c1d21; line-height: 1.55; font-size: 11pt; max-width: 42rem; margin: 0 auto; }
    h1 { font-size: 20pt; font-weight: 600; margin: 0 0 0.2rem; }
    h1 + p em { color: #5e6169; font-style: normal; }
    h2 { font-size: 13pt; font-weight: 600; margin: 1.6rem 0 0.4rem; padding-bottom: 0.2rem; border-bottom: 1px solid #e3e1db; }
    ul { padding-inline-start: 1.2rem; margin: 0.3rem 0; }
    li { margin: 0.25rem 0; }
    strong { font-weight: 600; }
  </style></head><body>${body}</body></html>`
}

/**
 * A written report for a month (the most recent month with sessions by
 * default), structured like a short paper, exported as Markdown or PDF.
 */
export function ReportSection({
  all,
  factors,
  options,
  itemName,
  sleepHours,
  sleepFieldKey,
  activityLabel,
  reasonLabel
}: {
  /** Sessions with the subject, category and activity filters, but any date. */
  all: StatSession[]
  factors: FactorDef[]
  options: AnalysisOptions
  itemName: (id: number) => string
  sleepHours?:Map<string,{value:number;touched:boolean}>
  sleepFieldKey?:string
  activityLabel?:(id:string)=>string
  reasonLabel?:(id:string)=>string
}): React.JSX.Element {
  const language = useLanguage()
  const weekStartsOn=useSettings(s=>s.settings.weekStartsOn)
  const schema = useLogSchema(s=>s.schema)
  const months = useMemo(() => [...new Set(all.map((s) => s.day.slice(0, 7)))].sort().reverse(), [all])
  const [month, setMonth] = useState<string | null>(null)
  // By default the last complete month (this month is still running), else the latest one.
  const today=useToday(),thisMonth = today.slice(0, 7)
  const chosen = (month && months.includes(month) ? month : null) ?? (months[0] === thisMonth && months[1] ? months[1] : months[0]) ?? null
  const reportRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const sessions=useMemo(()=>chosen?all.filter(s=>s.day.startsWith(chosen)&&s.day<=today):[],[all,chosen,today])
  const personal=useMemo(()=>generatePersonalInsights(sessions,factors,options,{today:chosen?monthComparison(chosen,today).through:'',all,sleepHours,sleepFieldKey,activityLabel,reasonLabel}),[sessions,factors,options,chosen,today,all,sleepHours,sleepFieldKey,activityLabel,reasonLabel])
  const md = useMemo(() => {
    if (!chosen) return ''
    const prev = prevMonth(chosen),period=monthComparison(chosen,today)
    return buildReport({
      language,schema,
      title: uiText('Study report: {month}',{month:monthLabel(chosen)}),
      periodLabel: uiText('{from} to {to}, compared with {previousFrom} to {previousTo}{status}',{from:formatDate(period.from),to:formatDate(period.through),previousFrom:formatDate(period.previousFrom),previousTo:formatDate(period.previousThrough),status:chosen===thisMonth?uiText(' (today still in progress)'):''}),
      previousLabel: monthLabel(prev),
      sessions,
      personalInsights:personal.cards,
      previous: all.filter((s) => s.day>=period.previousFrom&&s.day<=period.previousThrough),
      factors,
      options,
      itemName
    })+personalInsightsMarkdown(personal.cards.map(c=>displayInsight(c,schema,language)),language)
  }, [chosen, today,thisMonth,sessions,all, factors, options, itemName,personal,language,schema])
  const html = useMemo(() => markdownToHtml(md), [md])
  const fileName = chosen ? `FocusRecall report ${chosen}` : 'FocusRecall report'

  const exportAs = async (kind: 'md' | 'pdf' | 'png'): Promise<void> => {
    setSaved(null)
    setError(null)
    setExporting(true)
    try {
      const snapshot = kind === 'png' && reportRef.current ? reportSnapshot(reportRef.current) : null
      const path =
        kind === 'png' && snapshot
          ? await window.api.invoke('stats:exportPng', snapshot.html, fileName + '.png', snapshot.width)
          : kind === 'md'
          ? await window.api.invoke('stats:exportMarkdown', md, `${fileName}.md`)
          : await window.api.invoke('stats:exportPdf', printable(fileName, html), `${fileName}.pdf`)
      if (path) setSaved(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setExporting(false) }
  }

  const comparison=chosen?monthComparison(chosen,today):null
  const previous = comparison ? all.filter(s=>s.day>=comparison.previousFrom&&s.day<=comparison.previousThrough) : []
  const now = overview(sessions, options), before = overview(previous, options)
  const findings=useMemo(()=>reportComparisons(sessions,factors,options),[sessions,factors,options])
  const revisits=useMemo(()=>subjectRevisits(sessions),[sessions])
  const monthDays = chosen ? new Date(Number(chosen.slice(0, 4)), Number(chosen.slice(5)), 0).getDate() : 0
  const times = new Map<string, number>()
  sessions.forEach((s) => times.set(s.day, (times.get(s.day) ?? 0) + s.focusSeconds))
  const maxTime = Math.max(1, ...times.values())
  const offset=chosen?(new Date(chosen+'-01T12:00:00').getDay()-weekStartsOn+7)%7:0
  const weekdays=Array.from({length:7},(_,i)=>formatDate(new Date(2026,0,4+(weekStartsOn+i)%7), {weekday:'short'}))
  return (
    <StatsSection id="report" title={uiText("Your monthly study story")} lead="Recorded comparisons, approximate uncertainty and limits of the data." note={false}
      action={months.length > 0 && <div className="flex flex-wrap items-center gap-3">
        <select aria-label={uiText("Report month")} className="min-h-11 rounded-lg border border-line bg-surface px-3" value={chosen ?? ''} onChange={(e) => { setMonth(e.target.value); setSaved(null); setError(null) }}>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
        <Button variant="primary" disabled={exporting} onClick={() => void exportAs('png')}>{exporting ? uiText("Exporting…") : uiText("Export image (PNG)")}</Button>
        <Button disabled={exporting} onClick={() => void exportAs('md')}>{uiText("Markdown")}</Button>
        <details className="text-sm text-muted"><summary className="cursor-pointer">{uiText("Other formats")}</summary><Button disabled={exporting} onClick={() => void exportAs('pdf')}>{uiText("Export PDF")}</Button></details>
      </div>}>
      {saved && <p role="status" className="text-base text-rest">{uiText("Saved to ")}{saved}</p>}{error && <p role="alert" className="text-status-error">{error}</p>}
      {chosen ? <div ref={reportRef} data-report="visual" className="flex flex-col gap-6 rounded-2xl bg-bg p-6">
        <header><p className="text-base font-semibold text-focus">{uiText("FocusRecall / personal study report")}</p><h3 className="mt-2 text-3xl font-semibold">{monthLabel(chosen)}</h3><p className="mt-2 text-sm text-muted">{count(new Set(sessions.flatMap(s=>s.itemIds)).size, 'subject')} · {uiText("Recorded comparisons")} · {options.includeUntouched ? uiText("Untouched ratings included") : uiText("Untouched ratings excluded")}</p></header>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4"><Kpi value={formatDuration(now.focusSeconds)} label={uiText("Focused time")} /><Kpi value={String(now.sessions)} label={uiText("Sessions")} /><Kpi value={String(now.activeDays)} label={uiText("Days studied")} /><Kpi value={Math.round(now.cleanShare * 100) + '%'} label={uiText("Clean sessions")} /></div>
        <Panel title={uiText("Personal study insights")}><InsightCards cards={personal.cards}/>{!personal.cards.length&&<p className="text-muted">{uiText("No reliable personal comparison in this month.")}</p>}<p className="mt-3 text-xs text-muted">{personal.examined}{uiText(" comparisons examined. Approximate uncertainty and search correction do not establish cause.")}</p></Panel>
        <details className="report-more"><summary>{uiText("Descriptive comparisons")}</summary><Panel>{findings.some(c=>isStudyMethodFactor(c.factor))&&<p className="text-sm text-muted">{uiText(METHOD_OBSERVATION_NOTE)}</p>}{findings.length ? findings.map((c) => <ComparisonRow key={c.factor.key + c.option} c={c} />) : <p className="text-muted">{uiText("No comparison has enough evidence yet. Keep logging sessions to build your report.")}</p>}</Panel></details>
        <div className="grid gap-4 xl:grid-cols-2"><Panel title={previous.length ? uiText("How this month compares") : uiText("Your first month in view")}><MiniBars rows={previous.length ? [{ label: monthLabel(prevMonth(chosen)), value: before.focusSeconds / 3600 }, { label: monthLabel(chosen), value: now.focusSeconds / 3600 }] : [{ label: monthLabel(chosen), value: now.focusSeconds / 3600 }]} unit=" h" /><p className="text-sm text-muted">{previous.length ? uiText('Sessions: {beforeSessions} → {sessions}; active days: {beforeDays} → {days}.',{beforeSessions:before.sessions,sessions:now.sessions,beforeDays:before.activeDays,days:now.activeDays})+' '+uiText(chosen===thisMonth?'Same elapsed dates; today is still in progress.':'Complete calendar months can differ in length.') : uiText("No previous-month sessions to compare.")}</p></Panel>
        <Panel title={uiText("Returning to subjects")}><p className="text-sm text-muted">{uiText("Subject visits do not prove spaced retrieval of the same material.")}</p>{revisits.map(r=><div key={r.itemId} className="border-b border-line py-2"><strong dir="auto">{itemName(r.itemId)}</strong><p className="mt-1 text-sm">{uiText("Study days: {days}; last recorded visit {date}; {share}% of recorded time on the busiest day.",{days:r.days,date:formatDate(r.last),share:Math.round(r.largestDayShare*100)})}</p>{r.medianGap!==null&&<p className="text-sm text-muted">{uiText("Median gap: {median}; range: {min} to {max}.",{median:count(r.medianGap,'day'),min:count(r.minGap!,'day'),max:count(r.maxGap!,'day')})}</p>}</div>)}</Panel></div>
        <Panel title={uiText("Your month, one study day at a time")}><div className="report-calendar grid grid-cols-7 gap-2">{weekdays.map((day,i)=><span key={i} className="report-weekday">{day}</span>)}{Array.from({length:offset},(_,i)=><span key={"offset"+i} aria-hidden="true"/>)}{Array.from({ length: monthDays }, (_, i) => { const day = chosen + '-' + String(i + 1).padStart(2, '0'), seconds = times.get(day) ?? 0; return <div key={day} title={day + ': ' + formatDuration(seconds)} className="flex min-h-14 flex-col items-center justify-center rounded-lg border border-line text-sm" style={{ background: seconds ? 'color-mix(in srgb, var(--tf-focus) ' + Math.round(seconds / maxTime * 30 + 5) + '%, var(--tf-surface))' : 'var(--tf-surface)' }}><span>{new Intl.NumberFormat(language).format(i + 1)}</span><span className="text-sm text-muted">{seconds ? Math.round(seconds / 60) + ' '+uiText('min') : '–'}</span></div> })}</div><p className="text-sm text-muted">{uiText("Your study-day boundary is used. Each cell is a date; darker means more focused time.")}</p></Panel>
        <details className="report-more"><summary>{uiText("Optional focus comparisons")}</summary><Panel>{personal.cards.some(c=>c.action&&c.trial)?<ul className="list-disc space-y-3 pl-5">{personal.cards.filter(c=>c.action&&c.trial).slice(0,3).map(c=><li key={c.id}>{displayInsight(c,schema,language).action}</li>)}</ul>:<p className="text-muted">{uiText("No optional focus comparison in this period. You can plan your own.")}</p>}<p className="text-sm text-muted">{uiText("Use a subject and activity from the original finding. Changing one thing does not prove causation.")}</p></Panel></details>
        <footer className="text-sm text-muted">{uiText("Matched comparisons share one context-day method. Activity charts are descriptive summaries. Associations do not establish cause.")}</footer>
      </div> : <Panel><p className="text-muted">{uiText("No sessions yet.")}</p></Panel>}
      <details className="rounded-xl border border-line bg-surface p-4"><summary className="cursor-pointer text-sm text-muted">{uiText("Written report / archive")}</summary><article className="stats-report mx-auto mt-4 max-w-3xl" dangerouslySetInnerHTML={{ __html: html }} /></details>
    </StatsSection>
  )
}
