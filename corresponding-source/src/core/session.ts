// Session state: what stage the app is in and what is running. The main
// process owns it and pushes it to every window.
import { focusMsAt, type Interval, type TimerMode } from './timer'
import type { Id, IsoUtc } from './types'

export type Stage = 'idle' | 'focus' | 'recall' | 'rest'

export interface PauseSpan {
  startedAt: IsoUtc
  endedAt: IsoUtc | null
}

/** An earlier part of the running session, on its own subject. */
export interface SessionPart {
  id: Id
  itemId: Id
  itemName: string
  itemColor: string
  focusSeconds: number
}

/** The running part of a session: one subject, its own clock, inside one session. */
export interface RunningBlock {
  id: Id
  /** The session this part belongs to. A switch adds a part; the session goes on. */
  sessionId: Id
  sittingId: Id
  itemId: Id
  itemName: string
  itemColor: string
  timerMode: TimerMode
  targetSeconds: number
  focusStartedAt: IsoUtc
  pauses: PauseSpan[]
  targetAlerted: boolean
  /** Finished earlier parts of this session, oldest first. */
  parts: SessionPart[]
}

/** A part of a finished session, waiting for recall and the log. */
export interface FinishedBlock {
  id: Id
  sessionId: Id
  origin: 'normal' | 'live_switch' | 'estimated_split'
  focusStartedAt: IsoUtc
  focusEndedAt: IsoUtc
  itemId: Id
  itemName: string
  itemColor: string
  itemUnit: string
  focusSeconds: number
}

/** Where the user is between focus and rest. */
export type AfterStep = 'recall' | 'log'

export interface SittingSummary {
  id: Id
  startedAt: IsoUtc
  blockCount: number
  /** Focus seconds of the sitting's finished blocks. */
  focusSeconds: number
}

export interface RecoveryPrompt {
  blockId: Id
  itemName: string
  itemColor: string
  focusStartedAt: IsoUtc
  lastKnownAt: IsoUtc
  focusSecondsAtLastKnown: number
}

export interface RestState {
  /** The block the rest belongs to (the last one logged). */
  blockId: Id
  itemId: Id
  /** plan: choosing the length; running: counting down; over: time is up, ask what the rest was. */
  phase: 'plan' | 'running' | 'over'
  plannedSeconds: number
  long: boolean
  startedAt: IsoUtc | null
  endsAt: IsoUtc | null
  /** Seconds actually rested, set when it ends (early or on time). */
  actualSeconds: number | null
}

export interface SessionState {
  /** Runtime logical-clock correction after a system clock adjustment. No history is rewritten. */
  clockOffsetMs?: number
  unfinished: UnfinishedWorkflow[]
  stage: Stage
  sitting: SittingSummary | null
  running: RunningBlock | null
  /** The parts of the session that ended and wait for recall and the log. */
  finished: FinishedBlock[]
  step: AfterStep | null
  rest: RestState | null
  recovery: RecoveryPrompt | null
}

export const IDLE_STATE: SessionState = {
  unfinished: [],
  stage: 'idle',
  sitting: null,
  running: null,
  finished: [],
  step: null,
  rest: null,
  recovery: null
}

export interface UnfinishedWorkflow {
  itemName?: string
  endedAt?: string
  sessionId: Id
  step: AfterStep | 'rest'
  deferred: boolean
  rest: RestState | null
  /** Last observed elapsed rest time; subsequent downtime is excluded. */
  elapsed: number
}

export function pauseIntervals(pauses: PauseSpan[]): Interval[] {
  return pauses.map((p) => ({
    start: Date.parse(p.startedAt),
    end: p.endedAt === null ? null : Date.parse(p.endedAt)
  }))
}

/** Focus seconds of the whole running session: earlier parts plus the running one. */
export function sessionFocusSeconds(block: Pick<RunningBlock, 'focusStartedAt' | 'pauses' | 'parts'>, nowMs: number): number {
  return block.parts.reduce((s, p) => s + p.focusSeconds, 0) + runningFocusSeconds(block, nowMs)
}

/** When the open "Distracted" spell started, or null when the clock is running. */
export function distractedSince(block: Pick<RunningBlock, 'pauses'>): IsoUtc | null {
  return block.pauses.find((p) => p.endedAt === null)?.startedAt ?? null
}

export interface SessionSubject {
  itemId: Id
  itemName: string
  itemColor: string
  itemUnit: string
  focusSeconds: number
  /** Parts on this subject, oldest first. The last one gets the recall text and progress. */
  blockIds: Id[]
}

/** The subjects of a finished session in the order first studied, with their parts. */
export function sessionSubjects(parts: FinishedBlock[]): SessionSubject[] {
  const out = new Map<Id, SessionSubject>()
  const sorted = [...parts].sort((a, b) => Date.parse(a.focusStartedAt) - Date.parse(b.focusStartedAt))
  for (const p of sorted) {
    const s = out.get(p.itemId) ?? { itemId: p.itemId, itemName: p.itemName, itemColor: p.itemColor, itemUnit: p.itemUnit, focusSeconds: 0, blockIds: [] }
    s.focusSeconds += p.focusSeconds
    s.blockIds.push(p.id)
    out.set(p.itemId, s)
  }
  return [...out.values()]
}

/** Focus seconds of a running block at a given moment. */
export function runningFocusSeconds(block: Pick<RunningBlock, 'focusStartedAt' | 'pauses'>, nowMs: number): number {
  return focusMsAt(Date.parse(block.focusStartedAt), nowMs, pauseIntervals(block.pauses)) / 1000
}

/**
 * Whether an open sitting has gone quiet long enough to end by itself.
 * `lastActivityMs` is when its last block (or rest) ended, or when the
 * sitting started if it has no finished block.
 */
export function sittingExpired(lastActivityMs: number, nowMs: number, autoEndHours: number): boolean {
  if (!(autoEndHours > 0)) return false
  return nowMs - lastActivityMs >= autoEndHours * 3_600_000
}

/** Sessions under this many focus seconds trigger the "Discard this session?" prompt. */
export const DISCARD_THRESHOLD_SECONDS = 60
