// Numbered migrations. Each runs once, in order, inside a transaction.
// Never edit a migration that has shipped; add a new one instead.

import type Database from 'better-sqlite3'
import { migrate7 } from './migrate7'
import { migrate8 } from './migrate8'
import { migrate9 } from './migrate9'
import { migrate10 } from './migrate10'
import { migrate11 } from './migrate11'
import { migrate12 } from './migrate12'

export interface Migration {
  version: number
  name: string
  /** Plain SQL, or a function for migrations that need code (seeding, moving data). */
  sql?: string
  up?: (db: Database.Database) => void
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: /* sql */ `
      CREATE TABLE categories (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL,
        color       TEXT    NOT NULL,
        sort_order  INTEGER NOT NULL,
        archived    INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT    NOT NULL
      );

      CREATE TABLE items (
        id                 INTEGER PRIMARY KEY,
        category_id        INTEGER NOT NULL REFERENCES categories(id),
        name               TEXT    NOT NULL,
        color              TEXT    NOT NULL,
        default_unit       TEXT    NOT NULL DEFAULT 'pages',
        total_units        REAL,
        notes_target_type  TEXT    NOT NULL DEFAULT 'none'
                           CHECK (notes_target_type IN ('none', 'notion', 'obsidian')),
        notes_target       TEXT,
        notes_vault        TEXT,
        archived           INTEGER NOT NULL DEFAULT 0,
        created_at         TEXT    NOT NULL
      );
      CREATE INDEX items_category ON items(category_id);

      CREATE TABLE sittings (
        id          INTEGER PRIMARY KEY,
        started_at  TEXT NOT NULL,
        ended_at    TEXT
      );

      CREATE TABLE blocks (
        id                    INTEGER PRIMARY KEY,
        sitting_id            INTEGER NOT NULL REFERENCES sittings(id) ON DELETE CASCADE,
        item_id               INTEGER NOT NULL REFERENCES items(id),
        origin                TEXT    NOT NULL DEFAULT 'normal'
                              CHECK (origin IN ('normal', 'live_switch', 'estimated_split')),
        split_from_block_id   INTEGER,
        ended_by              TEXT    CHECK (ended_by IN ('finish', 'switch')),
        log_status            TEXT    NOT NULL DEFAULT 'pending'
                              CHECK (log_status IN ('pending', 'done')),
        timer_mode            TEXT    NOT NULL DEFAULT 'flow'
                              CHECK (timer_mode IN ('flow', 'fixed', 'adaptive')),
        target_seconds        INTEGER NOT NULL,
        focus_started_at      TEXT    NOT NULL,
        focus_ended_at        TEXT,
        focus_seconds         REAL,
        recall_text           TEXT,
        recall_seconds        REAL,
        recall_rating         INTEGER CHECK (recall_rating BETWEEN 1 AND 5),
        to_review_text        TEXT,
        notes_opened          INTEGER NOT NULL DEFAULT 0,
        notes_link            TEXT,
        rest_planned_seconds  REAL,
        rest_actual_seconds   REAL,
        rest_activity         TEXT,
        rest_skipped          INTEGER NOT NULL DEFAULT 0,
        rest_screen_flags     INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX blocks_sitting ON blocks(sitting_id);
      CREATE INDEX blocks_item ON blocks(item_id);
      CREATE INDEX blocks_started ON blocks(focus_started_at);

      CREATE TABLE block_pauses (
        id          INTEGER PRIMARY KEY,
        block_id    INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
        started_at  TEXT NOT NULL,
        ended_at    TEXT
      );
      CREATE INDEX block_pauses_block ON block_pauses(block_id);

      CREATE TABLE block_logs (
        block_id           INTEGER PRIMARY KEY REFERENCES blocks(id) ON DELETE CASCADE,
        activity_type      TEXT,
        progress_amount    REAL,
        progress_unit      TEXT,
        progress_from      REAL,
        progress_to        REAL,
        focus_rating       INTEGER CHECK (focus_rating BETWEEN 1 AND 5),
        difficulty_rating  INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),
        place              TEXT,
        posture            TEXT,
        music              TEXT,
        side_activities    TEXT NOT NULL DEFAULT '[]',
        energy             INTEGER CHECK (energy BETWEEN 1 AND 5),
        mood               INTEGER CHECK (mood BETWEEN 1 AND 5),
        free_note          TEXT
      );

      CREATE TABLE distractions (
        id                 INTEGER PRIMARY KEY,
        block_id           INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
        at_offset_seconds  REAL    NOT NULL,
        duration_seconds   REAL    NOT NULL DEFAULT 0,
        source             TEXT    NOT NULL CHECK (source IN ('auto', 'manual', 'pause', 'idle')),
        kind               TEXT    NOT NULL DEFAULT 'untagged',
        app_name           TEXT,
        window_title       TEXT,
        confirmed          INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX distractions_block ON distractions(block_id);

      CREATE TABLE window_activity (
        id            INTEGER PRIMARY KEY,
        block_id      INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
        stage         TEXT    NOT NULL CHECK (stage IN ('focus', 'rest')),
        started_at    TEXT    NOT NULL,
        ended_at      TEXT    NOT NULL,
        process_name  TEXT,
        window_title  TEXT
      );
      CREATE INDEX window_activity_block ON window_activity(block_id);

      CREATE TABLE app_rules (
        id              INTEGER PRIMARY KEY,
        match_type      TEXT NOT NULL CHECK (match_type IN ('process', 'title')),
        pattern         TEXT NOT NULL,
        classification  TEXT NOT NULL CHECK (classification IN ('study', 'distraction', 'ignore'))
      );

      CREATE TABLE settings (
        key    TEXT PRIMARY KEY,
        value  TEXT NOT NULL
      );

      INSERT INTO categories (name, color, sort_order, created_at) VALUES
        ('University subject', '#5B8DEF', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ('Online course',      '#4FA3A5', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ('Book',               '#D9A441', 2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ('Lecture series',     '#A77BCA', 3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ('Skill practice',     '#6BAA75', 4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ('Other',              '#8A9BA8', 5, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
    `
  },
  {
    version: 2,
    name: 'running block heartbeat and target alert',
    sql: /* sql */ `
      -- Last moment the app saw a running block alive; used for crash recovery.
      ALTER TABLE blocks ADD COLUMN last_heartbeat_at TEXT;
      -- Set once the target alert fired, so a recovered block does not alert twice.
      ALTER TABLE blocks ADD COLUMN target_alerted_at TEXT;
    `
  },
  {
    version: 3,
    name: 'to-review done flag',
    sql: /* sql */ `
      ALTER TABLE blocks ADD COLUMN to_review_done INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    version: 4,
    name: 'sub-categories and category icons',
    sql: /* sql */ `
      -- Two levels only (category > sub-category); the app enforces the depth.
      ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id);
      ALTER TABLE categories ADD COLUMN icon TEXT;
      CREATE INDEX categories_parent ON categories(parent_id);
      UPDATE categories SET icon = '🎓' WHERE name = 'University subject' AND icon IS NULL;
      UPDATE categories SET icon = '💻' WHERE name = 'Online course' AND icon IS NULL;
      UPDATE categories SET icon = '📚' WHERE name = 'Book' AND icon IS NULL;
      UPDATE categories SET icon = '🎙️' WHERE name = 'Lecture series' AND icon IS NULL;
      UPDATE categories SET icon = '🛠️' WHERE name = 'Skill practice' AND icon IS NULL;
      UPDATE categories SET icon = '🗂️' WHERE name = 'Other' AND icon IS NULL;
    `
  },
  {
    version: 5,
    name: 'pinned subjects, review marks, subject resources',
    sql: /* sql */ `
      ALTER TABLE items ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;

      -- "Review later" is now a mark on the block; to_review_text is its optional note.
      ALTER TABLE blocks ADD COLUMN review_marked INTEGER NOT NULL DEFAULT 0;
      UPDATE blocks SET review_marked = 1 WHERE to_review_text IS NOT NULL AND trim(to_review_text) <> '';

      CREATE TABLE item_resources (
        id          INTEGER PRIMARY KEY,
        item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        title       TEXT    NOT NULL,
        target      TEXT    NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX item_resources_item ON item_resources(item_id);
    `
  },
  {
    version: 6,
    name: 'retire the seeded Other category',
    sql: /* sql */ `
      -- Empty "Other" goes away; if it holds subjects it becomes "Uncategorised".
      DELETE FROM categories
       WHERE name = 'Other' AND parent_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM items WHERE items.category_id = categories.id)
         AND NOT EXISTS (SELECT 1 FROM categories c2 WHERE c2.parent_id = categories.id);
      UPDATE categories SET name = 'Uncategorised' WHERE name = 'Other' AND parent_id IS NULL;
    `
  },
  {
    version: 7,
    name: 'data-driven log: groups, fields, options and answers',
    up: migrate7
  },
  {
    version: 8,
    name: 'sessions with parts, distraction times, app rules',
    up: migrate8
  },
  {
    version: 9,
    name: 'subject rules, goals, window switches, daily check-in, parked thoughts, marks',
    up: migrate9
  },
  {
    version: 10,
    name: 'ordered choices become named sliders',
    up: migrate10
  },
  {
    version: 11,
    name: 'touched answers, rule scopes',
    up: migrate11
  },
  {
    version: 12,
    name: 'learning stage per subject',
    up: migrate12
  },
  {
    version: 13,
    name: 'local study notes, whiteboards and external destinations',
    sql: `CREATE TABLE study_notes (
      id TEXT PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES items(id), block_id INTEGER REFERENCES blocks(id) ON DELETE SET NULL,
      title TEXT NOT NULL, text TEXT NOT NULL, strokes TEXT NOT NULL DEFAULT '[]', image TEXT,
      destination TEXT NOT NULL, updated_at TEXT NOT NULL, link TEXT, status TEXT NOT NULL DEFAULT 'local', error TEXT,
      remote_id TEXT, remote_destination TEXT, remote_children TEXT NOT NULL DEFAULT '[]'
    ); CREATE INDEX study_notes_item ON study_notes(item_id); CREATE INDEX study_notes_block ON study_notes(block_id);`
  },
  {
    version: 14,
    name: 'preserve automatic history when window-title evidence is redacted',
    sql: `CREATE TABLE window_title_redactions (
      id INTEGER PRIMARY KEY,
      session_id INTEGER UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
      block_id INTEGER UNIQUE REFERENCES blocks(id) ON DELETE CASCADE,
      redacted_at TEXT NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('deleted','legacy-null')),
      CHECK ((session_id IS NULL) <> (block_id IS NULL))
    );
    -- Earlier title deletion wrote NULL without a provenance marker. Normal
    -- app-only samples use ''. Preserve existing NULL-evidence history rather
    -- than infer whether a missing title was deleted or was never collected.
    INSERT INTO window_title_redactions(session_id,redacted_at,reason)
      SELECT DISTINCT b.session_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'legacy-null'
      FROM blocks b WHERE b.session_id IS NOT NULL AND (
        EXISTS (SELECT 1 FROM window_activity w WHERE w.block_id=b.id AND w.window_title IS NULL) OR
        EXISTS (SELECT 1 FROM distractions d WHERE d.block_id=b.id AND d.source='auto' AND d.window_title IS NULL));
    INSERT INTO window_title_redactions(block_id,redacted_at,reason)
      SELECT b.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'legacy-null'
      FROM blocks b WHERE b.session_id IS NULL AND (
        EXISTS (SELECT 1 FROM window_activity w WHERE w.block_id=b.id AND w.window_title IS NULL) OR
        EXISTS (SELECT 1 FROM distractions d WHERE d.block_id=b.id AND d.source='auto' AND d.window_title IS NULL));`
  }
]
