import { useGridNavigation } from '../../components/useGridNavigation'
import { evidenceCopy } from '@core/evidenceCopy'
import { activityBaseline, subjectRevisits } from '@core/statsEvidenceSummary'
import { factorName, factorOption } from '../../statsCopy'
import { t as uiText, currentLanguage , formatDate , count ,  } from '../../i18n'
import { useContext, useMemo, useState } from 'react'
import { consistency, habitChange, minuteContinuity, progressSpeeds, recallNext, weekWindows } from '@core/studyPatterns'
import type { StatsRaw } from '@core/statsData'
import { StatsContext, useComparisonOutcome } from './sections'
import { Kpi, OutcomePicker, Panel, StatsSection, formatOutcome } from './parts'

/** One simple chart per message. SVGs also survive report/image export. */
export function MiniBars({ rows, max, unit = '' }: { rows: { label: string; value: number; note?: string }[]; max?: number; unit?: string }): React.JSX.Element {
  const hi = max ?? Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length) return <p className="text-muted">{uiText("Not enough recorded answers yet.")}</p>
  return <div className="flex flex-col gap-4">{rows.map((r, i) => <div key={i} className="grid grid-cols-[minmax(6rem,1fr)_2fr_auto] items-center gap-3">
    <span className="min-w-0 break-words text-sm">{r.label}</span><span className="h-5 rounded bg-surface-2"><span className="block h-full rounded bg-stage-focus" style={{ width: `${Math.min(100, Math.max(0, r.value / hi * 100))}%` }} /></span><span title={r.note} className="text-sm tabular-nums">{r.value.toFixed(1)}{uiText(unit)}</span>
  </div>)}</div>
}

export function StudyRhythmSection({ raw, today }: { raw: StatsRaw; today: string }): React.JSX.Element {
  const { sessions, factors, options, itemName, progressOf, weekStartsOn } = useContext(StatsContext)
  const baseline=useMemo(()=>activityBaseline(sessions,today),[sessions,today])
  const revisits=useMemo(()=>subjectRevisits(sessions),[sessions])
  const stats = useMemo(() => consistency(sessions, today), [sessions, today])
  const minutes = useMemo(() => minuteContinuity(sessions), [sessions])
  const windows = useMemo(() => weekWindows(sessions, options), [sessions, options])
  const speeds = useMemo(() => progressSpeeds(raw, new Set(sessions.map((s) => s.id))), [raw, sessions])
  const pairs = useMemo(() => recallNext(sessions, options), [sessions, options])
  const [key, setKey] = useState(factors.find((f) => f.group === 'setup')?.key ?? factors[0]?.key ?? '')
  const factor = factors.find((f) => f.key === key) ?? factors[0]
  const [choice, setChoice] = useState('')
  const chosen = factor?.options.includes(choice) ? choice : factor?.options[0] ?? ''
  const [date, setDate] = useState(sessions[Math.floor(sessions.length / 2)]?.day ?? today)
  const [outcome, setOutcome] = useComparisonOutcome('focus', 'rhythm')
  const change = useMemo(() => habitChange(sessions, factor?.key ?? '', chosen, date, outcome, options), [sessions, factor, chosen, date, outcome, options])
  const names = Array.from({length:7},(_,day)=>formatDate(new Date(2026,0,4+day), {weekday:'short'}))
  const weekdays = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7)
  const gridRows = weekdays.map(d => Array.from({length:24},(_,h)=>`${d}-${h}`))
  const keyboard = useGridNavigation(gridRows, gridRows[0][0])
  const select = 'min-h-11 max-w-full rounded-lg border border-line bg-surface px-3'
  return <StatsSection id="rhythm" title={uiText("Study rhythm")} lead="Consistency, progress speed, and what happens between sessions.">
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4"><Kpi value={`${stats.current} ${uiText(stats.current === 1 ? 'day' : 'days')}`} label={uiText("Current streak")} /><Kpi value={`${stats.longest} ${uiText(stats.longest === 1 ? 'day' : 'days')}`} label={uiText("Longest streak")} /><Kpi value={`${stats.days}`} label={uiText("Days studied in view")} /><Kpi value={`${stats.last28} / 28`} label={uiText("Days studied recently")} sub="Uses only sessions in your filters" /></div>
    <div className="grid gap-4 xl:grid-cols-2"><Panel title={uiText("Recent recorded activity")}><p className="text-sm text-muted">{uiText("Latest 28 days compared with the preceding 56 days, using only records in this view.")}</p>{[baseline.recent,baseline.earlier].map(w=><div key={w.from} className="rounded-xl bg-surface-2/40 p-3"><p className="text-sm" dir="ltr">{formatDate(w.from)} – {formatDate(w.to)}</p><p className="mt-2">{uiText("Recorded hours per calendar week: {hours}; recorded days: {days} of {calendarDays}.",{hours:w.hoursPerCalendarWeek.toFixed(1),days:w.recordedDays,calendarDays:w.calendarDays})}</p></div>)}<p className="text-sm text-muted">{uiText("Unrecorded days may include offline study. More recorded time does not mean more learning.")}</p></Panel><Panel title={uiText("Returning to subjects")}><p className="text-sm text-muted">{uiText("Subject visits do not prove spaced retrieval of the same material.")}</p><div tabIndex={0} aria-label={uiText("Returning to subjects")} className="max-h-80 overflow-auto">{revisits.map(r=><div key={r.itemId} className="border-b border-line pb-3"><strong dir="auto">{itemName(r.itemId)}</strong><p className="mt-1 text-sm">{uiText("Study days: {days}; last recorded visit {date}; {share}% of recorded time on the busiest day.",{days:r.days,date:formatDate(r.last),share:Math.round(r.largestDayShare*100)})}</p>{r.medianGap!==null&&<p className="mt-1 text-sm text-muted">{uiText("Median gap: {median}; range: {min} to {max}.",{median:count(r.medianGap,'day'),min:count(r.minGap!,'day'),max:count(r.maxGap!,'day')})}</p>}</div>)}</div></Panel></div>
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title={uiText("When does uninterrupted study start to dip?")} hint={uiText("Recorded study time by elapsed minute — not a minute-by-minute rating.")}>
        {minutes.some((m) => m.n >= 5) ? <>
          <svg role="img" aria-label={uiText("Average share of each minute without a recorded distraction")} viewBox="0 0 600 200" className="w-full">
            {[0, 50, 100].map((v) => <g key={v}><line x1="45" x2="580" y1={170 - v * 1.4} y2={170 - v * 1.4} stroke="var(--tf-border)" /><text x="4" y={175 - v * 1.4} fill="var(--tf-muted)" fontSize="13">{v}%</text></g>)}
            {minutes.filter((m) => m.n >= 5).map((m) => <circle key={m.minute} cx={45 + (m.minute - 1) / Math.max(1, minutes.length - 1) * 535} cy={170 - m.share * 140} r="3" fill="var(--fr-stage-focus)"><title>{uiText("Minute ")}{m.minute}: {Math.round(m.share * 100)}% · {count(m.n, 'session')}</title></circle>)}
            <text x="45" y="195" fill="var(--tf-muted)" fontSize="13">{uiText("Minute 1")}</text><text x="500" y="195" fill="var(--tf-muted)" fontSize="13">{uiText("Minute ")}{minutes.length}</text>
          </svg><details className="text-sm"><summary className="min-h-11 cursor-pointer">{uiText("Data table")}</summary><table className="w-full text-start"><caption className="sr-only">{uiText("Average share of each minute without a recorded distraction")}</caption><thead><tr><th scope="col">{uiText("Minute")}</th><th scope="col">%</th><th scope="col">{uiText("Sessions")}</th></tr></thead><tbody>{minutes.filter(m=>m.n>=5).map(m=><tr key={m.minute}><th scope="row">{m.minute}</th><td>{Math.round(m.share*100)}%</td><td>{m.n}</td></tr>)}</tbody></table></details><p className="text-sm text-muted">{uiText("At least 5 sessions per point. Partial recorded intervals count proportionally; gaps between parts are excluded. Later points describe only sessions that continued.")}</p>
        </> : <p className="text-muted">{uiText("Log at least 5 sessions to see this curve.")}</p>}
      </Panel>
      <Panel title={uiText("Recorded focus by start time")} hint={uiText("Average focus rating by start hour and weekday. Hover a cell for its sample size.")}>
        <div className="overflow-x-auto">{keyboard.help}<div ref={keyboard.ref} role="grid" aria-label={uiText("Recorded focus by start time")} aria-describedby={keyboard.helpId} className="grid min-w-[32rem] gap-1" style={{ gridTemplateColumns: '3rem repeat(24, minmax(0, 1fr))' }}>
          <div role="row" className="contents"><span role="columnheader" />{Array.from({ length: 24 }, (_, h) => <span role="columnheader" key={h} className="text-center text-sm text-muted">{h % 4 === 0 ? h : ''}</span>)}</div>
          {weekdays.map((d) => <div role="row" key={d} className="contents"><span role="rowheader" className="text-sm text-muted">{names[d]}</span>{windows.filter((w) => w.weekday === d).map((w) => <span key={w.hour} role="gridcell" {...keyboard.cellProps(`${d}-${w.hour}`)} aria-label={uiText("{value0} {value1}:00, {rated}{value3}", {value0: (names[d]), value1: (w.hour), rated: count(w.n,'ratedSession'), value3: (w.mean === null ? uiText(', needs five') : uiText(', average {value} of five',{value:w.mean.toFixed(1)}))})} title={uiText("{value0} {value1}:00 · {rated} · {value3}", {value0: (names[d]), value1: (w.hour), rated: count(w.n,'ratedSession'), value3: (w.mean === null ? uiText('Needs 5') : uiText('{value} of {maximum}',{value:w.mean.toFixed(1),maximum:5}))})} className="h-6 rounded-sm" style={{ background: w.mean === null ? 'var(--tf-surface-2)' : `color-mix(in srgb, var(--tf-focus) ${Math.round(w.mean / 5 * 85)}%, var(--tf-surface))` }} />)}</div>)}
        </div></div><p className="text-sm text-muted">{uiText("Blank cells have fewer than 5 ratings. Darker colour means higher focus; ratings left untouched follow your switch.")}</p>
      </Panel>
    </div>
    <Panel title={uiText("How fast are you moving through each subject?")}>
      {speeds.length ? <div className="flex flex-col divide-y divide-line">{speeds.map((s) => {
        const progress = progressOf(s.itemId), remaining = progress && progress.unit === s.unit ? Math.max(0, progress.total - progress.done) : null
        return <div key={`${s.itemId}:${s.unit}`} className="flex flex-wrap items-center gap-4 py-4"><span className="min-w-0 flex-1 text-lg font-medium" dir="auto">{itemName(s.itemId)}</span><span className="text-xl font-semibold tabular-nums">{s.rate.toFixed(1)} <span className="text-sm font-normal text-muted">{s.unit}{uiText("/hour")}</span></span><span className="text-sm text-muted">{count(s.n, 'session')}</span><span className="text-sm">{s.n < 5 ? uiText("Needs 5 sessions for an estimate") : remaining === null ? uiText("Set a matching total for an estimate") : remaining === 0 ? uiText("Total reached") : s.rate > 0 ? uiText("About {value0} focus hours left", {value0: ((remaining / s.rate).toFixed(1))}) : uiText("No progress rate yet")}</span></div>
      })}</div> : <p className="text-muted">{uiText("Log an amount and unit to see progress speed.")}</p>}
      <p className="text-sm text-muted">{uiText("Estimates use the speed in view and your all-time progress. Each unit is kept separate; future speed can change.")}</p>
    </Panel>
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title={uiText("Reported recall and next-session understanding")} hint={uiText("Previous recall against next-session understanding, on the same main subject.")}>
        <MiniBars max={4} rows={pairs.filter((p) => p.n >= 5).map((p) => ({ label: uiText('Recall {value} / 5',{value:p.recall}), value: p.understanding, note: uiText('{count} consecutive pairs · understanding of 4',{count:p.n}) }))} unit=" / 4" />
        <p className="text-sm text-muted">{uiText("At least 5 consecutive pairs per recall rating. Pairing uses sessions in view; this is association, not a test of memory.")}</p>
      </Panel>
      <Panel title={uiText("What changed around a new habit?")} hint={uiText("Choose the habit and its start date; compare the 28 days before and after.")}>
        <div className="flex flex-wrap gap-2"><select aria-label={uiText("Habit question")} className={select} value={factor?.key ?? ''} onChange={(e) => { setKey(e.target.value); setChoice('') }}>{factors.map((f) => <option key={f.key} value={f.key}>{factorName(f)}</option>)}</select><select aria-label={uiText("Habit answer")} className={select} value={chosen} onChange={(e) => setChoice(e.target.value)}>{factor?.options.map((v) => <option key={v} value={v}>{factorOption(factor,v)}</option>)}</select><input aria-label={uiText("Habit start date")} type="date" className={select} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /><OutcomePicker value={outcome} onChange={setOutcome} /></div>
        <MiniBars max={outcome === 'focus' || outcome === 'recall' ? 5 : outcome === 'understanding' ? 4 : undefined} rows={[{ label: uiText('Before · {count} rated',{count:change.before.n}), value: change.before.mean ?? 0 }, { label: uiText('After · {count} rated',{count:change.after.n}), value: change.after.mean ?? 0 }].filter((_, i) => (i ? change.after.mean : change.before.mean) !== null)} />
        <p className="text-sm text-muted">{change.difference === null ? uiText("Not enough comparable study days") : `${change.difference >= 0 ? '+' : ''}${change.difference.toFixed(2)} ${outcome === 'focus' || outcome === 'understanding' || outcome === 'recall' ? uiText('rating steps') : uiText('change')}.`} {factor?factorOption(factor,chosen):chosen}: {change.before.share === null ? '–' : Math.round(change.before.share * 100) + '%'}{uiText(" before → ")}{change.after.share === null ? '–' : Math.round(change.after.share * 100) + '%'}{uiText(" Period totals and averages are unadjusted summaries; changing subjects, activities or recording can explain differences.")}</p>
<details className="text-sm text-muted"><summary className="cursor-pointer">{uiText("Evidence")}</summary>{Object.entries(evidenceCopy(change.evidence,currentLanguage())).filter(([key])=>key!=='summary').map(([key,text])=><p key={key} className="mt-2">{text}</p>)}</details>
        <details className="text-sm text-muted"><summary className="cursor-pointer">{uiText("Outcome scale")}</summary>{formatOutcome(outcome, 1)}</details>
      </Panel>
    </div>
  </StatsSection>
}
