// Migration 8: sessions with parts, the Distracted button, automatic tracking.
//
// - A `sessions` table groups blocks: a live switch adds a part (a block on
//   another subject) to the same session. Every existing block becomes its own
//   session with the same id. The session row stores its raw distraction numbers.
// - Distractions get their wall-clock start (`started_at`), so the session
//   timeline can draw them where they happened.
// - Pauses become "Distracted" spells: source 'pause' turns into 'manual'.
// - The app rules get their starting list.
import type Database from 'better-sqlite3'
import { sessionStats, type DistractionSource } from '@core/distractions'
import { pauseIntervals } from '@core/session'
import { wallAtFocusOffset } from '@core/timer'
import { SEED_APP_RULES } from '@core/tracking'

export function migrate8(db: Database.Database): void {
  db.exec(/* sql */ `
    CREATE TABLE sessions (
      id                       INTEGER PRIMARY KEY,
      sitting_id               INTEGER NOT NULL REFERENCES sittings(id) ON DELETE CASCADE,
      started_at               TEXT    NOT NULL,
      ended_at                 TEXT,
      distraction_count        INTEGER NOT NULL DEFAULT 0,
      distracted_seconds       REAL    NOT NULL DEFAULT 0,
      lost_share               REAL    NOT NULL DEFAULT 0,
      longest_stretch_seconds  REAL    NOT NULL DEFAULT 0
    );
    CREATE INDEX sessions_sitting ON sessions(sitting_id);

    ALTER TABLE blocks ADD COLUMN session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE;
    CREATE INDEX blocks_session ON blocks(session_id);

    ALTER TABLE distractions ADD COLUMN started_at TEXT;
    CREATE INDEX window_activity_started ON window_activity(block_id, started_at);

    INSERT INTO sessions (id, sitting_id, started_at, ended_at)
      SELECT id, sitting_id, focus_started_at, focus_ended_at FROM blocks;
    UPDATE blocks SET session_id = id;
  `)

  // Place every distraction on the clock. Pause rows match the block's pauses in order.
  const blocks = db.prepare('SELECT id, focus_started_at, focus_ended_at FROM blocks').all() as {
    id: number
    focus_started_at: string
    focus_ended_at: string | null
  }[]
  const pausesOf = db.prepare('SELECT started_at, ended_at FROM block_pauses WHERE block_id = ? ORDER BY started_at')
  const distractionsOf = db.prepare('SELECT id, source, at_offset_seconds FROM distractions WHERE block_id = ? ORDER BY at_offset_seconds, id')
  const setStart = db.prepare('UPDATE distractions SET started_at = ? WHERE id = ?')
  for (const b of blocks) {
    const pauses = (pausesOf.all(b.id) as { started_at: string; ended_at: string | null }[]).map((p) => ({ startedAt: p.started_at, endedAt: p.ended_at }))
    const removed = pauseIntervals(pauses)
    const start = Date.parse(b.focus_started_at)
    let nextPause = 0
    for (const d of distractionsOf.all(b.id) as { id: number; source: string; at_offset_seconds: number }[]) {
      let at: number
      if (d.source === 'pause' && nextPause < pauses.length) at = Date.parse(pauses[nextPause++].startedAt)
      else at = wallAtFocusOffset(start, d.at_offset_seconds * 1000, removed)
      setStart.run(new Date(at).toISOString(), d.id)
    }
  }
  db.exec("UPDATE distractions SET source = 'manual' WHERE source = 'pause'")

  // Store each session's numbers.
  const all = db.prepare('SELECT block_id, started_at, duration_seconds, source, confirmed FROM distractions WHERE started_at IS NOT NULL').all() as {
    block_id: number
    started_at: string
    duration_seconds: number
    source: DistractionSource
    confirmed: number
  }[]
  const byBlock = new Map<number, typeof all>()
  for (const d of all) byBlock.set(d.block_id, [...(byBlock.get(d.block_id) ?? []), d])
  const setStats = db.prepare(
    'UPDATE sessions SET distraction_count = ?, distracted_seconds = ?, lost_share = ?, longest_stretch_seconds = ? WHERE id = ?'
  )
  for (const b of blocks) {
    if (!b.focus_ended_at) continue
    const s = sessionStats(
      [{ start: Date.parse(b.focus_started_at), end: Date.parse(b.focus_ended_at) }],
      (byBlock.get(b.id) ?? []).map((d) => ({ startedAt: Date.parse(d.started_at), durationSeconds: d.duration_seconds, source: d.source, confirmed: d.confirmed === 1 }))
    )
    setStats.run(s.distractionCount, s.distractedSeconds, s.lostShare, s.longestStretchSeconds, b.id)
  }

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM app_rules').get() as { n: number }
  if (n === 0) {
    const ins = db.prepare('INSERT INTO app_rules (match_type, pattern, classification) VALUES (?, ?, ?)')
    for (const r of SEED_APP_RULES) ins.run(r.matchType, r.pattern, r.classification)
  }
}
