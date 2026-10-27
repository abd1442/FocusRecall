import type {
  HistoryBlock,
  HistorySitting,
  Rating,
  RecallInput
} from '@core/blocks'
import { recomputeFocusSeconds } from '@core/blocks'
import type { BlockSummary } from '@core/stats'
import type { BlockPatch } from '@core/api'
import type { Id } from '@core/types'
import type { Db } from '../db/database'
import type { LogRepo } from './logs'
import { DistractionRepo,toDistraction } from './distractions'
import { clipPauses,preserveCrossingIntervals,sessionPauses } from './intervals'

const nullIfBlank = (s: string | null | undefined): string | null => (s && s.trim() ? s : null)

/** Recall, the after-block log and history. */
export class BlocksRepo {
  constructor(
    private db: Db,
    private logs: LogRepo
  ) {}

  saveRecall(blockId: Id, r: RecallInput): void {
    const note = nullIfBlank(r.toReviewText)
    const marked = r.reviewMarked ?? note !== null
    this.db
      .prepare(
        `UPDATE blocks SET recall_text = ?, to_review_text = ?, review_marked = ?, recall_rating = ?, recall_seconds = ?,
           recall_rating_touched = ?
         WHERE id = ?`
      )
      .run(nullIfBlank(r.recallText), note, marked ? 1 : 0, r.recallRating, r.recallSeconds, r.recallRatingTouched === false ? 0 : 1, blockId)
  }

  /** Every finished block, reduced for the overview cards. */
  summaries(): BlockSummary[] {
    const rows = this.db
      .prepare(
        `SELECT b.id, b.sitting_id, b.session_id, b.item_id, b.focus_started_at, COALESCE(b.focus_seconds, 0) AS focus_seconds,
                b.recall_text, b.review_marked, b.to_review_text, b.to_review_done, b.notes_link, b.log_status,
                b.origin, b.timer_mode, CASE WHEN EXISTS (SELECT 1 FROM block_log_values v JOIN log_fields f ON f.id=v.field_id WHERE v.block_id=b.id AND f.key='focus' AND v.touched=1) THEN l.focus_rating ELSE NULL END AS focus_rating, l.progress_to, l.progress_unit, l.activity_id
         FROM blocks b LEFT JOIN block_log_core l ON l.block_id = b.id
         WHERE b.focus_ended_at IS NOT NULL`
      )
      .all() as Record<string, unknown>[]
    return rows.map((r) => ({
      id: r.id as number,
      sittingId: r.sitting_id as number,
      sessionId: r.session_id as number,
      itemId: r.item_id as number,
      focusStartedAt: r.focus_started_at as string,
      focusSeconds: r.focus_seconds as number,
      recallText: r.recall_text as string | null,
      reviewMarked: r.review_marked === 1,
      reviewNote: r.to_review_text as string | null,
      reviewDone: r.to_review_done === 1,
      focusRating: r.focus_rating as number | null,
      progressTo: r.progress_to as number | null,
      progressUnit: r.progress_unit as string | null,
      notesLink: r.notes_link as string | null,
      logged: r.log_status === 'done',
      origin: r.origin as BlockSummary['origin'],
      timerMode: r.timer_mode as BlockSummary['timerMode'],
      activityId: r.activity_id as string | null
    }))
  }

  /** Every sitting with its finished blocks, newest first. */
  history(): HistorySitting[] {
    const sittings = this.db
      .prepare('SELECT id, started_at, ended_at FROM sittings ORDER BY started_at DESC')
      .all() as { id: number; started_at: string; ended_at: string | null }[]

    const blocks = this.db
      .prepare(
        `SELECT b.*, i.name AS item_name, i.color AS item_color, i.default_unit AS item_unit,
                s.distraction_count, s.distracted_seconds, s.lost_share, s.longest_stretch_seconds
         FROM blocks b JOIN items i ON i.id = b.item_id LEFT JOIN sessions s ON s.id = b.session_id
         WHERE b.focus_ended_at IS NOT NULL
         ORDER BY b.focus_started_at`
      )
      .all() as Record<string, unknown>[]
    const logs = this.logs.allValues()
    const pauses = groupBy(
      this.db.prepare('SELECT p.block_id,p.started_at,p.ended_at,b.session_id FROM block_pauses p JOIN blocks b ON b.id=p.block_id ORDER BY p.started_at').all() as {
        block_id: number
        session_id:number|null
        started_at: string
        ended_at: string | null
      }[],
      (p) => p.session_id===null?`block:${p.block_id}`:`session:${p.session_id}`
    )
    const distractions = groupBy(
      this.db.prepare('SELECT * FROM distractions ORDER BY started_at, id').all() as Record<string, unknown>[],
      (d) => d.block_id as number
    )

    const bySitting = groupBy(
      blocks.map((b): HistoryBlock => {
        const id = b.id as number
        return {
          id,
          sittingId: b.sitting_id as number,
          sessionId: (b.session_id as number | null) ?? id,
          sessionStats: {
            distractionCount: (b.distraction_count as number | null) ?? 0,
            distractedSeconds: (b.distracted_seconds as number | null) ?? 0,
            lostShare: (b.lost_share as number | null) ?? 0,
            longestStretchSeconds: (b.longest_stretch_seconds as number | null) ?? 0
          },
          itemId: b.item_id as number,
          itemName: b.item_name as string,
          itemColor: b.item_color as string,
          itemUnit: b.item_unit as string,
          origin: b.origin as HistoryBlock['origin'],
          endedBy: b.ended_by as HistoryBlock['endedBy'],
          logStatus: b.log_status as HistoryBlock['logStatus'],
          timerMode: b.timer_mode as HistoryBlock['timerMode'],
          targetSeconds: b.target_seconds as number,
          focusStartedAt: b.focus_started_at as string,
          focusEndedAt: b.focus_ended_at as string | null,
          focusSeconds: b.focus_seconds as number | null,
          recallText: b.recall_text as string | null,
          recallSeconds: b.recall_seconds as number | null,
          recallRating: b.recall_rating as Rating | null,
          recallRatingTouched: b.recall_rating_touched !== 0,
          toReviewText: b.to_review_text as string | null,
          reviewMarked: b.review_marked === 1,
          toReviewDone: b.to_review_done === 1,
          notesLink: b.notes_link as string | null,
          restPlannedSeconds: b.rest_planned_seconds as number | null,
          restActualSeconds: b.rest_actual_seconds as number | null,
          restActivity: b.rest_activity as string | null,
          restSkipped: b.rest_skipped === 1,
          values: logs.get(id)?.values ?? {},
          groupNotes: logs.get(id)?.notes ?? {},
          untouched: logs.get(id)?.untouched ?? [],
          pauses: clipPauses((pauses.get(b.session_id===null?`block:${id}`:`session:${b.session_id}`) ?? []).map(p=>({startedAt:p.started_at,endedAt:p.ended_at})),b.focus_started_at as string,b.focus_ended_at as string),
          distractions: (distractions.get(id) ?? []).map(toDistraction)
        }
      }),
      (b) => b.sittingId
    )

    return sittings.map((s) => ({
      id: s.id,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      blocks: bySitting.get(s.id) ?? []
    }))
  }

  updateBlock(id: Id, patch: BlockPatch): void {
    const row = this.db
      .prepare('SELECT focus_started_at, focus_ended_at FROM blocks WHERE id = ?')
      .get(id) as { focus_started_at: string; focus_ended_at: string | null } | undefined
    if (!row) throw new Error(`Block ${id} not found.`)
    this.db.transaction(() => {
      this.assertSessionNotRunning(this.sessionOfBlock(id))
      if (patch.itemId !== undefined) {
        this.db.prepare('UPDATE blocks SET item_id = ? WHERE id = ?').run(patch.itemId, id)
        this.db.prepare('UPDATE study_notes SET item_id = ? WHERE block_id = ?').run(patch.itemId, id)
      }
      if (patch.recallText !== undefined)
        this.db.prepare('UPDATE blocks SET recall_text = ? WHERE id = ?').run(nullIfBlank(patch.recallText), id)
      if (patch.toReviewText !== undefined)
        this.db.prepare('UPDATE blocks SET to_review_text = ? WHERE id = ?').run(nullIfBlank(patch.toReviewText), id)
      if (patch.reviewMarked !== undefined)
        this.db.prepare('UPDATE blocks SET review_marked = ? WHERE id = ?').run(patch.reviewMarked ? 1 : 0, id)
      if (patch.recallRating !== undefined)
        this.db
          .prepare('UPDATE blocks SET recall_rating = ?, recall_rating_touched = ? WHERE id = ?')
          .run(patch.recallRating, patch.recallRatingTouched === false ? 0 : 1, id)
      if (patch.focusStartedAt !== undefined || patch.focusEndedAt !== undefined) {
        const start = patch.focusStartedAt ?? row.focus_started_at
        const end = patch.focusEndedAt ?? row.focus_ended_at
        if (!end || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) throw new Error('Choose valid times with the end after the start.')
        const siblings=this.db.prepare('SELECT focus_started_at,focus_ended_at FROM blocks WHERE session_id=(SELECT session_id FROM blocks WHERE id=?) AND id<>?').all(id,id) as {focus_started_at:string;focus_ended_at:string|null}[]
        if(siblings.some(s=>Date.parse(start)<(s.focus_ended_at===null?Infinity:Date.parse(s.focus_ended_at)) && Date.parse(end)>Date.parse(s.focus_started_at)))
          throw new Error('Session parts cannot overlap. Choose times outside the other parts or adjust their shared boundary on the timeline.')
        const pauses = sessionPauses(this.db,id)
        this.db
          .prepare('UPDATE blocks SET focus_started_at = ?, focus_ended_at = ?, focus_seconds = ? WHERE id = ?')
          .run(start, end, recomputeFocusSeconds(start, end, pauses), id)
      }
    })()
  }

  setToReviewDone(id: Id, done: boolean): void {
    this.db.prepare('UPDATE blocks SET to_review_done = ? WHERE id = ?').run(done ? 1 : 0, id)
  }

  /** Delete one part; its session and sitting go too if nothing is left in them. */
  deleteBlock(id: Id): void {
    const row = this.db.prepare('SELECT sitting_id, session_id FROM blocks WHERE id = ?').get(id) as { sitting_id: number; session_id: number | null } | undefined
    if (!row) return
    this.db.transaction(() => {
      this.assertSessionNotRunning(row.session_id)
      preserveCrossingIntervals(this.db,id)
      this.db.prepare('DELETE FROM blocks WHERE id = ?').run(id)
      if(row.session_id!==null){const repo=new DistractionRepo(this.db);repo.recomputeParts(repo.sessionBlockIds(row.session_id));repo.refreshSessionStats(row.session_id)}
      this.removeEmpty(row.sitting_id, row.session_id)
    })()
  }

  /** Delete a whole session with all its parts. */
  deleteSession(sessionId: Id): void {
    const row = this.db.prepare('SELECT sitting_id FROM sessions WHERE id = ?').get(sessionId) as { sitting_id: number } | undefined
    if (!row) return
    this.db.transaction(() => {
      this.assertSessionNotRunning(sessionId)
      this.db.prepare('DELETE FROM blocks WHERE session_id = ?').run(sessionId)
      this.removeEmpty(row.sitting_id, sessionId)
    })()
  }

  private sessionOfBlock(id:Id):Id|null {
    return (this.db.prepare('SELECT session_id FROM blocks WHERE id=?').get(id) as {session_id:Id|null}|undefined)?.session_id??null
  }

  private assertSessionNotRunning(sessionId:Id|null):void {
    if(sessionId!==null && this.db.prepare('SELECT 1 FROM blocks WHERE session_id=? AND focus_ended_at IS NULL').get(sessionId))
      throw new Error('Finish the running session before editing or deleting it in History.')
  }

  private removeEmpty(sittingId: Id, sessionId: Id | null): void {
    if (sessionId !== null) this.db.prepare('DELETE FROM sessions WHERE id = ? AND NOT EXISTS (SELECT 1 FROM blocks WHERE session_id = ?)').run(sessionId, sessionId)
    this.db
      .prepare('DELETE FROM sittings WHERE id = ? AND ended_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM blocks WHERE sitting_id = ?)')
      .run(sittingId, sittingId)
  }
}

function groupBy<T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const r of rows) {
    const k = key(r)
    const list = m.get(k)
    if (list) list.push(r)
    else m.set(k, [r])
  }
  return m
}
