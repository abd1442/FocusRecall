// Migration 12 (round 9): learning stage details per subject (round 4 section 3).
import type Database from 'better-sqlite3'

export function migrate12(db: Database.Database): void {
  db.exec(/* sql */ `
    ALTER TABLE items ADD COLUMN prior_knowledge TEXT CHECK (prior_knowledge IN ('new', 'some', 'before', 'well'));
    ALTER TABLE items ADD COLUMN hours_before REAL NOT NULL DEFAULT 0;
    -- 1 = first subject in this area, 0 = not, NULL = not said.
    ALTER TABLE items ADD COLUMN new_field INTEGER;

    CREATE TABLE item_builds_on (
      item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      builds_on   INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      PRIMARY KEY (item_id, builds_on)
    );
  `)
}
