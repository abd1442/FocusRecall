import { formatDuration , formatDate } from '../i18n'
import { t as uiText } from '../i18n'
import { StatChip } from './StatChip'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { dayActivity, levelScale, streaks, yearDailyStats, yearGrid, yearTotals, yearsWithData } from '@core/heatmap'
import type { BlockSummary } from '@core/stats'

import { useSettings } from '../store/session'
import { useUi } from '../store/ui'
import { useToday } from '../tabs/Home'
import { timeOrDash } from './overview'
import { Segmented } from './ui'
import { useGridNavigation } from './useGridNavigation'

const SHADES = [
  'var(--fr-chart-heat-0)',
  'var(--fr-chart-heat-1)',
  'var(--fr-chart-heat-2)',
  'var(--fr-chart-heat-3)',
  'var(--fr-chart-heat-4)'
]
const DAY_LABEL = (key: string): string => formatDate(key, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/**
 * The year of study as a GitHub-style graph: one square per study day, weeks
 * as columns starting on the configured weekday, five levels of the accent
 * colour. Squares follow focused time or the number of sessions. Clicking a
 * day opens it in History (or calls `onPick`).
 */
export function HeatMap({
  blocks,
  header,
  selected,
  onPick,
  minimal = false,
  compact = false,
  fillWidth = false
}: {
  /** Already filtered (a subject, a category, History's filters). */
  blocks: BlockSummary[]
  /** Left side of the card header (Home puts today's numbers here). */
  header?: React.ReactNode
  selected?: string | null
  onPick?: (day: string) => void
  /** Home shows just the year navigation and a compact calendar. */
  compact?: boolean
  minimal?: boolean
  /** Home uses available width for square cells, with a sensible size cap. */
  fillWidth?: boolean
}): React.JSX.Element {
  const { dayStart, weekStartsOn } = useSettings((s) => s.settings)
  const openHistoryDay = useUi((s) => s.openHistoryDay)
  const today = useToday()
  const [measure, width] = useWidth()
  const days = useMemo(() => dayActivity(blocks, dayStart), [blocks, dayStart])
  const years = yearsWithData(days, today)
  const [year, setYear] = useState(Number(today.slice(0, 4)))
  const [by, setBy] = useState<'time' | 'sessions'>('time')
  const grid = useMemo(() => yearGrid(year, weekStartsOn), [year, weekStartsOn])
  const values = [...days.entries()].filter(([d]) => d.startsWith(`${year}-`)).map(([, a]) => (by === 'time' ? a.focusSeconds : a.sessions))
  const level = levelScale(values)
  const totals = yearTotals(days, year)
  const daily = yearDailyStats(days, year, today)
  const st = streaks(new Set([...days].filter(([, a]) => a.focusSeconds > 0).map(([d]) => d)), today)
  const pick = onPick ?? openHistoryDay
  const rows = Array.from({ length: 7 }, (_, i) => grid.weeks.map(w => w[i] && w[i]! <= today ? w[i] : null))
  const lastDay = `${year}-12-31` < today ? `${year}-12-31` : today
  const initialDay = selected && rows.some(r => r.includes(selected)) ? selected : lastDay
  const keyboard = useGridNavigation(rows, initialDay)

  // Keep one dimension for every day. Small windows scroll instead of
  // squeezing labels or stretching days into rectangles.
  const labelW = minimal ? 0 : 68
  const gap = minimal ? 2 : 3
  const available = Math.floor((width - labelW - gap * (grid.weeks.length - 1)) / grid.weeks.length)
  const cell = minimal ? Math.max(6, Math.min(18, available)) : compact ? 12 : Math.max(14, Math.min(fillWidth ? 24 : 18, available))
  const cellWidth = cell
  const chartWidth = labelW + grid.weeks.length * (cell + gap) - gap
  const monthName = (m: number): string => formatDate(new Date(2026, m, 1), { month: 'short' })
  const weekdayName = (i: number): string => formatDate(new Date(2026, 0, 4 + ((weekStartsOn + i) % 7)), { weekday: 'short' })

  return (
    <section aria-label={uiText("Study activity calendar")} className={minimal ? "flex flex-col gap-2 py-1" : "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"}>
      {!minimal && <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1 text-base">{header ?? <h2 className="text-lg font-semibold">{uiText("Activity")}</h2>}</div>
        <div className="flex flex-wrap gap-2"><StatChip label={uiText("Current streak")} value={st.current+' '+uiText(st.current===1?'day':'days')} tone="rest"/><StatChip label={uiText("Longest streak")} value={st.longest+' '+uiText(st.longest===1?'day':'days')} tone="rest"/></div>
      </div>}

      <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 text-base ${minimal ? 'justify-center' : ''}`}>

        {!minimal && <div className="flex flex-wrap gap-2" aria-label={uiText('{year} study totals',{year})}><StatChip label={uiText('Focus in {year}',{year})} value={formatDuration(totals.focusSeconds)}/><StatChip label={uiText(totals.sessions===1?'Session':'Sessions')} value={totals.sessions}/><StatChip label={uiText(totals.activeDays===1?'Active day':'Active days')} value={totals.activeDays} tone="rest"/></div>}
        {!minimal && <span className="flex-1" />}
        {!minimal && <Segmented<'time' | 'sessions'>
          value={by}
          onChange={setBy}
          options={[
            { value: 'time', label: 'Focused time' },
            { value: 'sessions', label: 'Sessions' }
          ]}
        />}
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label={uiText("Year before")}
            disabled={year <= Math.min(...years)}
            onClick={() => setYear((y) => y - 1)}
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
          >
            ‹
          </button>
          <span aria-live="polite" aria-atomic="true" className="w-12 text-center font-semibold tabular-nums">{year}</span>
          <button
            type="button"
            aria-label={uiText("Year after")}
            disabled={year >= Math.max(...years)}
            onClick={() => setYear((y) => y + 1)}
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
          >
            ›
          </button>
        </span>
      </div>

      <div ref={measure} className="w-full overflow-x-auto">
        {keyboard.help}
        {!minimal && <div aria-hidden="true" className="relative" style={{ width: chartWidth, height: 28 }}>
          {grid.months.map((m, index) => (
            <span key={m.month} title={monthName(m.month)} className="absolute overflow-hidden whitespace-nowrap border-b border-line pb-1 text-center text-xs text-muted" style={{ insetInlineStart: labelW + m.column * (cellWidth + gap), width: ((grid.months[index + 1]?.column ?? grid.weeks.length) - m.column) * (cell + gap) - gap }}>
              {monthName(m.month)}
            </span>
          ))}
        </div>}
        <div className="flex" style={{ gap, width: chartWidth, marginInline: minimal ? 'auto' : undefined }}>
          {!minimal && <div aria-hidden="true" className="flex shrink-0 flex-col text-muted" style={{ width: labelW - gap, gap, fontSize: compact ? 10 : 12 }}>
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} className="leading-none" style={{ height: cell, lineHeight: `${cell}px` }}>
                {weekdayName(i)}
              </span>
            ))}
          </div>}
          <div ref={keyboard.ref} role="grid" aria-label={uiText('Study activity calendar')} aria-describedby={keyboard.helpId} className="flex flex-col" style={{ gap }}>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} role="row" className="flex" style={{ gap }}>
              {grid.weeks.map((w, wi) => {
                const d = w[i]
                if (!d) return <span key={wi} role="gridcell" aria-disabled="true" style={{ width: cellWidth, height: cell }} />
                const a = days.get(d)
                const v = a ? (by === 'time' ? a.focusSeconds : a.sessions) : 0
                const future = d > today
                const tip = a ? uiText('{date}: {duration} · sessions: {sessions} · subjects: {subjects}',{date:DAY_LABEL(d),duration:timeOrDash(a.focusSeconds),sessions:a.sessions,subjects:a.subjects}) : uiText('{date}: nothing studied',{date:DAY_LABEL(d)})
                return (
                  <span key={d} role="gridcell" aria-selected={d === selected} aria-disabled={future} style={{ width: cellWidth, height: cell }}>
                  <button
                    key={d}
                    {...keyboard.cellProps(d)}
                    type="button"
                    title={tip}
                    aria-label={tip}
                    aria-current={d === today ? 'date' : undefined}
                    disabled={future}
                    onClick={() => pick(d)}
                    className={`activity-day block rounded-[3px] transition ${future ? 'opacity-25' : 'hover:ring-2 hover:ring-muted'} ${d === selected ? 'ring-2 ring-ink' : ''} ${d === today ? 'outline outline-1 outline-muted' : ''}`}
                    style={{ width: cellWidth, height: cell, background: SHADES[level(v)] }}
                  />
                  </span>
                )
              })}
            </div>
          ))}
          </div>
        </div>
      </div>

      {minimal && <div data-home-calendar-stats className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 pt-1 text-sm">
        <span title={uiText('Daily statistics use calendar days in the selected year, excluding future days.')}><span className="text-muted">{uiText('Daily average')}: </span><strong className="font-semibold text-focus">{formatDuration(daily.averageSeconds)}</strong></span>
        <span title={uiText('Daily statistics use calendar days in the selected year, excluding future days.')}><span className="text-muted">{uiText('Days studied')}: </span><strong className="font-semibold text-focus">{Math.round(daily.studiedPercent)}%</strong></span>
        <span title={uiText('Streaks use all recorded study days.')}><span className="text-muted">{uiText('Longest streak')}: </span><strong className="font-semibold text-focus">{st.longest} {uiText(st.longest===1?'day':'days')}</strong></span>
        <span title={uiText('Streaks use all recorded study days.')}><span className="text-muted">{uiText('Current streak')}: </span><strong className="font-semibold text-focus">{st.current} {uiText(st.current===1?'day':'days')}</strong></span>
      </div>}

      {!minimal && <div className="flex items-center justify-end gap-1.5 text-sm text-muted">{uiText("Less")}{SHADES.map((c) => (
          <span key={c} className="size-3.5 rounded-[3px]" style={{ background: c }} />
        ))}{uiText("More")}</div>}
    </section>
  )
}

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(900)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}
