import type { GoalResult, MarkKind, SessionMark } from '@core/captures'
import type { Id, IsoUtc } from '@core/types'
import type { Db } from '../db/database'

/** Session marks and goals. Legacy parked_thoughts rows remain untouched. */
export class CaptureRepo {
  constructor(private db: Db) {}

  addMark(blockId: Id, at: IsoUtc, kind: MarkKind, note: string | null): Id {
    const text = note?.trim() || null
    return Number(this.db.prepare('INSERT INTO session_marks (block_id, at, kind, note) VALUES (?, ?, ?, ?)').run(blockId, at, kind, text).lastInsertRowid)
  }

  /** Add a note to the latest stuck marker on a part (the note box opens after the tap). */
  noteLatestStuck(blockId: Id, note: string): void {
    const row = this.db.prepare("SELECT id FROM session_marks WHERE block_id = ? AND kind = 'stuck' ORDER BY at DESC LIMIT 1").get(blockId) as { id: number } | undefined
    if (row && note.trim()) this.db.prepare('UPDATE session_marks SET note = ? WHERE id = ?').run(note.trim(), row.id)
  }

  marks(blockIds: Id[]): SessionMark[] {
    if (!blockIds.length) return []
    return (
      this.db.prepare(`SELECT * FROM session_marks WHERE block_id IN (${blockIds.map(() => '?').join(',')}) ORDER BY at`).all(...blockIds) as Record<string, unknown>[]
    ).map((r) => ({ id: r.id as number, blockId: r.block_id as number, at: r.at as string, kind: r.kind as MarkKind, note: r.note as string | null }))
  }

  goal(sessionId: Id): { goal: string | null; result: GoalResult | null } {
    const r = this.db.prepare('SELECT goal, goal_result FROM sessions WHERE id = ?').get(sessionId) as { goal: string | null; goal_result: GoalResult | null } | undefined
    return { goal: r?.goal ?? null, result: r?.goal_result ?? null }
  }

  setGoal(sessionId: Id, goal: string | null): void {
    this.db.prepare('UPDATE sessions SET goal = ? WHERE id = ?').run(goal?.trim() || null, sessionId)
  }

  setGoalResult(sessionId: Id, result: GoalResult | null): void {
    this.db.prepare('UPDATE sessions SET goal_result = ? WHERE id = ?').run(result, sessionId)
  }
}
