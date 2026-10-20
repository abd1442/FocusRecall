// Aggregations over finished blocks for Home, the session page and the
// Library pages. Pure functions over a light per-block summary.
import { addDays, parseDayStart, studyDayKey, weekStartKey, type Weekday } from './studyDay'
import type { Id, IsoUtc } from './types'

/** One finished block, reduced to what the overview cards need. */
export interface BlockSummary {
  id: Id
  sittingId: Id
  /** The session this block is a part of. */
  sessionId: Id
  itemId: Id
  focusStartedAt: IsoUtc
  focusSeconds: number
  recallText: string | null
  /** Marked "Review later" on the recall screen. */
  reviewMarked: boolean
  reviewNote: string | null
  reviewDone: boolean
  focusRating: number | null
  progressTo: number | null
  progressUnit: string | null
  notesLink: string | null
  logged: boolean
  origin: 'normal' | 'live_switch' | 'estimated_split'
  timerMode: 'flow' | 'fixed' | 'adaptive'
  activityId: string | null
}

export interface Totals {
  focusSeconds: number
  /** Sessions, counting a session with several subjects once. */
  sessions: number
  subjects: number
}

export function totals(blocks: BlockSummary[]): Totals {
  return {
    focusSeconds: blocks.reduce((s, b) => s + b.focusSeconds, 0),
    sessions: new Set(blocks.map((b) => b.sessionId)).size,
    subjects: new Set(blocks.map((b) => b.itemId)).size
  }
}

export function dayOf(b: Pick<BlockSummary, 'focusStartedAt'>, dayStart: string): string {
  return studyDayKey(new Date(b.focusStartedAt), parseDayStart(dayStart))
}

/** Blocks on one study day. */
export function onDay(blocks: BlockSummary[], day: string, dayStart: string): BlockSummary[] {
  return blocks.filter((b) => dayOf(b, dayStart) === day)
}

/** Focus seconds for each day of the week containing `today`, starting on the configured weekday. */
export function weekBars(
  blocks: BlockSummary[],
  today: string,
  weekStartsOn: Weekday,
  dayStart: string
): { day: string; focusSeconds: number }[] {
  const start = weekStartKey(today, weekStartsOn)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const sums = new Map(days.map((d) => [d, 0]))
  for (const b of blocks) {
    const d = dayOf(b, dayStart)
    if (sums.has(d)) sums.set(d, sums.get(d)! + b.focusSeconds)
  }
  return days.map((day) => ({ day, focusSeconds: sums.get(day)! }))
}

/**
 * Consecutive study days with at least one block, ending today. A day not
 * studied yet today does not break the streak: it then counts up to yesterday.
 */
export function streak(blocks: BlockSummary[], today: string, dayStart: string): number {
  const studied = new Set(blocks.map((b) => dayOf(b, dayStart)))
  let day = studied.has(today) ? today : addDays(today, -1)
  let n = 0
  while (studied.has(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

/** Open "Review later" marks, newest first. */
export function openReviews(blocks: BlockSummary[]): BlockSummary[] {
  return blocks
    .filter((b) => b.reviewMarked && !b.reviewDone)
    .sort((a, b) => Date.parse(b.focusStartedAt) - Date.parse(a.focusStartedAt))
}

/** Most recent first. */
export function newestFirst(blocks: BlockSummary[]): BlockSummary[] {
  return [...blocks].sort((a, b) => Date.parse(b.focusStartedAt) - Date.parse(a.focusStartedAt))
}

export interface SubjectOverview extends Totals {
  lastStudiedAt: IsoUtc | null
  /** Mean focus rating over logged blocks that have one (1 to 5), or null. */
  averageFocus: number | null
  /** Where the last block with a progress end point stopped. */
  stoppedAt: { value: number; unit: string | null } | null
  lastRecall: BlockSummary | null
}

export function subjectOverview(blocks: BlockSummary[], itemId: Id): SubjectOverview {
  const mine = newestFirst(blocks.filter((b) => b.itemId === itemId))
  const rated = mine.filter((b) => b.focusRating !== null)
  const stopped = mine.find((b) => b.progressTo !== null)
  return {
    ...totals(mine),
    lastStudiedAt: mine[0]?.focusStartedAt ?? null,
    averageFocus: rated.length ? rated.reduce((s, b) => s + b.focusRating!, 0) / rated.length : null,
    stoppedAt: stopped ? { value: stopped.progressTo!, unit: stopped.progressUnit } : null,
    lastRecall: mine.find((b) => b.recallText && b.recallText.trim()) ?? null
  }
}

/** Focus seconds per subject, largest first. */
export function perSubject(blocks: BlockSummary[]): { itemId: Id; focusSeconds: number; sessions: number }[] {
  const m = new Map<Id, { itemId: Id; focusSeconds: number; sessions: Set<Id> }>()
  for (const b of blocks) {
    const e = m.get(b.itemId) ?? { itemId: b.itemId, focusSeconds: 0, sessions: new Set<Id>() }
    e.focusSeconds += b.focusSeconds
    e.sessions.add(b.sessionId)
    m.set(b.itemId, e)
  }
  return [...m.values()].map((e) => ({ itemId: e.itemId, focusSeconds: e.focusSeconds, sessions: e.sessions.size })).sort((a, b) => b.focusSeconds - a.focusSeconds)
}

/** Focus seconds for each of the last `weeks` weeks, oldest first, ending with the week of `today`. */
export function perWeek(
  blocks: BlockSummary[],
  today: string,
  weekStartsOn: Weekday,
  dayStart: string,
  weeks: number
): { weekStart: string; focusSeconds: number }[] {
  const current = weekStartKey(today, weekStartsOn)
  const starts = Array.from({ length: weeks }, (_, i) => addDays(current, -7 * (weeks - 1 - i)))
  const sums = new Map(starts.map((w) => [w, 0]))
  for (const b of blocks) {
    const w = weekStartKey(dayOf(b, dayStart), weekStartsOn)
    if (sums.has(w)) sums.set(w, sums.get(w)! + b.focusSeconds)
  }
  return starts.map((weekStart) => ({ weekStart, focusSeconds: sums.get(weekStart)! }))
}

/** "page 58", "chapter 9", "minute 34": where a subject stopped, in words. */
export function stoppedAtLabel(stop: { value: number; unit: string | null }): string {
  const unit = (stop.unit ?? '').trim()
  if (!unit) return String(stop.value)
  const single = !unit.includes(' ') && unit.length > 3 && unit.endsWith('s') ? unit.slice(0, -1) : unit
  return `${single} ${stop.value}`
}

/** Case-insensitive search in recall text and review notes. */
export function searchNotes(blocks: BlockSummary[], query: string): BlockSummary[] {
  const q = query.trim().toLowerCase()
  const withNotes = blocks.filter((b) => b.recallText?.trim() || b.reviewNote?.trim())
  if (!q) return newestFirst(withNotes)
  return newestFirst(
    withNotes.filter((b) => (b.recallText ?? '').toLowerCase().includes(q) || (b.reviewNote ?? '').toLowerCase().includes(q))
  )
}
