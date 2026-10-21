// Quick captures during a session: each costs one tap or one short line.
import type { Id, IsoUtc } from './types'

/** A moment marked on the session line: "I got stuck here", or "I wanted to get distracted and did not". */
export type MarkKind = 'stuck' | 'resisted'

export interface SessionMark {
  id: Id
  blockId: Id
  at: IsoUtc
  kind: MarkKind
  note: string | null
}

export type GoalResult = 'done' | 'partly' | 'not-done'

export const GOAL_RESULTS: { id: GoalResult; label: string }[] = [
  { id: 'done', label: 'Done' },
  { id: 'partly', label: 'Partly' },
  { id: 'not-done', label: 'Not done' }
]

/** Which quick captures are on (Settings). */
export interface CaptureSettings {
  stuck: boolean
  goal: boolean
  resisted: boolean
  longAbsence: boolean
}

export const DEFAULT_CAPTURES: CaptureSettings = { stuck: true, goal: true, resisted: true, longAbsence: true }

/** Back after this long away asks whether to continue the session or end it where you left. */
export function isLongAbsence(distractedSince: IsoUtc | null, nowMs: number, minutes: number): boolean {
  return distractedSince !== null && minutes > 0 && nowMs - Date.parse(distractedSince) > minutes * 60_000
}

/** The note a stuck marker leaves on the subject's Review later mark. */
export function stuckReviewNote(marks: Pick<SessionMark, 'kind' | 'note'>[]): string {
  const stuck = marks.filter((m) => m.kind === 'stuck')
  if (!stuck.length) return ''
  const notes = stuck.map((m) => m.note?.trim()).filter((n): n is string => !!n)
  return notes.length ? `Stuck: ${notes.join('; ')}` : 'Got stuck here'
}
