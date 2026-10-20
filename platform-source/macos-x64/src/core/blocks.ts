// Blocks after the focus stage: recall, the after-block log, and history.
import { focusMsAt, type TimerMode } from './timer'
import { pauseIntervals, type PauseSpan } from './session'
import { parseDayStart, studyDayKey } from './studyDay'
import type { GroupNotes, LogValues } from './logfields'
import type { DistractionSource, SessionStats } from './distractions'
import type { Id, IsoUtc } from './types'

export type Rating = 1 | 2 | 3 | 4 | 5

export interface RecallInput {
  recallText: string
  /** Optional note for the "Review later" mark. */
  toReviewText: string
  /** Marked for review. Defaults to "has a note" for older callers. */
  reviewMarked?: boolean
  recallRating: Rating | null
  /** False when the rating was left at its default and never moved. */
  recallRatingTouched?: boolean
  recallSeconds: number
}

export type BlockOrigin = 'normal' | 'live_switch' | 'estimated_split'

export interface DistractionRow {
  id: Id
  blockId: Id
  /** Wall-clock start (null only for rows that could not be placed). */
  startedAt: IsoUtc | null
  atOffsetSeconds: number
  durationSeconds: number
  source: DistractionSource
  kind: string
  appName: string | null
  windowTitle: string | null
  confirmed: boolean
}

export interface HistoryBlock {
  id: Id
  sittingId: Id
  /** The session this block is a part of; a session with several subjects has several blocks. */
  sessionId: Id
  /** The stored numbers of the whole session (the same on each of its parts). */
  sessionStats: SessionStats
  itemId: Id
  itemName: string
  itemColor: string
  itemUnit: string
  origin: BlockOrigin
  endedBy: 'finish' | 'switch' | null
  logStatus: 'pending' | 'done'
  timerMode: TimerMode
  targetSeconds: number
  focusStartedAt: IsoUtc
  focusEndedAt: IsoUtc | null
  focusSeconds: number | null
  recallText: string | null
  recallSeconds: number | null
  recallRating: Rating | null
  /** False when the rating was left at its default. */
  recallRatingTouched: boolean
  toReviewText: string | null
  reviewMarked: boolean
  toReviewDone: boolean
  notesLink: string | null
  restPlannedSeconds: number | null
  restActualSeconds: number | null
  restActivity: string | null
  restSkipped: boolean
  /** After-block answers by field id, and short notes by group id. */
  values: LogValues
  groupNotes: GroupNotes
  /** Slider answers that were left at their default. */
  untouched: number[]
  pauses: PauseSpan[]
  distractions: DistractionRow[]
}

export interface HistorySitting {
  id: Id
  startedAt: IsoUtc
  endedAt: IsoUtc | null
  blocks: HistoryBlock[]
}

export interface HistoryDay {
  /** Study day "YYYY-MM-DD". */
  day: string
  focusSeconds: number
  sittings: HistorySitting[]
}

/** Group sittings by the study day they started on, newest day first. */
export function groupByStudyDay(sittings: HistorySitting[], dayStart: string): HistoryDay[] {
  const boundary = parseDayStart(dayStart)
  const days = new Map<string, HistoryDay>()
  const sorted = [...sittings].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
  for (const s of sorted) {
    const key = studyDayKey(new Date(s.startedAt), boundary)
    let day = days.get(key)
    if (!day) {
      day = { day: key, focusSeconds: 0, sittings: [] }
      days.set(key, day)
    }
    day.sittings.push(s)
    day.focusSeconds += s.blocks.reduce((sum, b) => sum + (b.focusSeconds ?? 0), 0)
  }
  return [...days.values()]
}

/** Focus seconds for edited block times: wall time minus pauses inside it. */
export function recomputeFocusSeconds(startedAt: IsoUtc, endedAt: IsoUtc, pauses: PauseSpan[]): number {
  return focusMsAt(Date.parse(startedAt), Date.parse(endedAt), pauseIntervals(pauses)) / 1000
}

/** A session as History shows it: one or more parts, each on one subject. */
export interface HistorySession {
  id: Id
  sittingId: Id
  /** Oldest first. */
  parts: HistoryBlock[]
  startedAt: IsoUtc
  endedAt: IsoUtc | null
  focusSeconds: number
  /** More than one subject. */
  mixed: boolean
  stats: SessionStats
}

/** Gather blocks into their sessions, newest session first. */
export function groupSessions(blocks: HistoryBlock[]): HistorySession[] {
  const m = new Map<Id, HistoryBlock[]>()
  for (const b of blocks) {
    const list = m.get(b.sessionId)
    if (list) list.push(b)
    else m.set(b.sessionId, [b])
  }
  return [...m.entries()]
    .map(([id, list]) => {
      const parts = [...list].sort((a, b) => Date.parse(a.focusStartedAt) - Date.parse(b.focusStartedAt))
      const ends = parts.map((p) => p.focusEndedAt).filter((e): e is string => e !== null)
      return {
        id,
        sittingId: parts[0].sittingId,
        parts,
        startedAt: parts[0].focusStartedAt,
        endedAt: ends.length ? ends.reduce((a, b) => (Date.parse(a) > Date.parse(b) ? a : b)) : null,
        focusSeconds: parts.reduce((s, p) => s + (p.focusSeconds ?? 0), 0),
        mixed: new Set(parts.map((p) => p.itemId)).size > 1,
        stats: parts[0].sessionStats
      }
    })
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
}
