import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateDemo } from '@core/demo'
import { sessionStats } from '@core/distractions'
import { focusMsAt } from '@core/timer'
import type { Db } from './db/database'
import { DATA_IDENTITY, LEGACY_IDENTITY } from '@core/identity'

/** A small config file beside the databases: which one to open. */
interface AppConfig {
  demo: boolean
}

export function readConfig(dataDir: string): AppConfig {
  try {
    const raw = JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8')) as Partial<AppConfig>
    return { demo: !!raw.demo }
  } catch {
    return { demo: false }
  }
}

export function writeConfig(dataDir: string, config: AppConfig): void {
  writeFileSync(join(dataDir, 'config.json'), JSON.stringify(config, null, 2))
}

/** Stable filenames also protect rollback and pending-restore/backup locations. */
export function databaseFile(dataDir: string, demo: boolean): string {
  const current=join(dataDir,demo?DATA_IDENTITY.demoDatabase:DATA_IDENTITY.database)
  const legacy=join(dataDir,demo?LEGACY_IDENTITY.demoDatabase:LEGACY_IDENTITY.database)
  return existsSync(current)?current:existsSync(legacy)?legacy:current
}

export function demoExists(dataDir: string): boolean {
  return existsSync(databaseFile(dataDir, true))
}

/** Bump when the generator changes: an older demo database is cleared and filled again. */
export const DEMO_VERSION = 4

/** Fill the demo database with generated study history (again, when the generator is newer). Only ever called on the demo file. */
export function seedDemo(db: Db, now = Date.now()): void {
  const version = db.prepare("SELECT value FROM settings WHERE key = 'demoVersion'").get() as { value: string } | undefined
  if (version && Number(JSON.parse(version.value)) >= DEMO_VERSION) return
  const data = generateDemo(now)
  const iso = (ms: number): string => new Date(ms).toISOString()
  const fieldIds = new Map(
    (db.prepare('SELECT id, key FROM log_fields WHERE key IS NOT NULL').all() as { id: number; key: string }[]).map((r) => [r.key, r.id])
  )

  db.transaction(() => {
    // The demo starts from its own library and history (this is the demo database only).
    db.exec(`
      DELETE FROM parked_thoughts; DELETE FROM sittings; DELETE FROM day_log_values; DELETE FROM day_group_notes; DELETE FROM day_checkins;
      DELETE FROM study_notes;
      DELETE FROM item_resources; DELETE FROM item_builds_on; DELETE FROM app_rules WHERE item_id IS NOT NULL OR session_id IS NOT NULL;
      DELETE FROM items; DELETE FROM categories;
      DELETE FROM settings WHERE key IN ('demoSeeded', 'demoVersion', 'lastItemId');
    `)
    const catIds = new Map<string, number>()
    const insCat = db.prepare('INSERT INTO categories (name, color, sort_order, created_at, parent_id) VALUES (?, ?, ?, ?, ?)')
    data.categories.forEach((c, i) => {
      catIds.set(c.key, Number(insCat.run(c.name, c.color, i, iso(now), c.parentKey ? catIds.get(c.parentKey)! : null).lastInsertRowid))
    })
    const itemIds = new Map<string, number>()
    const insItem = db.prepare(
      `INSERT INTO items (category_id, name, color, default_unit, total_units, pinned, created_at, prior_knowledge, hours_before, new_field)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const it of data.items) {
      itemIds.set(
        it.key,
        Number(insItem.run(catIds.get(it.categoryKey)!, it.name, it.color, it.unit, it.total, it.pinned ? 1 : 0, iso(now), it.prior, it.hoursBefore, it.newField ? 1 : 0).lastInsertRowid)
      )
    }
    const insBuilds = db.prepare('INSERT INTO item_builds_on (item_id, builds_on) VALUES (?, ?)')
    for (const it of data.items) for (const b of it.buildsOn) insBuilds.run(itemIds.get(it.key)!, itemIds.get(b)!)

    const insSitting = db.prepare('INSERT INTO sittings (started_at, ended_at) VALUES (?, ?)')
    const insSession = db.prepare('INSERT INTO sessions (sitting_id, started_at, ended_at, goal, goal_result, window_switches, switches_per_10min) VALUES (?, ?, ?, ?, ?, ?, ?)')
    const insBlock = db.prepare(
      `INSERT INTO blocks (sitting_id, session_id, item_id, origin, ended_by, log_status, timer_mode, target_seconds, focus_started_at,
         focus_ended_at, focus_seconds, recall_text, recall_seconds, recall_rating, recall_rating_touched, to_review_text, review_marked,
         rest_planned_seconds, rest_actual_seconds, rest_activity, rest_skipped, rest_screen_flags, last_heartbeat_at, target_alerted_at)
       VALUES (?, ?, ?, ?, ?, 'done', ?, ?, ?, ?, ?, ?, 180, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const insPause = db.prepare('INSERT INTO block_pauses (block_id, started_at, ended_at) VALUES (?, ?, ?)')
    const insDistraction = db.prepare(
      `INSERT INTO distractions (block_id, started_at, at_offset_seconds, duration_seconds, source, kind, app_name, window_title, confirmed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const setStats = db.prepare('UPDATE sessions SET distraction_count = ?, distracted_seconds = ?, lost_share = ?, longest_stretch_seconds = ? WHERE id = ?')
    const insValue = db.prepare('INSERT INTO block_log_values (block_id, field_id, value, touched) VALUES (?, ?, ?, ?)')
    const insMark = db.prepare('INSERT INTO session_marks (block_id, at, kind) VALUES (?, ?, ?)')
    const insWindow = db.prepare('INSERT INTO window_activity (block_id, stage, started_at, ended_at, process_name, window_title) VALUES (?, ?, ?, ?, ?, ?)')
    const sessionInfo = new Map(data.sessions.map((s) => [s.number, s]))

    for (const s of data.sittings) {
      const sid = Number(insSitting.run(iso(s.start), iso(s.end)).lastInsertRowid)
      const sessionIds = new Map<number, number>()
      for (const b of s.blocks) {
        const parts = s.blocks.filter((x) => x.session === b.session)
        const info = sessionInfo.get(b.session)!
        if (!sessionIds.has(b.session)) {
          const focus = parts.reduce((n, p) => n + p.focusSeconds, 0)
          sessionIds.set(
            b.session,
            Number(
              insSession.run(sid, iso(parts[0].start), iso(parts[parts.length - 1].end), info.goal, info.goalResult, info.windowSwitches, focus > 0 ? info.windowSwitches / (focus / 600) : 0)
                .lastInsertRowid
            )
          )
        }
        const sessionId = sessionIds.get(b.session)!
        const last = parts[parts.length - 1] === b
        const bid = Number(
          insBlock.run(
            sid,
            sessionId,
            itemIds.get(b.itemKey)!,
            b.origin,
            last ? 'finish' : 'switch',
            b.timerMode,
            b.targetSeconds,
            iso(b.start),
            iso(b.end),
            b.focusSeconds,
            b.recallText,
            b.recallRating,
            b.recallTouched ? 1 : 0,
            b.reviewNote,
            b.reviewMarked ? 1 : 0,
            b.rest?.planned ?? null,
            b.rest?.actual ?? null,
            b.rest?.activity ?? null,
            b.rest?.skipped ? 1 : 0,
            b.rest?.screen ? 1 : 0,
            iso(b.end),
            b.focusSeconds >= b.targetSeconds ? iso(b.start + b.targetSeconds * 1000) : null
          ).lastInsertRowid
        )
        for (const p of b.pauses) insPause.run(bid, iso(p.start), iso(p.end))
        const removed = b.pauses.map((p) => ({ start: p.start, end: p.end }))
        for (const d of b.distractions) {
          const offset = focusMsAt(b.start, d.start, removed) / 1000
          insDistraction.run(bid, iso(d.start), offset, d.duration, d.source, d.kind, d.app ?? null, d.title ?? null, d.confirmed ? 1 : 0)
        }
        for (const [key, value] of Object.entries(b.answers)) {
          const fid = fieldIds.get(key)
          if (fid !== undefined && value !== undefined && value !== null) insValue.run(bid, fid, JSON.stringify(value), b.untouched.includes(key) ? 0 : 1)
        }
        for (const m of b.marks) insMark.run(bid, iso(m.at), m.kind)
        for (const w of b.windows) insWindow.run(bid, w.stage, iso(w.start), iso(w.end), w.process, w.title)
      }
    }
    for (const s of data.sittings) {
      const numbers = new Set(s.blocks.map((b) => b.session))
      for (const n of numbers) {
        const parts = s.blocks.filter((b) => b.session === n)
        const st = sessionStats(
          parts.map((p) => ({ start: p.start, end: p.end })),
          parts.flatMap((p) => p.distractions.map((d) => ({ startedAt: d.start, durationSeconds: d.duration, source: d.source, confirmed: d.confirmed })))
        )
        const id = (db.prepare('SELECT session_id FROM blocks WHERE focus_started_at = ? LIMIT 1').get(iso(parts[0].start)) as { session_id: number }).session_id
        setStats.run(st.distractionCount, st.distractedSeconds, st.lostShare, st.longestStretchSeconds, id)
      }
    }

    const insDay = db.prepare('INSERT INTO day_log_values (day, field_id, value, touched) VALUES (?, ?, ?, ?)')
    const insCheckin = db.prepare('INSERT INTO day_checkins (day, skipped, updated_at) VALUES (?, 0, ?)')
    for (const d of data.days) {
      for (const [key, value] of Object.entries(d.answers)) {
        const fid = fieldIds.get(key)
        if (fid !== undefined) insDay.run(d.day, fid, JSON.stringify(value), d.untouched.includes(key) ? 0 : 1)
      }
      insCheckin.run(d.day, iso(now))
    }
    db.prepare("INSERT INTO settings (key, value) VALUES ('demoSeeded', 'true')").run()
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('demoVersion', JSON.stringify(DEMO_VERSION))
  })()
}
