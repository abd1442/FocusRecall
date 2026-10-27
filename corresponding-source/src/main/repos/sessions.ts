import { recomputeFocusSeconds } from '@core/blocks'
import { pauseIntervals, type FinishedBlock, type PauseSpan, type RunningBlock, type SessionPart, type SittingSummary } from '@core/session'
import { evenBoundaries, partIndexAt, partRanges } from '@core/split'
import { focusMsAt, type TimerMode } from '@core/timer'
import type { Id, IsoUtc } from '@core/types'
import type { Db } from '../db/database'
import { ACTIVE_CATEGORIES_CTE } from './activeSubjects'
import { sessionPauses } from './intervals'

interface RunningRow {
  id: number
  session_id: number
  sitting_id: number
  item_id: number
  item_name: string
  item_color: string
  item_unit: string
  timer_mode: TimerMode
  target_seconds: number
  focus_started_at: string
  last_heartbeat_at: string | null
  target_alerted_at: string | null
}

export interface RunningRecord extends RunningBlock {
  itemUnit: string
  lastHeartbeatAt: IsoUtc | null
}

const iso = (ms: number): IsoUtc => new Date(ms).toISOString()

/** SQL for sittings, sessions, their parts (blocks) and pauses. */
export class SessionRepo {
  constructor(private db: Db) {}

  pendingSessions(): number[] {
    return (this.db.prepare("SELECT DISTINCT session_id AS id FROM blocks WHERE focus_ended_at IS NOT NULL AND log_status = 'pending' AND NOT EXISTS (SELECT 1 FROM blocks live WHERE live.session_id = blocks.session_id AND live.focus_ended_at IS NULL) ORDER BY session_id DESC").all() as {id:number}[]).map((r) => r.id)
  }

  /** Close the workflow, not a learning activity. Leave all answers/recall NULL or absent. */
  closeWithoutAnswers(sessionId: Id): void {
    this.db.prepare("UPDATE blocks SET log_status='done' WHERE session_id=? AND log_status='pending' AND focus_ended_at IS NOT NULL").run(sessionId)
  }

  restUnrecorded(blockId: number): boolean {
    return !!this.db.prepare('SELECT 1 FROM blocks WHERE id = ? AND focus_ended_at IS NOT NULL AND rest_actual_seconds IS NULL').get(blockId)
  }

  sessionIdForBlock(id: number): number | null { return (this.db.prepare('SELECT session_id AS id FROM blocks WHERE id = ?').get(id) as {id:number}|undefined)?.id ?? null }

  pendingParts(sessionId:number):FinishedBlock[] {
    const ids=new Set((this.db.prepare("SELECT id FROM blocks WHERE session_id=? AND log_status='pending'").all(sessionId) as {id:number}[]).map(r=>r.id))
    return this.sessionParts(sessionId).filter(p=>ids.has(p.id))
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  openSitting(): SittingSummary | null {
    const row = this.db
      .prepare(
        `SELECT s.id, s.started_at, COUNT(DISTINCT b.session_id) AS block_count, COALESCE(SUM(b.focus_seconds), 0) AS focus_seconds
         FROM sittings s LEFT JOIN blocks b ON b.sitting_id = s.id
         WHERE s.ended_at IS NULL
         GROUP BY s.id ORDER BY s.started_at DESC LIMIT 1`
      )
      .get() as { id: number; started_at: string; block_count: number; focus_seconds: number } | undefined
    return row
      ? { id: row.id, startedAt: row.started_at, blockCount: row.block_count, focusSeconds: row.focus_seconds }
      : null
  }

  createSitting(at: IsoUtc): Id {
    return Number(this.db.prepare('INSERT INTO sittings (started_at) VALUES (?)').run(at).lastInsertRowid)
  }

  /** When the sitting last had activity: its latest block end (plus rest), or its start. */
  sittingLastActivity(id: Id): number {
    const sitting = this.db.prepare('SELECT started_at FROM sittings WHERE id = ?').get(id) as
      | { started_at: string }
      | undefined
    let last = sitting ? Date.parse(sitting.started_at) : 0
    const rows = this.db
      .prepare('SELECT focus_ended_at, rest_actual_seconds FROM blocks WHERE sitting_id = ? AND focus_ended_at IS NOT NULL')
      .all(id) as { focus_ended_at: string; rest_actual_seconds: number | null }[]
    for (const r of rows) last = Math.max(last, Date.parse(r.focus_ended_at) + (r.rest_actual_seconds ?? 0) * 1000)
    return last
  }

  endSitting(id: Id, at: IsoUtc): void {
    this.db.prepare('UPDATE sittings SET ended_at = ? WHERE id = ?').run(at, id)
  }

  /** Remove a sitting that has no blocks left (e.g. its only session was discarded). */
  deleteSittingIfEmpty(id: Id): boolean {
    const info = this.db
      .prepare('DELETE FROM sittings WHERE id = ? AND NOT EXISTS (SELECT 1 FROM blocks WHERE sitting_id = ?)')
      .run(id, id)
    return info.changes > 0
  }

  itemIsActive(itemId: Id): boolean {
    return !!this.db
      .prepare(
        `${ACTIVE_CATEGORIES_CTE} SELECT 1 FROM items i WHERE i.id = ? AND i.archived = 0 AND i.category_id IN (SELECT id FROM active_categories)`
      )
      .get(itemId)
  }

  createSession(sittingId: Id, at: IsoUtc): Id {
    return Number(this.db.prepare('INSERT INTO sessions (sitting_id, started_at) VALUES (?, ?)').run(sittingId, at).lastInsertRowid)
  }

  endSession(id: Id, at: IsoUtc): void {
    this.db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(at, id)
  }

  /** Delete a whole session with its parts (the "Discard this session?" prompt). */
  deleteSession(id: Id): void {
    this.db.prepare('DELETE FROM blocks WHERE session_id = ?').run(id)
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  }

  /** A part: one subject inside a session. A live switch adds one with origin 'live_switch'. */
  insertBlock(b: {
    sittingId: Id
    sessionId: Id
    itemId: Id
    timerMode: TimerMode
    targetSeconds: number
    startedAt: IsoUtc
    origin?: 'normal' | 'live_switch'
    targetAlertedAt?: IsoUtc | null
  }): Id {
    return Number(
      this.db
        .prepare(
          `INSERT INTO blocks (sitting_id, session_id, item_id, origin, timer_mode, target_seconds, focus_started_at, last_heartbeat_at, target_alerted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(b.sittingId, b.sessionId, b.itemId, b.origin ?? 'normal', b.timerMode, b.targetSeconds, b.startedAt, b.startedAt, b.targetAlertedAt ?? null)
        .lastInsertRowid
    )
  }

  targetAlertedAt(blockId: Id): IsoUtc | null {
    const row = this.db.prepare('SELECT target_alerted_at FROM blocks WHERE id = ?').get(blockId) as { target_alerted_at: string | null } | undefined
    return row?.target_alerted_at ?? null
  }

  /** The finished parts of a session, oldest first. */
  sessionParts(sessionId: Id): FinishedBlock[] {
    const rows = this.db
      .prepare(
        `SELECT b.id, b.session_id, b.origin, b.focus_started_at, b.focus_ended_at, b.item_id, b.focus_seconds,
                i.name AS item_name, i.color AS item_color, i.default_unit AS item_unit
         FROM blocks b JOIN items i ON i.id = b.item_id
         WHERE b.session_id = ? AND b.focus_ended_at IS NOT NULL
         ORDER BY b.focus_started_at, b.id`
      )
      .all(sessionId) as Record<string, unknown>[]
    return rows.map((r) => ({
      id: r.id as number,
      sessionId: r.session_id as number,
      origin: r.origin as FinishedBlock['origin'],
      focusStartedAt: r.focus_started_at as string,
      focusEndedAt: r.focus_ended_at as string,
      itemId: r.item_id as number,
      itemName: r.item_name as string,
      itemColor: r.item_color as string,
      itemUnit: r.item_unit as string,
      focusSeconds: (r.focus_seconds as number | null) ?? 0
    }))
  }

  /**
   * The forgotten switch: split a finished part into one part per subject,
   * evenly at first (the user then drags the dividers). The original keeps
   * its subject and comes first. Returns the parts in order.
   */
  splitPart(blockId: Id, itemIds: Id[]): Id[] {
    return this.db.transaction(()=>this.splitPartNow(blockId,itemIds))()
  }
  private splitPartNow(blockId:Id,itemIds:Id[]):Id[] {
    const b = this.db.prepare('SELECT * FROM blocks WHERE id = ?').get(blockId) as Record<string, unknown> | undefined
    if (!b || !b.focus_ended_at) throw new Error('That part has not ended.')
    const start = Date.parse(b.focus_started_at as string)
    const end = Date.parse(b.focus_ended_at as string)
    const ids = [blockId]
    this.db.prepare("UPDATE blocks SET origin = 'estimated_split' WHERE id = ?").run(blockId)
    const ins = this.db.prepare(
      `INSERT INTO blocks (sitting_id, session_id, item_id, origin, split_from_block_id, ended_by, timer_mode, target_seconds,
         focus_started_at, focus_ended_at, focus_seconds, last_heartbeat_at, target_alerted_at)
       VALUES (?, ?, ?, 'estimated_split', ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    for (const itemId of itemIds) {
      const id = ins.run(
        b.sitting_id,
        b.session_id,
        itemId,
        blockId,
        b.ended_by,
        b.timer_mode,
        b.target_seconds,
        b.focus_ended_at,
        b.focus_ended_at,
        b.focus_ended_at,
        b.target_alerted_at
      ).lastInsertRowid
      if(b.session_id===null)this.db.prepare(`INSERT OR IGNORE INTO window_title_redactions(block_id,redacted_at,reason)
        SELECT ?,redacted_at,reason FROM window_title_redactions WHERE block_id=?`).run(Number(id),blockId)
      ids.push(Number(id))
    }
    this.retime(ids, start, end, evenBoundaries(start, end, ids.length))
    return ids
  }

  /**
   * Give consecutive parts new times from dividers, and move pauses,
   * distractions and window runs to the part where they start. Canonical
   * intervals may cross a divider; duration reads intersect each part.
   */
  retime(blockIds: Id[], start: number, end: number, boundaries: number[]): void {
    if(!blockIds.length || new Set(blockIds).size!==blockIds.length || boundaries.length!==blockIds.length-1 || !Number.isFinite(start) || !Number.isFinite(end) || end<=start || boundaries.some((b,i)=>!Number.isFinite(b)||b<= (i?boundaries[i-1]:start)||b>=end))throw new Error('Invalid session boundaries.')
    const parts=this.db.prepare(`SELECT id,session_id FROM blocks WHERE id IN (${blockIds.map(()=>'?').join(',')})`).all(...blockIds) as {id:number;session_id:number|null}[]
    if(parts.length!==blockIds.length || new Set(parts.map(p=>p.session_id)).size!==1)throw new Error('Those parts do not belong to one session.')
    this.db.transaction(()=>this.retimeNow(blockIds,start,end,boundaries))()
  }
  private retimeNow(blockIds:Id[],start:number,end:number,boundaries:number[]):void {
    const ranges = partRanges(start, end, boundaries)
    const list = blockIds.map(() => '?').join(',')
    const setTimes = this.db.prepare('UPDATE blocks SET focus_started_at = ?, focus_ended_at = ?, last_heartbeat_at = ? WHERE id = ?')
    blockIds.forEach((id, i) => setTimes.run(iso(ranges[i].start), iso(ranges[i].end), iso(ranges[i].end), id))
    const owner = (at: string): Id => blockIds[partIndexAt(Date.parse(at), boundaries)]
    for (const table of ['block_pauses', 'distractions', 'window_activity']) {
      const rows = this.db.prepare('SELECT id, started_at FROM ' + table + ' WHERE started_at IS NOT NULL '+(table==='window_activity'?"AND stage='focus' ":'')+'AND block_id IN (' + list + ')').all(...blockIds) as {
        id: number
        started_at: string
      }[]
      const move = this.db.prepare('UPDATE ' + table + ' SET block_id = ? WHERE id = ?')
      for (const r of rows) move.run(owner(r.started_at), r.id)
    }
    const setFocus = this.db.prepare('UPDATE blocks SET focus_seconds = ? WHERE id = ?')
    const setOffset = this.db.prepare('UPDATE distractions SET at_offset_seconds = ? WHERE id = ?')
    const distractionsOf = this.db.prepare('SELECT id, started_at FROM distractions WHERE block_id = ? AND started_at IS NOT NULL')
    blockIds.forEach((id, i) => {
      const pauses = this.pauses(id)
      setFocus.run(recomputeFocusSeconds(iso(ranges[i].start), iso(ranges[i].end), pauses), id)
      const removed = pauseIntervals(pauses)
      for (const d of distractionsOf.all(id) as { id: number; started_at: string }[]) {
        setOffset.run(focusMsAt(ranges[i].start, Date.parse(d.started_at), removed) / 1000, d.id)
      }
    })
  }

  /**
   * Move the switch point between two consecutive parts of a session. Pauses,
   * distractions and window runs follow the time they belong to.
   */
  moveSwitch(leftId: Id, rightId: Id, atMs: number): void {
    const rows = this.db.prepare('SELECT id, session_id, focus_started_at, focus_ended_at FROM blocks WHERE id IN (?, ?)').all(leftId, rightId) as {
      id: number
      session_id: number
      focus_started_at: string
      focus_ended_at: string | null
    }[]
    const left = rows.find((r) => r.id === leftId)
    const right = rows.find((r) => r.id === rightId)
    if (!left || !right || !left.focus_ended_at || !right.focus_ended_at || left.session_id !== right.session_id) throw new Error('Those parts cannot be moved.')
    const start = Date.parse(left.focus_started_at)
    const end = Date.parse(right.focus_ended_at)
    // Each part keeps at least 30 seconds.
    const at = Math.round(Math.min(end - 30_000, Math.max(start + 30_000, atMs)))
    this.transaction(() => this.retime([leftId, rightId], start, end, [at]))
  }

  /** The part whose focus stage has not ended, if any. */
  getRunning(): RunningRecord | null {
    const row = this.db
      .prepare(
        `SELECT b.id, b.session_id, b.sitting_id, b.item_id, i.name AS item_name, i.color AS item_color, i.default_unit AS item_unit,
                b.timer_mode, b.target_seconds, b.focus_started_at, b.last_heartbeat_at, b.target_alerted_at
         FROM blocks b JOIN items i ON i.id = b.item_id
         WHERE b.focus_ended_at IS NULL
         ORDER BY b.focus_started_at DESC LIMIT 1`
      )
      .get() as RunningRow | undefined
    if (!row) return null
    const parts: SessionPart[] = this.sessionParts(row.session_id).map((p) => ({
      id: p.id,
      itemId: p.itemId,
      itemName: p.itemName,
      itemColor: p.itemColor,
      focusSeconds: p.focusSeconds
    }))
    return {
      id: row.id,
      sessionId: row.session_id,
      parts,
      sittingId: row.sitting_id,
      itemId: row.item_id,
      itemName: row.item_name,
      itemColor: row.item_color,
      itemUnit: row.item_unit,
      timerMode: row.timer_mode,
      targetSeconds: row.target_seconds,
      focusStartedAt: row.focus_started_at,
      pauses: this.pauses(row.id),
      targetAlerted: row.target_alerted_at !== null,
      lastHeartbeatAt: row.last_heartbeat_at
    }
  }

  pauses(blockId: Id): PauseSpan[] {
    return sessionPauses(this.db,blockId)
  }

  openPause(blockId: Id, at: IsoUtc): void {
    this.db.prepare('INSERT INTO block_pauses (block_id, started_at) VALUES (?, ?)').run(blockId, at)
  }

  /** Drop an open pause (the session ends where it started). */
  deleteOpenPause(blockId: Id): void {
    this.db.prepare('DELETE FROM block_pauses WHERE block_id = ? AND ended_at IS NULL').run(blockId)
  }

  /** Close the open pause; returns its start, or null if none was open. */
  closePause(blockId: Id, at: IsoUtc): IsoUtc | null {
    const open = this.db
      .prepare('SELECT id, started_at FROM block_pauses WHERE block_id = ? AND ended_at IS NULL')
      .get(blockId) as { id: number; started_at: string } | undefined
    if (!open) return null
    this.db.prepare('UPDATE block_pauses SET ended_at = ? WHERE id = ?').run(at, open.id)
    return open.started_at
  }

  heartbeat(blockId: Id, at: IsoUtc): void {
    this.db.prepare('UPDATE blocks SET last_heartbeat_at = ? WHERE id = ?').run(at, blockId)
  }

  markTargetAlerted(blockId: Id, at: IsoUtc): void {
    this.db.prepare('UPDATE blocks SET target_alerted_at = ? WHERE id = ?').run(at, blockId)
  }

  finishBlock(blockId: Id, endedAt: IsoUtc, focusSeconds: number, endedBy: 'finish' | 'switch'): void {
    this.db
      .prepare(
        `UPDATE blocks SET focus_ended_at = ?, focus_seconds = ?, ended_by = ?, last_heartbeat_at = ?
         WHERE id = ?`
      )
      .run(endedAt, focusSeconds, endedBy, endedAt, blockId)
  }

  /** Focus since the last rest in a sitting, and how many rests were taken. */
  restInfo(sittingId: Id): { focusSinceLastRest: number; restsTaken: number } {
    const rows = this.db
      .prepare(
        `SELECT focus_seconds, rest_actual_seconds, rest_skipped FROM blocks
         WHERE sitting_id = ? AND focus_ended_at IS NOT NULL ORDER BY focus_started_at`
      )
      .all(sittingId) as { focus_seconds: number | null; rest_actual_seconds: number | null; rest_skipped: number }[]
    let since = 0
    let taken = 0
    for (const r of rows) {
      since += r.focus_seconds ?? 0
      if (r.rest_actual_seconds !== null && r.rest_actual_seconds > 0) {
        taken++
        since = 0
      } else if (r.rest_skipped) {
        since = 0
      }
    }
    return { focusSinceLastRest: since, restsTaken: taken }
  }

  recordRest(blockId: Id, r: { planned: number; actual: number; activity: string | null; skipped: boolean }): void {
    this.db
      .prepare('UPDATE blocks SET rest_planned_seconds = ?, rest_actual_seconds = ?, rest_activity = ?, rest_skipped = ? WHERE id = ?')
      .run(r.planned, r.actual, r.activity, r.skipped ? 1 : 0, blockId)
  }
}
