// Migration 9 (round 5): rules for one subject, session goals and window
// switches, the daily check-in, parked thoughts and session marks.
import type Database from 'better-sqlite3'
import { SCALES, seedOptions } from '@core/logfields'

export function migrate9(db: Database.Database): void {
  db.exec(/* sql */ `
    -- A rule can apply to one subject only (YouTube is study for a lecture course).
    ALTER TABLE app_rules ADD COLUMN item_id INTEGER REFERENCES items(id) ON DELETE CASCADE;

    ALTER TABLE sessions ADD COLUMN goal TEXT;
    ALTER TABLE sessions ADD COLUMN goal_result TEXT CHECK (goal_result IN ('done', 'partly', 'not-done'));
    -- How often the window in front changed; Stats uses it as a restlessness measure.
    ALTER TABLE sessions ADD COLUMN window_switches INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE sessions ADD COLUMN switches_per_10min REAL NOT NULL DEFAULT 0;

    -- 'day': the group is asked once per study day (the daily check-in) instead of per session.
    -- (The section column has a CHECK that cannot be widened in place, so the scope sits beside it.)
    ALTER TABLE log_groups ADD COLUMN scope TEXT CHECK (scope IN ('day'));

    CREATE TABLE day_log_values (
      day       TEXT    NOT NULL,
      field_id  INTEGER NOT NULL REFERENCES log_fields(id),
      value     TEXT    NOT NULL,
      PRIMARY KEY (day, field_id)
    );
    CREATE TABLE day_group_notes (
      day       TEXT    NOT NULL,
      group_id  INTEGER NOT NULL REFERENCES log_groups(id),
      note      TEXT    NOT NULL,
      PRIMARY KEY (day, group_id)
    );
    -- One row per study day once the check-in was answered or skipped.
    CREATE TABLE day_checkins (
      day         TEXT PRIMARY KEY,
      skipped     INTEGER NOT NULL DEFAULT 0,
      updated_at  TEXT    NOT NULL
    );

    CREATE TABLE parked_thoughts (
      id          INTEGER PRIMARY KEY,
      created_at  TEXT    NOT NULL,
      session_id  INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      item_id     INTEGER REFERENCES items(id) ON DELETE SET NULL,
      text        TEXT    NOT NULL,
      done        INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE session_marks (
      id        INTEGER PRIMARY KEY,
      block_id  INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
      at        TEXT    NOT NULL,
      kind      TEXT    NOT NULL CHECK (kind IN ('stuck', 'resisted')),
      note      TEXT
    );
    CREATE INDEX session_marks_block ON session_marks(block_id);
  `)

  // The daily check-in: a "Today" group asked once per study day. Sleep, exercise,
  // physical state and pressure move into it; "Energy today" and "Mood today" are new.
  // Their past per-session answers stay where they are.
  const { next } = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM log_groups').get() as { next: number }
  const today = Number(
    db.prepare("INSERT INTO log_groups (key, name, section, scope, sort_order) VALUES ('today', 'Today', 'detail', 'day', ?)").run(next).lastInsertRowid
  )
  const insField = db.prepare('INSERT INTO log_fields (key, group_id, label, type, options, scale, is_setup, sort_order) VALUES (?, ?, ?, ?, ?, ?, 0, ?)')
  insField.run('day-energy', today, 'Energy today', 'scale', '[]', JSON.stringify(SCALES.energy), 0)
  insField.run(
    'day-mood',
    today,
    'Mood today',
    'multi',
    JSON.stringify(seedOptions(['Calm', 'Content', 'Motivated', 'Excited', 'Neutral', 'Bored', 'Low', 'Anxious', 'Stressed', 'Frustrated'])),
    null,
    1
  )
  const move = db.prepare('UPDATE log_fields SET group_id = ?, sort_order = ? WHERE key = ?')
  ;['sleep', 'sleep-hours', 'exercise', 'physical', 'pressure'].forEach((key, i) => move.run(today, i + 2, key))
  // The groups they came from are empty now (unless the user added fields there).
  db.exec(`UPDATE log_groups SET archived = 1
           WHERE key IN ('day', 'pressure') AND NOT EXISTS (SELECT 1 FROM log_fields f WHERE f.group_id = log_groups.id AND f.archived = 0)`)
}
