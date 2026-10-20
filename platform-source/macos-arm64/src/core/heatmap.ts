// The year activity graph (GitHub style): one square per study day, weeks
// as columns, five levels, streaks.
import { addDays, parseDateKey, parseDayStart, studyDayKey, weekStartKey, type Weekday } from './studyDay'

export interface DayActivity {
  focusSeconds: number
  sessions: number
  subjects: number
}

interface BlockLike {
  focusStartedAt: string
  focusSeconds: number
  sessionId: number
  itemId: number
}

/** Focus, sessions and subjects per study day. A session counts on the day it started. */
export function dayActivity(blocks: BlockLike[], dayStart: string): Map<string, DayActivity> {
  const b = parseDayStart(dayStart)
  const acc = new Map<string, { focus: number; sessions: Set<number>; subjects: Set<number> }>()
  for (const x of blocks) {
    const day = studyDayKey(new Date(x.focusStartedAt), b)
    const e = acc.get(day) ?? { focus: 0, sessions: new Set<number>(), subjects: new Set<number>() }
    e.focus += x.focusSeconds
    e.sessions.add(x.sessionId)
    e.subjects.add(x.itemId)
    acc.set(day, e)
  }
  return new Map([...acc].map(([day, e]) => [day, { focusSeconds: e.focus, sessions: e.sessions.size, subjects: e.subjects.size }]))
}

const key = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export interface YearGrid {
  /** Columns of seven days, starting on the configured weekday; null outside the year. */
  weeks: (string | null)[][]
  /** The column where each month starts. */
  months: { month: number; column: number }[]
}

export function yearGrid(year: number, weekStartsOn: Weekday): YearGrid {
  const first = `${year}-01-01`
  const last = `${year}-12-31`
  const weeks: (string | null)[][] = []
  const months: { month: number; column: number }[] = []
  for (let start = weekStartKey(first, weekStartsOn); start <= last; start = addDays(start, 7)) {
    const col = Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => (d >= first && d <= last ? d : null))
    for (const d of col) {
      if (d && d.endsWith('-01')) months.push({ month: parseDateKey(d).getMonth(), column: weeks.length })
    }
    weeks.push(col)
  }
  return { weeks, months }
}

/**
 * Level 0 (nothing) to 4 for each value, by quarters of the days that have
 * any study, so a few long days do not wash out the rest.
 */
export function levelScale(values: number[]): (v: number) => 0 | 1 | 2 | 3 | 4 {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b)
  if (!nz.length) return () => 0
  const q = (p: number): number => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))]
  const cuts = [q(0.25), q(0.5), q(0.75)]
  return (v) => (v <= 0 ? 0 : v < cuts[0] ? 1 : v < cuts[1] ? 2 : v < cuts[2] ? 3 : 4)
}

/**
 * Current streak (consecutive study days up to today; a day not studied yet
 * today does not break it) and the longest streak ever.
 */
export function streaks(active: Set<string>, today: string): { current: number; longest: number } {
  let current = 0
  for (let d = active.has(today) ? today : addDays(today, -1); active.has(d); d = addDays(d, -1)) current++
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const d of [...active].sort()) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = d
  }
  return { current, longest }
}

/** Totals for one calendar year. */
export function yearTotals(days: Map<string, DayActivity>, year: number): { focusSeconds: number; sessions: number; activeDays: number } {
  let focusSeconds = 0
  let sessions = 0
  let activeDays = 0
  for (const [d, a] of days) {
    if (!d.startsWith(`${year}-`)) continue
    focusSeconds += a.focusSeconds
    sessions += a.sessions
    if (a.focusSeconds > 0) activeDays++
  }
  return { focusSeconds, sessions, activeDays }
}

/** Years that have any study, plus the current one, newest first. */
export function yearsWithData(days: Map<string, DayActivity>, today: string): number[] {
  const set = new Set<number>([Number(today.slice(0, 4))])
  for (const d of days.keys()) set.add(Number(d.slice(0, 4)))
  return [...set].sort((a, b) => b - a)
}

/** For tests and labels: a Date to its "YYYY-MM-DD" key. */
export const dateKey = key
