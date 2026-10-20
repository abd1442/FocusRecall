// History: ranges, filters, comparisons, the calendar and the day timeline.
import { groupSessions, type HistoryBlock, type HistorySession, type HistorySitting } from './blocks'
import { qualityOf, type Quality, type QualityThresholds } from './distractions'
import { fieldByKey, type LogSchema } from './logfields'
import { monthComparison, addDays, parseDateKey, parseDayStart, studyDayKey, studyDayRange, weekStartKey, type Weekday } from './studyDay'
import type { Id } from './types'

/** A finished block with the study day it belongs to. */
export interface DayBlock extends HistoryBlock {
  day: string
}

export function flattenBlocks(sittings: HistorySitting[], dayStart: string): DayBlock[] {
  const b = parseDayStart(dayStart)
  return sittings
    .flatMap((s) => s.blocks.map((x) => ({ ...x, day: studyDayKey(new Date(x.focusStartedAt), b) })))
    .sort((a, b2) => Date.parse(b2.focusStartedAt) - Date.parse(a.focusStartedAt))
}

export type RangePreset = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'last-30' | 'all' | 'day' | 'custom'

export interface DayRange {
  /** Inclusive study days "YYYY-MM-DD"; null means open-ended. */
  from: string | null
  to: string | null
}

const monthStart = (day: string): string => `${day.slice(0, 7)}-01`
const monthEnd = (day: string): string => {
  const d = parseDateKey(monthStart(day))
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function rangeFor(preset: RangePreset, today: string, weekStartsOn: Weekday, custom?: DayRange): DayRange {
  switch (preset) {
    case 'this-week': {
      const from = weekStartKey(today, weekStartsOn)
      return { from, to: addDays(from, 6) }
    }
    case 'last-week': {
      const from = addDays(weekStartKey(today, weekStartsOn), -7)
      return { from, to: addDays(from, 6) }
    }
    case 'this-month':
      return { from: monthStart(today), to: monthEnd(today) }
    case 'last-month': {
      const prev = addDays(monthStart(today), -1)
      return { from: monthStart(prev), to: monthEnd(prev) }
    }
    case 'last-30':
      return { from: addDays(today, -29), to: today }
    case 'day':
    case 'custom':
      return custom ?? { from: today, to: today }
    default:
      return { from: null, to: null }
  }
}

export interface HistoryFilter {
  range: DayRange
  itemIds: Id[] | null
  /** Category ids, already expanded to include sub-categories. */
  categoryIds: Id[] | null
  activityId: string | null
  query: string
}

/** Everything searchable in a block: recall, review note and every written note. */
export function blockWrittenText(b: HistoryBlock, schema: LogSchema): string {
  const parts = [b.recallText, b.toReviewText, ...Object.values(b.groupNotes)]
  for (const f of schema.fields) {
    if (f.type === 'text' && typeof b.values[f.id] === 'string') parts.push(b.values[f.id] as string)
  }
  return parts.filter(Boolean).join('\n')
}

export function blockText(b: HistoryBlock, schema: LogSchema): string { return blockWrittenText(b,schema).toLowerCase() }

export function filterBlocks(
  blocks: DayBlock[],
  f: HistoryFilter,
  schema: LogSchema,
  categoryOf: (itemId: Id) => Id | undefined
): DayBlock[] {
  const activity = fieldByKey(schema, 'activity')
  const q = f.query.trim().toLowerCase()
  return blocks.filter((b) => {
    if (f.range.from && b.day < f.range.from) return false
    if (f.range.to && b.day > f.range.to) return false
    if (f.itemIds && !f.itemIds.includes(b.itemId)) return false
    if (f.categoryIds) {
      const c = categoryOf(b.itemId)
      if (c === undefined || !f.categoryIds.includes(c)) return false
    }
    if (f.activityId && activity && b.values[activity.id] !== f.activityId) return false
    if (q && !blockText(b, schema).includes(q)) return false
    return true
  })
}

export interface RangeSummary {
  focusSeconds: number
  /** A session with several subjects counts once. */
  sessions: number
  averageSessionSeconds: number
  subjects: number
}

export function summarize(blocks: HistoryBlock[]): RangeSummary {
  const focus = blocks.reduce((s, b) => s + (b.focusSeconds ?? 0), 0)
  const sessions = new Set(blocks.map((b) => b.sessionId)).size
  return {
    focusSeconds: focus,
    sessions,
    averageSessionSeconds: sessions ? focus / sessions : 0,
    subjects: new Set(blocks.map((b) => b.itemId)).size
  }
}

/** Keep the parts of sessions with this quality label. */
export function filterByQuality(blocks: DayBlock[], quality: Quality | null, t: QualityThresholds): DayBlock[] {
  if (!quality) return blocks
  return blocks.filter((b) => qualityOf(b.sessionStats, t) === quality)
}

export interface Comparison {
  label: string
  current: { focusSeconds: number; sessions: number }
  previous: { focusSeconds: number; sessions: number }
}

/** This week against last week, and this month against last month (to the same day). */
export function compareRanges(blocks: DayBlock[], today: string, weekStartsOn: Weekday): Comparison[] {
  const sum = (r: DayRange): { focusSeconds: number; sessions: number } => {
    const inR = blocks.filter((b) => (!r.from || b.day >= r.from) && (!r.to || b.day <= r.to))
    return { focusSeconds: inR.reduce((s, b) => s + (b.focusSeconds ?? 0), 0), sessions: new Set(inR.map((b) => b.sessionId)).size }
  }
  const tw = rangeFor('this-week', today, weekStartsOn)
  const lw = rangeFor('last-week', today, weekStartsOn)
  const tm = rangeFor('this-month', today, weekStartsOn)
  const lm = rangeFor('last-month', today, weekStartsOn)
  tw.to=today;lw.to=addDays(today,-7);tm.to=today;lm.to=monthComparison(today.slice(0,7),today).previousThrough
  return [
    { label: 'This week', current: sum(tw), previous: sum(lw) },
    { label: 'This month', current: sum(tm), previous: sum(lm) }
  ]
}

/** Focus seconds per study day. */
export function dayTotals(blocks: DayBlock[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const b of blocks) m.set(b.day, (m.get(b.day) ?? 0) + (b.focusSeconds ?? 0))
  return m
}

/** Weeks of days for a heat map, oldest first, ending with the week of `today`. */
export function calendarWeeks(today: string, weekStartsOn: Weekday, weeks: number): string[][] {
  const last = weekStartKey(today, weekStartsOn)
  return Array.from({ length: weeks }, (_, w) => {
    const start = addDays(last, -7 * (weeks - 1 - w))
    return Array.from({ length: 7 }, (_, d) => addDays(start, d))
  })
}

/** Heat level 0 (none) to 4 for a day's focus, relative to the busiest day. */
export function heatLevel(seconds: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0 || max <= 0) return 0
  return Math.min(4, Math.max(1, Math.ceil((seconds / max) * 4))) as 1 | 2 | 3 | 4
}

export type GroupBy = 'day' | 'subject' | 'category'

export interface BlockGroup {
  key: string
  blocks: DayBlock[]
  focusSeconds: number
}

/** Group blocks (newest first inside each group). Day groups are newest first; others by time studied. */
export function groupBlocks(blocks: DayBlock[], by: GroupBy, categoryOf: (itemId: Id) => Id | undefined): BlockGroup[] {
  const keyOf = (b: DayBlock): string => (by === 'day' ? b.day : by === 'subject' ? String(b.itemId) : String(categoryOf(b.itemId) ?? ''))
  const m = new Map<string, BlockGroup>()
  for (const b of blocks) {
    const k = keyOf(b)
    const g = m.get(k) ?? { key: k, blocks: [], focusSeconds: 0 }
    g.blocks.push(b)
    g.focusSeconds += b.focusSeconds ?? 0
    m.set(k, g)
  }
  const groups = [...m.values()]
  for (const g of groups) g.blocks.sort((a, b) => Date.parse(b.focusStartedAt) - Date.parse(a.focusStartedAt))
  return by === 'day' ? groups.sort((a, b) => (a.key < b.key ? 1 : -1)) : groups.sort((a, b) => b.focusSeconds - a.focusSeconds)
}

/** A session in History, with the study day it started on. */
export interface DaySession extends HistorySession {
  day: string
}

export interface SessionGroup {
  key: string
  sessions: DaySession[]
  /** Focus time of the parts that belong to this group (a mixed session counts only its matching parts). */
  focusSeconds: number
}

/**
 * Group the sessions of some blocks. By day, each session sits on the day it
 * started. By subject or category, a session with several subjects appears
 * under each of them, counting only its own parts there.
 */
export function groupSessionsBy(blocks: DayBlock[], by: GroupBy, categoryOf: (itemId: Id) => Id | undefined): SessionGroup[] {
  const dayOf = new Map(blocks.map((b) => [b.sessionId, b.day]))
  const sessions: DaySession[] = groupSessions(blocks).map((s) => ({ ...s, day: dayOf.get(s.id) ?? '' }))
  const keyOf = (b: HistoryBlock): string => (by === 'subject' ? String(b.itemId) : String(categoryOf(b.itemId) ?? ''))
  const m = new Map<string, SessionGroup>()
  for (const s of sessions) {
    const keys = by === 'day' ? [s.day] : [...new Set(s.parts.map(keyOf))]
    for (const k of keys) {
      const g = m.get(k) ?? { key: k, sessions: [], focusSeconds: 0 }
      g.sessions.push(s)
      g.focusSeconds += by === 'day' ? s.focusSeconds : s.parts.filter((p) => keyOf(p) === k).reduce((sum, p) => sum + (p.focusSeconds ?? 0), 0)
      m.set(k, g)
    }
  }
  const groups = [...m.values()]
  return by === 'day' ? groups.sort((a, b) => (a.key < b.key ? 1 : -1)) : groups.sort((a, b) => b.focusSeconds - a.focusSeconds)
}

export interface TimelineSpan {
  kind: 'focus' | 'pause' | 'rest'
  blockId: Id
  itemId: Id
  /** Fractions of the study day, 0 to 1. */
  start: number
  end: number
}

/** Focus, pauses and rests of one study day as fractions of that day. */
export function dayTimeline(blocks: HistoryBlock[], day: string, dayStart: string): TimelineSpan[] {
  const { start, end } = studyDayRange(day, parseDayStart(dayStart))
  const t0 = start.getTime()
  const len = end.getTime() - t0
  const frac = (ms: number): number => Math.min(1, Math.max(0, (ms - t0) / len))
  const out: TimelineSpan[] = []
  for (const b of blocks) {
    if (!b.focusEndedAt) continue
    const s = Date.parse(b.focusStartedAt)
    const e = Date.parse(b.focusEndedAt)
    if (e <= t0 || s >= t0 + len) continue
    out.push({ kind: 'focus', blockId: b.id, itemId: b.itemId, start: frac(s), end: frac(e) })
    for (const p of b.pauses) {
      if (!p.endedAt) continue
      out.push({ kind: 'pause', blockId: b.id, itemId: b.itemId, start: frac(Date.parse(p.startedAt)), end: frac(Date.parse(p.endedAt)) })
    }
    if (b.restActualSeconds) out.push({ kind: 'rest', blockId: b.id, itemId: b.itemId, start: frac(e), end: frac(e + b.restActualSeconds * 1000) })
  }
  return out
}
