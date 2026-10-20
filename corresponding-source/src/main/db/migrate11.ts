// Migration 11 (round 7): untouched slider defaults are saved but marked, and
// program and site rules get a scope (one session) and a time (latest choice).
import type Database from 'better-sqlite3'

export function migrate11(db: Database.Database): void {
  db.exec(/* sql */ `
    -- 1 = the answer was given or moved by hand; 0 = a slider left at its default.
    -- Earlier answers count as given.
    ALTER TABLE block_log_values ADD COLUMN touched INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE day_log_values ADD COLUMN touched INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE blocks ADD COLUMN recall_rating_touched INTEGER NOT NULL DEFAULT 1;

    -- "Just this session" choices, and when each choice was made.
    ALTER TABLE app_rules ADD COLUMN session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE;
    ALTER TABLE app_rules ADD COLUMN updated_at TEXT;
    UPDATE app_rules SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
  `)
}
