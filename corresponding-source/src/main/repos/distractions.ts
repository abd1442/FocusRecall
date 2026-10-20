import { recomputeFocusSeconds } from '@core/blocks'
import type { RuleInput } from '@core/api'
import type { DistractionRow } from '@core/blocks'
import { sessionStats, type DistractionSource } from '@core/distractions'
import { pauseIntervals, type PauseSpan } from '@core/session'
import { removesTime } from '@core/timeline'
import { focusMsAt } from '@core/timer'
import {
  countWindowSwitches,
  deriveAutoDistractions,
  programRows,
  ruleForRow,
  siteOf,
  switchesPer10Min,
  type AppRule,
  type Classification,
  type ProgramRow,
  type RuleScope,
  type WindowRun
} from '@core/tracking'
import type { Id, IsoUtc } from '@core/types'
import type { Db } from '../db/database'
import { sessionPauses } from './intervals'

const iso = (ms: number): IsoUtc => new Date(ms).toISOString()

export const toDistraction = (d: Record<string, unknown>): DistractionRow => ({
  id: d.id as number,
  blockId: d.block_id as number,
  startedAt: d.started_at as string | null,
  atOffsetSeconds: d.at_offset_seconds as number,
  durationSeconds: d.duration_seconds as number,
  source: d.source as DistractionSource,
  kind: d.kind as string,
  appName: d.app_name as string | null,
  windowTitle: d.window_title as string | null,
  confirmed: d.confirmed === 1
})

interface PartRow {
  id: number
  item_id: number
  session_id: number | null
  focus_started_at: string
  focus_ended_at: string | null
}

/**
 * Distractions (Distracted spells, detected apps, idle gaps), the app rules,
 * the raw window log, and each session's stored numbers.
 */
export class DistractionRepo {
  constructor(private db: Db) {}

  /** Logical deletion only: keep timing, classifications, confirmations and rules.
   * Never rederive historical detections from the deliberately reduced evidence. */
  deleteWindowTitles(): { activityRows: number; distractionRows: number } {
    return this.db.transaction(() => {
      const at=new Date().toISOString()
      // Session ownership survives estimated splits, moved boundaries and
      // individual part deletion. Legacy session-less blocks keep their own marker.
      this.db.prepare(`INSERT OR IGNORE INTO window_title_redactions(session_id,redacted_at,reason)
        SELECT DISTINCT b.session_id,?,'deleted' FROM blocks b WHERE b.session_id IS NOT NULL AND (
          EXISTS (SELECT 1 FROM window_activity w WHERE w.block_id=b.id) OR
          EXISTS (SELECT 1 FROM distractions d WHERE d.block_id=b.id AND d.source='auto'))`).run(at)
      this.db.prepare(`INSERT OR IGNORE INTO window_title_redactions(block_id,redacted_at,reason)
        SELECT b.id,?,'deleted' FROM blocks b WHERE b.session_id IS NULL AND (
          EXISTS (SELECT 1 FROM window_activity w WHERE w.block_id=b.id) OR
          EXISTS (SELECT 1 FROM distractions d WHERE d.block_id=b.id AND d.source='auto'))`).run(at)
      return {
        activityRows:this.db.prepare('UPDATE window_activity SET window_title=NULL WHERE window_title IS NOT NULL').run().changes,
        distractionRows:this.db.prepare('UPDATE distractions SET window_title=NULL WHERE window_title IS NOT NULL').run().changes
      }
    })()
  }

  windowHistoryFrozen(blockIds:Id[]):boolean {
    return this.parts(blockIds).some(p=>this.frozenPart(p))
  }

  private frozenPart(part:Pick<PartRow,'id'|'session_id'>):boolean {
    return !!this.db.prepare('SELECT 1 FROM window_title_redactions WHERE block_id=? OR session_id=?').get(part.id,part.session_id)
  }

  // --- app rules -------------------------------------------------------------

  rules(): AppRule[] {
    return (
      this.db
        .prepare('SELECT id, match_type, pattern, classification, item_id, session_id, updated_at FROM app_rules ORDER BY classification, match_type, pattern COLLATE NOCASE')
        .all() as {
        id: number
        match_type: AppRule['matchType']
        pattern: string
        classification: Classification
        item_id: number | null
        session_id: number | null
        updated_at: string | null
      }[]
    ).map((r) => ({
      id: r.id,
      matchType: r.match_type,
      pattern: r.pattern,
      classification: r.classification,
      itemId: r.item_id,
      sessionId: r.session_id,
      updatedAt: r.updated_at
    }))
  }

  /**
   * Add a rule, or change the existing one for the same match and scope (the
   * same session, subject, or "always"). Returns its id.
   */
  saveRule(r: RuleInput): Id {
    const pattern = r.pattern.trim()
    if (!pattern) throw new Error('Type a program name or a word from the title.')
    const itemId = r.sessionId ? null : (r.itemId ?? null)
    const sessionId = r.sessionId ?? null
    const now = new Date().toISOString()
    if (r.id) {
      this.db
        .prepare('UPDATE app_rules SET match_type = ?, pattern = ?, classification = ?, item_id = ?, session_id = ?, updated_at = ? WHERE id = ?')
        .run(r.matchType, pattern, r.classification, itemId, sessionId, now, r.id)
      return r.id
    }
    const same = this.db
      .prepare('SELECT id FROM app_rules WHERE match_type = ? AND lower(pattern) = lower(?) AND item_id IS ? AND session_id IS ?')
      .get(r.matchType, pattern, itemId, sessionId) as { id: number } | undefined
    if (same) {
      this.db.prepare('UPDATE app_rules SET classification = ?, updated_at = ? WHERE id = ?').run(r.classification, now, same.id)
      return same.id
    }
    return Number(
      this.db
        .prepare('INSERT INTO app_rules (match_type, pattern, classification, item_id, session_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(r.matchType, pattern, r.classification, itemId, sessionId, now).lastInsertRowid
    )
  }

  /**
   * Move a choice to another scope ("Just this session", "For this subject",
   * "Always"). A rule already there for the same match is replaced.
   */
  rescope(id: Id, scope: RuleScope, ctx: { itemId: Id | null; sessionId: Id | null }): Id {
    const r = this.rules().find((x) => x.id === id)
    if (!r) throw new Error('That choice no longer exists.')
    this.db.prepare('DELETE FROM app_rules WHERE id = ?').run(id)
    return this.saveRule({
      matchType: r.matchType,
      pattern: r.pattern,
      classification: r.classification,
      itemId: scope === 'subject' ? ctx.itemId : null,
      sessionId: scope === 'session' ? ctx.sessionId : null
    })
  }

  deleteRule(id: Id): void {
    this.db.prepare('DELETE FROM app_rules WHERE id = ?').run(id)
  }

  // --- window log --------------------------------------------------------------

  addWindowRun(blockId: Id, stage: 'focus' | 'rest', run: WindowRun): void {
    this.db
      .prepare('INSERT INTO window_activity (block_id, stage, started_at, ended_at, process_name, window_title) VALUES (?, ?, ?, ?, ?, ?)')
      .run(blockId, stage, iso(run.startedAt), iso(run.endedAt), run.process, run.title)
  }

  runs(blockIds: Id[], stage: 'focus' | 'rest' = 'focus'): WindowRun[] {
    if (!blockIds.length) return []
    if(stage==='focus'){
      const parts=this.parts(blockIds),sessions=[...new Set(parts.map(p=>p.session_id).filter((id):id is number=>id!==null))]
      const pool=sessions.length?(this.db.prepare(`SELECT id FROM blocks WHERE session_id IN (${sessions.map(()=>'?').join(',')})`).all(...sessions) as {id:number}[]).map(p=>p.id):[]
      const ids=[...new Set([...pool,...blockIds])]
      const rows=this.db.prepare(`SELECT block_id,started_at,ended_at,process_name,window_title FROM window_activity WHERE stage='focus' AND block_id IN (${ids.map(()=>'?').join(',')}) ORDER BY started_at`).all(...ids) as {block_id:number;started_at:string;ended_at:string;process_name:string|null;window_title:string|null}[]
      const ownerSessions=new Map((this.db.prepare(`SELECT id,session_id FROM blocks WHERE id IN (${ids.map(()=>'?').join(',')})`).all(...ids) as {id:number;session_id:number|null}[]).map(p=>[p.id,p.session_id]))
      return rows.flatMap(r=>parts.filter(p=>p.id===r.block_id || p.session_id!==null&&p.session_id===ownerSessions.get(r.block_id)).flatMap(p=>{
        const start=Math.max(Date.parse(r.started_at),Date.parse(p.focus_started_at)),end=Math.min(Date.parse(r.ended_at),p.focus_ended_at?Date.parse(p.focus_ended_at):Infinity)
        return end>start?[{startedAt:start,endedAt:end,process:r.process_name??'',title:r.window_title??''}]:[]
      })).sort((a,b)=>a.startedAt-b.startedAt)
    }
    const rows = this.db
      .prepare(
        `SELECT started_at, ended_at, process_name, window_title FROM window_activity
         WHERE stage = ? AND block_id IN (${blockIds.map(() => '?').join(',')}) ORDER BY started_at`
      )
      .all(stage, ...blockIds) as { started_at: string; ended_at: string; process_name: string | null; window_title: string | null }[]
    return rows.map((r) => ({ startedAt: Date.parse(r.started_at), endedAt: Date.parse(r.ended_at), process: r.process_name ?? '', title: r.window_title ?? '' }))
  }

  /**
   * Every program and browser site in front during these parts, each judged
   * with its part's own subject and session; for a site seen in parts with
   * different subjects, the part where it was in front longest decides.
   */
  programs(blockIds: Id[]): ProgramRow[] {
    return programRows(this.parts(blockIds).flatMap((p) =>
      this.partRuns(p).map((r) => ({ ...r, context: { itemId: p.item_id, sessionId: p.session_id } }))
    ), this.rules())
  }

  // --- distractions ------------------------------------------------------------

  forBlocks(blockIds: Id[]): DistractionRow[] {
    if (!blockIds.length) return []
    return (
      this.db
        .prepare(`SELECT * FROM distractions WHERE block_id IN (${blockIds.map(() => '?').join(',')}) ORDER BY started_at, id`)
        .all(...blockIds) as Record<string, unknown>[]
    ).map(toDistraction)
  }

  /** A Distracted spell ended: one row with its start, length and (for now) no reason. */
  insertManual(blockId: Id, startedAtMs: number, durationSeconds: number): Id {
    return this.insert(blockId, startedAtMs, durationSeconds, 'manual', 'untagged', null, null, true)
  }

  /** No keyboard or mouse input for a while; the user decides after the session whether they were away. */
  insertIdle(blockId: Id, startedAtMs: number, durationSeconds: number): Id {
    return this.insert(blockId, startedAtMs, durationSeconds, 'idle', 'away', null, null, false)
  }

  /**
   * A distraction added afterwards on the timeline: a Distracted spell that was
   * not logged. It goes on the part where it starts and takes its time out of focus.
   */
  addManual(blockIds: Id[], startMs: number, endMs: number, kind: string): Id {
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)throw Error('Choose valid distraction times.')
    const owner = this.ownerOf(this.parts(blockIds), startMs)
    if (!owner) throw new Error('That is outside the session.')
    return this.db.transaction(() => {
      this.db.prepare('INSERT INTO block_pauses (block_id, started_at, ended_at) VALUES (?, ?, ?)').run(owner.id, iso(startMs), iso(endMs))
      const id = this.insert(owner.id, startMs, (endMs - startMs) / 1000, 'manual', kind, null, null, true)
      for(const p of this.parts(blockIds)){this.recomputeFocus(p.id);this.recomputeOffsets(p.id)}
      return id
    })()
  }

  /**
   * A distraction dragged on the timeline: new start and end. It moves to the
   * part where it now starts; if it takes time out of focus, its removed span
   * moves with it and focus is worked out again.
   */
  retime(id: Id, startMs: number, endMs: number): void {
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)throw Error('Choose valid distraction times.')
    const d = this.row(id)
    if (!d || !d.startedAt || endMs <= startMs) return
    const sessionId = this.sessionOfBlock(d.blockId)
    const parts = sessionId !== null ? this.parts(this.sessionBlockIds(sessionId)) : this.parts([d.blockId])
    const owner = this.ownerOf(parts, startMs) ?? parts.find((p) => p.id === d.blockId)!
    this.db.transaction(() => {
      if (removesTime(d)) {
        this.db
          .prepare('UPDATE block_pauses SET block_id = ?, started_at = ?, ended_at = ? WHERE block_id = ? AND started_at = ? AND ended_at IS NOT NULL')
          .run(owner.id, iso(startMs), iso(endMs), d.blockId, d.startedAt)
      }
      this.db.prepare('UPDATE distractions SET block_id = ?, started_at = ?, duration_seconds = ? WHERE id = ?').run(owner.id, iso(startMs), (endMs - startMs) / 1000, id)
      for (const blockId of parts.map(p=>p.id)) {
        this.recomputeFocus(blockId)
        this.recomputeOffsets(blockId)
      }
    })()
  }

  /**
   * Detected distractions for parts, from their window runs, each part's
   * subject and session. Detections are worked out again: a confirmed one
   * stays when it still counts as a distraction; any that no longer does goes.
   */
  deriveAuto(blockIds: Id[]): void {
    const rules = this.rules()
    this.db.transaction(() => {
      for (const p of this.parts(blockIds)) {
        if(this.frozenPart(p))continue
        const removed = pauseIntervals(this.pauses(p.id))
        const derived = deriveAutoDistractions(this.partRuns(p), rules, removed, 10, { itemId: p.item_id, sessionId: p.session_id })
        const keep = new Set(derived.map((d) => iso(d.startedAt)))
        const existing = this.db.prepare("SELECT id, started_at, confirmed FROM distractions WHERE block_id = ? AND source = 'auto'").all(p.id) as {
          id: number
          started_at: string
          confirmed: number
        }[]
        const confirmed = new Set(existing.filter((e) => e.confirmed && keep.has(e.started_at)).map((e) => e.started_at))
        for (const e of existing) if (!confirmed.has(e.started_at)) this.db.prepare('DELETE FROM distractions WHERE id = ?').run(e.id)
        for (const d of derived) {
          if (confirmed.has(iso(d.startedAt))) {
            const prior=existing.find(e=>e.confirmed && e.started_at===iso(d.startedAt))!
            this.db.prepare('UPDATE distractions SET duration_seconds=? WHERE id=?').run(d.durationSeconds,prior.id)
            continue
          }
          this.insert(p.id, d.startedAt, d.durationSeconds, 'auto', d.kind, d.process, d.title, false)
        }
      }
    })()
  }

  /**
   * After a rule changed: work detections out again for every past part that
   * has window runs, and store each session's numbers again. Returns the
   * sessions touched.
   */
  rederiveAll(): Id[] {
    const ids = this.parts((this.db.prepare('SELECT DISTINCT block_id AS id FROM window_activity').all() as { id: number }[]).map(r=>r.id)).filter(p=>!this.frozenPart(p)).map(p=>p.id)
    this.deriveAuto(ids)
    const sessions = [...new Set(ids.map((id) => this.sessionOfBlock(id)).filter((x): x is Id => x !== null))]
    for (const sid of sessions) this.refreshSessionStats(sid)
    return sessions
  }

  /**
   * "Always ignore" on a detected app or site: an ignore rule for that site
   * (never a whole browser) or program, and detections are worked out again.
   */
  alwaysIgnore(id: Id): void {
    const d = this.row(id)
    if (!d || d.source !== 'auto') return
    if(d.kind==='website'&&!d.windowTitle)throw Error('The original website title is unavailable. Edit rules in Settings or change this record directly.')
    const where = siteOf(d.appName ?? '', d.windowTitle ?? '')
    this.saveRule({ ...ruleForRow({ process: d.appName ?? '', site: where.site }), classification: 'ignore' })
    this.rederiveAll()
  }

  setKind(id: Id, kind: string): void {
    this.db.prepare('UPDATE distractions SET kind = ?, confirmed = 1 WHERE id = ?').run(kind, id)
  }

  /** Uses of each reason, for putting the most used first. */
  reasonCounts(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const r of this.db.prepare("SELECT kind, COUNT(*) AS n FROM distractions WHERE source IN ('manual', 'pause') GROUP BY kind").all() as { kind: string; n: number }[]) {
      out[r.kind] = r.n
    }
    return out
  }

  /**
   * Confirm a detected distraction, or an idle gap as "I was away". A
   * confirmed idle gap is taken out of focus time (as a removed span on the
   * block, like a Distracted spell).
   */
  confirm(id: Id): void {
    const d = this.row(id)
    if (!d || d.confirmed) return
    this.db.transaction(() => {
      this.db.prepare('UPDATE distractions SET confirmed = 1 WHERE id = ?').run(id)
      if (d.source === 'idle' && d.startedAt) {
        const start = Date.parse(d.startedAt)
        this.db.prepare('INSERT INTO block_pauses (block_id, started_at, ended_at) VALUES (?, ?, ?)').run(d.blockId, d.startedAt, iso(start + d.durationSeconds * 1000))
        for(const blockId of this.sessionBlockIds(this.sessionOfBlock(d.blockId)??-1).concat(d.blockId)){this.recomputeFocus(blockId);this.recomputeOffsets(blockId)}
      }
    })()
  }

  /**
   * Remove a distraction. If it had taken time out of focus (a Distracted
   * spell or a confirmed idle gap), that time goes back into focus.
   */
  delete(id: Id): void {
    const d = this.row(id)
    if (!d) return
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM distractions WHERE id = ?').run(id)
      if (d.startedAt && removesTime(d)) {
        const removed = this.db.prepare('DELETE FROM block_pauses WHERE block_id = ? AND started_at = ? AND ended_at IS NOT NULL').run(d.blockId, d.startedAt)
        if (removed.changes) for(const blockId of this.sessionBlockIds(this.sessionOfBlock(d.blockId)??-1).concat(d.blockId)){this.recomputeFocus(blockId);this.recomputeOffsets(blockId)}
      }
    })()
  }

  blockOf(id: Id): Id | null {
    return this.row(id)?.blockId ?? null
  }
  recomputeParts(ids:Id[]):void {for(const id of new Set(ids)){this.recomputeFocus(id);this.recomputeOffsets(id)}}

  /** Recompute and store a session's numbers from its parts, distractions and window runs. */
  refreshSessionStats(sessionId: Id): void {
    const parts = this.db
      .prepare('SELECT id, focus_started_at, focus_ended_at FROM blocks WHERE session_id = ? AND focus_ended_at IS NOT NULL')
      .all(sessionId) as { id: number; focus_started_at: string; focus_ended_at: string }[]
    const ids = parts.map((p) => p.id)
    const ds = this.forBlocks(ids)
    const spans = parts.map((p) => ({ start: Date.parse(p.focus_started_at), end: Date.parse(p.focus_ended_at) }))
    const s = sessionStats(
      spans,
      ds.filter((d) => d.startedAt).map((d) => ({ startedAt: Date.parse(d.startedAt!), durationSeconds: d.durationSeconds, source: d.source, confirmed: d.confirmed }))
    )
    if(this.db.prepare('SELECT 1 FROM window_title_redactions WHERE session_id=?').get(sessionId)){
      // These observed counters cannot be reconstructed after title deletion.
      // Explicit distraction edits still update their own retained evidence.
      this.db.prepare(`UPDATE sessions SET distraction_count=?,distracted_seconds=?,lost_share=?,longest_stretch_seconds=? WHERE id=?`)
        .run(s.distractionCount,s.distractedSeconds,s.lostShare,s.longestStretchSeconds,sessionId)
      return
    }
    const switches = countWindowSwitches(this.parts(ids).flatMap((p) => this.partRuns(p)))
    const wall = spans.length ? (Math.max(...spans.map((x) => x.end)) - Math.min(...spans.map((x) => x.start))) / 1000 : 0
    this.db
      .prepare(
        `UPDATE sessions SET distraction_count = ?, distracted_seconds = ?, lost_share = ?, longest_stretch_seconds = ?,
           window_switches = ?, switches_per_10min = ? WHERE id = ?`
      )
      .run(s.distractionCount, s.distractedSeconds, s.lostShare, s.longestStretchSeconds, switches, switchesPer10Min(switches, wall), sessionId)
  }

  windowSwitches(sessionId: Id): number {
    return (this.db.prepare('SELECT window_switches FROM sessions WHERE id = ?').get(sessionId) as { window_switches: number } | undefined)?.window_switches ?? 0
  }

  sessionOfBlock(blockId: Id): Id | null {
    return (this.db.prepare('SELECT session_id FROM blocks WHERE id = ?').get(blockId) as { session_id: number } | undefined)?.session_id ?? null
  }

  sessionBlockIds(sessionId: Id): Id[] {
    return (this.db.prepare('SELECT id FROM blocks WHERE session_id = ? AND focus_ended_at IS NOT NULL').all(sessionId) as { id: number }[]).map((r) => r.id)
  }

  /** Count one nudge during a rest. */
  flagRestScreen(blockId: Id): void {
    this.db.prepare('UPDATE blocks SET rest_screen_flags = rest_screen_flags + 1 WHERE id = ?').run(blockId)
  }

  // --- internals ---------------------------------------------------------------

  private parts(blockIds: Id[]): PartRow[] {
    if (!blockIds.length) return []
    return this.db
      .prepare(`SELECT id, item_id, session_id, focus_started_at, focus_ended_at FROM blocks WHERE id IN (${blockIds.map(() => '?').join(',')}) ORDER BY focus_started_at`)
      .all(...blockIds) as PartRow[]
  }

  /** A part's window runs, cut to the part's own time (runs go on being logged while away after it ended). */
  private partRuns(p: PartRow): WindowRun[] {
    const start = Date.parse(p.focus_started_at)
    const end = p.focus_ended_at ? Date.parse(p.focus_ended_at) : Number.MAX_SAFE_INTEGER
    return this.runs([p.id])
      .map((r) => ({ ...r, startedAt: Math.max(r.startedAt, start), endedAt: Math.min(r.endedAt, end) }))
      .filter((r) => r.endedAt > r.startedAt)
  }

  /** The part whose time contains a moment (the last part for its very end). */
  private ownerOf(parts: PartRow[], t: number): PartRow | null {
    const sorted = [...parts].sort((a, b) => Date.parse(a.focus_started_at) - Date.parse(b.focus_started_at))
    const hit = sorted.find((p) => t >= Date.parse(p.focus_started_at) && t < Date.parse(p.focus_ended_at ?? p.focus_started_at))
    if (hit) return hit
    const last = sorted[sorted.length - 1]
    return last && last.focus_ended_at && t === Date.parse(last.focus_ended_at) ? last : null
  }

  private insert(
    blockId: Id,
    startedAtMs: number,
    durationSeconds: number,
    source: DistractionSource,
    kind: string,
    app: string | null,
    title: string | null,
    confirmed: boolean
  ): Id {
    const b = this.db.prepare('SELECT focus_started_at FROM blocks WHERE id = ?').get(blockId) as { focus_started_at: string } | undefined
    const offset = b ? focusMsAt(Date.parse(b.focus_started_at), startedAtMs, pauseIntervals(this.pauses(blockId))) / 1000 : 0
    return Number(
      this.db
        .prepare(
          `INSERT INTO distractions (block_id, started_at, at_offset_seconds, duration_seconds, source, kind, app_name, window_title, confirmed)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(blockId, iso(startedAtMs), offset, durationSeconds, source, kind, app, title, confirmed ? 1 : 0).lastInsertRowid
    )
  }

  private row(id: Id): DistractionRow | null {
    const r = this.db.prepare('SELECT * FROM distractions WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return r ? toDistraction(r) : null
  }

  private pauses(blockId: Id): PauseSpan[] {
    return sessionPauses(this.db,blockId)
  }

  private recomputeFocus(blockId: Id): void {
    const b = this.db.prepare('SELECT focus_started_at, focus_ended_at FROM blocks WHERE id = ?').get(blockId) as
      | { focus_started_at: string; focus_ended_at: string | null }
      | undefined
    if (!b?.focus_ended_at) return
    this.db.prepare('UPDATE blocks SET focus_seconds = ? WHERE id = ?').run(recomputeFocusSeconds(b.focus_started_at, b.focus_ended_at, this.pauses(blockId)), blockId)
  }

  private recomputeOffsets(blockId: Id): void {
    const b = this.db.prepare('SELECT focus_started_at FROM blocks WHERE id = ?').get(blockId) as { focus_started_at: string } | undefined
    if (!b) return
    const removed = pauseIntervals(this.pauses(blockId))
    const set = this.db.prepare('UPDATE distractions SET at_offset_seconds = ? WHERE id = ?')
    for (const d of this.db.prepare('SELECT id, started_at FROM distractions WHERE block_id = ? AND started_at IS NOT NULL').all(blockId) as { id: number; started_at: string }[]) {
      set.run(focusMsAt(Date.parse(b.focus_started_at), Date.parse(d.started_at), removed) / 1000, d.id)
    }
  }
}
