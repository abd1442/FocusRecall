import { evidenceCopy } from '@core/evidenceCopy'
import { isStudyMethodFactor } from '@core/recommendations'
import { factorName, factorOption } from '../../statsCopy'
import { displayInsight } from '../../statsCopy'
import { useLogSchema } from '../../store/logSchema'
import { t as uiText, currentLanguage , formatDate , countEvidence } from '../../i18n'
// Building blocks shared by the Stats sections: the section frame, bars with
// their sample size, strength badges and number formats.
import { createContext, useContext } from 'react'
import { useUi } from '../../store/ui'
import { InsightContext } from './InsightContext'
import { MIN_SESSIONS, STRENGTH_LABEL, STRENGTH_RULE, type Comparison, type GroupRow, type Strength } from '@core/insights'
import { outcomeDef, OUTCOMES, type OutcomeKey } from '@core/statsData'
import { StatsSectionExplainer } from '../../components/StatsReadingGuide'

export const StatsEmptyContext=createContext<{empty:boolean;onFilters:()=>void}|null>(null)

/** A full-width colour band; the analysis caveat lives once at the top of Stats. */
export function StatsSection({
  id,
  title,
  lead,
  action,
  children
}: {
  id: string
  title: string
  lead: string
  /** Accepted by existing callers; the note is now shared at the top of Stats. */
  note?: boolean
  action?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const original = useContext(InsightContext),schema=useLogSchema(s=>s.schema)
  const scope=useContext(StatsEmptyContext)
  const insight=original?displayInsight(original,schema,currentLanguage()):null
  if(scope?.empty&&id!=='report')return <section id={`stats-${id}`} data-stats-section={id} className="stats-section"><h2 className="text-2xl font-semibold">{uiText(title)}</h2><div className="stats-empty-scope"><span aria-hidden="true">◷</span><h3>{uiText('No sessions in this range.')}</h3><p>{uiText('Choose another date range or subject, or start a study session.')}</p><div><button type="button" onClick={scope.onFilters}>{uiText('Adjust filters')}</button><button type="button" onClick={()=>useUi.getState().setTab('home')}>{uiText('Start studying')}</button></div></div></section>
  return (
    <section id={`stats-${id}`} data-stats-section={id} className="stats-section flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight" title={uiText(lead)}>{uiText(title)}</h2>
        </div>
        {action}
      </header>
      {insight?.section === id && <aside className="rounded-2xl border border-focus/40 bg-surface p-5" aria-label={uiText("Original matched finding")}><h3 className="font-semibold">{insight.title}</h3><p className="mt-2 text-sm text-muted">{formatDate(insight.range.from)}{uiText(" to ")}{formatDate(insight.range.to)} · {countEvidence(insight.n,insight.unit)}{uiText(" vs ")}{countEvidence(insight.nOther,insight.unit)}</p><details className="mt-3 text-sm"><summary className="cursor-pointer text-focus">{uiText("Original finding & chart methods")}</summary><p className="mt-3">{insight.calculation}</p><p className="mt-2 text-muted">{insight.limitations}</p><p className="mt-2 text-muted">{uiText("Matched comparisons use the same context-day method. Other charts show descriptive activity summaries; different questions or filters can give different values.")}</p></details></aside>}
      <StatsSectionExplainer id={id}/>
      {['factors','setup','time','methods','rest'].includes(id) && <p className="text-sm text-muted">{uiText("Matched comparisons share one context-day method. Activity charts are descriptive summaries. Associations do not establish cause.")}</p>}
      {children}
    </section>
  )
}

/** A card inside a section. */
export function Panel({ title, hint, children, className = '' }: { title?: string; hint?: string; children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <div className={`stats-panel flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-6 ${className}`}>
      {title && (
        <div>
          <h3 className="text-lg font-semibold">{uiText(title)}</h3>
          {hint && <p className="mt-0.5 text-sm text-muted">{uiText(hint)}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

const STRENGTH_STYLE: Record<Strength, string> = {
  none: 'text-muted border-line',
  early: 'text-muted border-line border-dashed',
  likely: 'text-ink border-focus/40',
  consistent: 'text-focus border-focus/40 bg-focus/12 font-medium'
}

export function StrengthBadge({ strength }: { strength: Strength }): React.JSX.Element {
  const filled = { none: 0, early: 1, likely: 2, consistent: 3 }[strength]
  return (
    <span tabIndex={0} aria-label={uiText(STRENGTH_LABEL[strength])} title={`${uiText(STRENGTH_LABEL[strength])}. ${uiText(STRENGTH_RULE)}`} className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-2 text-sm whitespace-nowrap ${STRENGTH_STYLE[strength]}`}>
      {[0, 1, 2].map((i) => <span key={i} aria-hidden="true" className={`size-2 rounded-full border border-current ${i < filled ? 'bg-current' : 'opacity-30'}`} />)}
    </span>
  )
}

/** A value of an outcome for display: "3.4 of 5", "1.2 per hour", "12 %", "34 min". */
export function formatOutcome(k: OutcomeKey, v: number): string {
  if (!Number.isFinite(v)) return '–'
  switch (k) {
    case 'focus':
    case 'recall':
      return uiText('{value} of {maximum}', {value:v.toFixed(1),maximum:5})
    case 'understanding':
      return uiText('{value} of {maximum}', {value:v.toFixed(1),maximum:4})
    case 'distractionsPerHour':
      return uiText('{value} per hour', {value:v.toFixed(1)})
    case 'lostShare':
      return `${v.toFixed(0)} %`
    case 'longestStretch':
    case 'length':
      return uiText('{value} min', {value:Math.round(v)})
    case 'progressRate':
      return uiText('{value} % of prior pace', {value:Math.round(v)})
  }
}

/** The scale an outcome is drawn on (bars start at its lowest value). */
export function outcomeRange(k: OutcomeKey, rows: { mean: number }[]): [number, number] {
  if (k === 'focus' || k === 'recall') return [1, 5]
  if (k === 'understanding') return [1, 4]
  const max = Math.max(1, ...rows.map((r) => r.mean).filter(Number.isFinite))
  return [0, max * 1.1]
}

/**
 * Groups as horizontal bars: label, bar of the average, the average in words,
 * and the number of sessions. Groups under 5 sessions are greyed and say so.
 */
export function GroupBars({
  rows,
  outcome,
  labelOf = (k) => uiText(k),
  colorOf,
  format
}: {
  rows: GroupRow[]
  outcome: OutcomeKey
  labelOf?: (key: string) => string
  colorOf?: (key: string) => string | undefined
  format?: (v: number) => string
}): React.JSX.Element {
  const shown = rows.filter((r) => r.n > 0)
  if (!shown.length) return <p className="text-base text-muted">{uiText("No sessions here yet.")}</p>
  const [lo, hi] = outcomeRange(outcome, shown)
  const fmt = format ?? ((v: number) => formatOutcome(outcome, v))
  return (
    <div className="flex flex-col gap-2.5">
      {shown.map((r) => {
        const enough = r.nOutcome >= MIN_SESSIONS
        const w = enough && Number.isFinite(r.mean) ? Math.max(2, ((r.mean - lo) / (hi - lo)) * 100) : 0
        return (
          <div key={r.key} className="grid grid-cols-[minmax(5rem,10rem)_minmax(5rem,1fr)_auto] items-center gap-4">
            <span dir="auto" className="text-base leading-snug">
              {labelOf(r.key)}
            </span>
            <div className="h-3 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${w}%`, background: colorOf?.(r.key) ?? 'var(--tf-focus)' }} />
            </div>
            <span className="flex items-baseline justify-end gap-2 text-right whitespace-nowrap tabular-nums">
              {enough ? <span className="text-base font-medium">{fmt(r.mean)}</span> : <span className="text-sm text-muted">{uiText("fewer than 5")}</span>}
              <span className="text-sm text-muted">{r.nOutcome}{uiText(" sess.")}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * One comparison as a row: the question small above its answer, the
 * difference in words with the sample sizes under it, and the strength.
 */
export function ComparisonRow({ c, showFactor = true }: { c: Comparison; showFactor?: boolean }): React.JSX.Element {
  const hi = outcomeRange(c.outcome, [{ mean: c.mean }, { mean: c.meanRest }])[1]
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface-2/30 p-4">
      <div className="flex items-start justify-between gap-3"><div dir="auto">
        {showFactor && <p className="text-sm text-muted">{factorName(c.factor)}</p>}
        <h4 className="text-xl font-semibold">{factorOption(c.factor,c.option)} · {uiText(outcomeDef(c.outcome).label)}</h4>
      </div>{c.strength && !isStudyMethodFactor(c.factor) && <StrengthBadge strength={c.strength} />}</div>
      {[{ label: c.option, value: c.mean }, { label: 'Other answers', value: c.meanRest }].map((row, i) => <div key={i} className="grid grid-cols-[minmax(5rem,1fr)_2fr_auto] items-center gap-3 text-sm">
        <span className="break-words">{i===0?factorOption(c.factor,row.label):uiText(row.label)}</span><span className="h-3 rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, row.value / hi * 100))}%`, background: i === 0 ? 'var(--tf-focus)' : 'var(--tf-muted)' }} /></span><span className="tabular-nums">{formatOutcome(c.outcome, row.value)}</span>
      </div>)}
      <details className="text-sm text-muted"><summary className="cursor-pointer">{uiText("Evidence · ")}{countEvidence(c.n,c.countUnit??'sessions')}{uiText(" vs ")}{countEvidence(c.nRest,c.countUnit??'sessions')}</summary>{c.evidence&&Object.entries(evidenceCopy(c.evidence,currentLanguage())).filter(([key])=>key!=='summary').map(([key,text])=><p key={key} className="mt-2">{text}</p>)}{c.evidence?.measurementType==='self-report'&&<p className="mt-2">{uiText("Rating distribution by context-day mean")} · {c.evidence.groups.map((g,i)=><span key={i} className="block" dir="auto">{i===0?factorOption(c.factor,c.option):uiText('Other answers')}: {g.distribution.map(r=>new Intl.NumberFormat(currentLanguage(),{maximumFractionDigits:1}).format(r.value)+' ('+r.days+')').join(', ')}</span>)}</p>}</details>
    </div>
  )
}

/** Choose the outcome the comparisons look at. */
export function OutcomePicker({ value, onChange, only, selfRatings=false }: { value: OutcomeKey; onChange: (k: OutcomeKey) => void; only?: OutcomeKey[]; selfRatings?:boolean }): React.JSX.Element {
  return (
    <label className="flex items-center gap-3 text-base">
      <span className="text-muted">{uiText("Looking at")}</span>
      <select
        className="min-h-11 rounded-lg border border-line bg-surface-2/60 px-3 text-base text-ink outline-none focus:border-focus"
        value={value}
        onChange={(e) => onChange(e.target.value as OutcomeKey)}
      >
        {OUTCOMES.filter((o) => !only || only.includes(o.key) || o.key === value).map((o) => (
          <option key={o.key} value={o.key}>
            {uiText(selfRatings?(o.key==='recall'?'Immediate self-rated recall':o.key==='understanding'?'Self-rated understanding':o.key==='focus'?'Self-rated focus':o.label):o.label)}
          </option>
        ))}
      </select>
    </label>
  )
}

/** A big number with its label. */
export function Kpi({ value, label, sub }: { value: string; label: string; sub?: string }): React.JSX.Element {
  return (
    <div className="stats-kpi flex flex-col gap-1 rounded-2xl border border-line bg-surface px-5 py-4">
      <span dir="ltr" className="text-3xl font-semibold tracking-tight tabular-nums whitespace-nowrap">{value}</span>
      <span className="text-base text-muted">{uiText(label)}</span>
      {sub && <span className="text-sm text-muted">{uiText(sub)}</span>}
    </div>
  )
}

export const better = (k: OutcomeKey): string => (outcomeDef(k).higherIsBetter ? 'higher' : 'lower')

/** Recharts tooltip styling in the app's colours. */
export const TOOLTIP = {
  cursor: { fill: 'var(--tf-surface-2)' },
  contentStyle: { background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 10, color: 'var(--tf-text)' },
  labelStyle: { color: 'var(--tf-text)' }
}
export const AXIS = { tick: { fill: 'var(--tf-muted)', fontSize: 13 }, axisLine: false, tickLine: false } as const
