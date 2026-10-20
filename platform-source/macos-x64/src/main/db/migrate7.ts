// Migration 7: the after-block log becomes data (groups, fields, options,
// answers). Existing answers in block_logs move into block_log_values.
import {
  SEED_GROUPS,
  difficultyFromOld,
  optionId,
  seedOptions,
  uniqueOptionId,
  type FieldOption,
  type ProgressValue
} from '@core/logfields'
import type Database from 'better-sqlite3'

const SCHEMA = /* sql */ `
  CREATE TABLE log_groups (
    id          INTEGER PRIMARY KEY,
    key         TEXT UNIQUE,
    name        TEXT    NOT NULL,
    section     TEXT    NOT NULL CHECK (section IN ('quick', 'setup', 'detail')),
    sort_order  INTEGER NOT NULL,
    archived    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE log_fields (
    id          INTEGER PRIMARY KEY,
    key         TEXT UNIQUE,
    group_id    INTEGER NOT NULL REFERENCES log_groups(id),
    label       TEXT    NOT NULL,
    type        TEXT    NOT NULL
                CHECK (type IN ('single', 'multi', 'scale', 'slider', 'number', 'text', 'activity', 'progress')),
    options     TEXT    NOT NULL DEFAULT '[]',
    scale       TEXT,
    -- Mirrors the group's section so a field can be read on its own.
    is_setup    INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL,
    archived    INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX log_fields_group ON log_fields(group_id);

  CREATE TABLE block_log_values (
    block_id  INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    field_id  INTEGER NOT NULL REFERENCES log_fields(id),
    value     TEXT    NOT NULL,
    PRIMARY KEY (block_id, field_id)
  );
  CREATE INDEX block_log_values_field ON block_log_values(field_id);

  CREATE TABLE block_group_notes (
    block_id  INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    group_id  INTEGER NOT NULL REFERENCES log_groups(id),
    note      TEXT    NOT NULL,
    PRIMARY KEY (block_id, group_id)
  );
`

/** The answers the rest of the app reads often, as columns. */
export const CORE_VIEW = /* sql */ `
  CREATE VIEW block_log_core AS
  SELECT b.id AS block_id,
    (SELECT json_extract(v.value, '$') FROM block_log_values v JOIN log_fields f ON f.id = v.field_id
      WHERE v.block_id = b.id AND f.key = 'activity') AS activity_id,
    (SELECT CAST(json_extract(v.value, '$') AS REAL) FROM block_log_values v JOIN log_fields f ON f.id = v.field_id
      WHERE v.block_id = b.id AND f.key = 'focus') AS focus_rating,
    (SELECT CAST(json_extract(v.value, '$') AS REAL) FROM block_log_values v JOIN log_fields f ON f.id = v.field_id
      WHERE v.block_id = b.id AND f.key = 'difficulty') AS difficulty,
    (SELECT json_extract(v.value, '$.amount') FROM block_log_values v JOIN log_fields f ON f.id = v.field_id
      WHERE v.block_id = b.id AND f.key = 'progress') AS progress_amount,
    (SELECT json_extract(v.value, '$.unit') FROM block_log_values v JOIN log_fields f ON f.id = v.field_id
      WHERE v.block_id = b.id AND f.key = 'progress') AS progress_unit,
    (SELECT json_extract(v.value, '$.from') FROM block_log_values v JOIN log_fields f ON f.id = v.field_id
      WHERE v.block_id = b.id AND f.key = 'progress') AS progress_from,
    (SELECT json_extract(v.value, '$.to') FROM block_log_values v JOIN log_fields f ON f.id = v.field_id
      WHERE v.block_id = b.id AND f.key = 'progress') AS progress_to
  FROM blocks b;
`

/** Old free-text activity names to the new activity ids. */
const OLD_ACTIVITIES: Record<string, string> = {
  'reading book': 'reading-book',
  'reading pdf': 'reading-pdf',
  'watching lecture': 'lecture-recorded',
  'listening to lecture': 'listening',
  'writing notes': 'notes',
  'solving problems': 'problems',
  reviewing: 'reviewing',
  other: 'other'
}

const OLD_MUSIC: Record<string, string> = {
  none: 'silence',
  instrumental: 'instrumental',
  'with lyrics': 'music-with-lyrics',
  'noise or ambience': 'white-or-brown-noise'
}

export function migrate7(db: Database.Database): void {
  db.exec(SCHEMA)

  const insGroup = db.prepare('INSERT INTO log_groups (key, name, section, sort_order) VALUES (?, ?, ?, ?)')
  const insField = db.prepare(
    'INSERT INTO log_fields (key, group_id, label, type, options, scale, is_setup, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const fieldIds = new Map<string, number>()
  const fieldOptions = new Map<string, FieldOption[]>()
  SEED_GROUPS.forEach((g, gi) => {
    const groupId = Number(insGroup.run(g.key, g.name, g.section, gi).lastInsertRowid)
    g.fields.forEach((f, fi) => {
      const options = seedOptions(f.options)
      const id = Number(
        insField.run(f.key, groupId, f.label, f.type, JSON.stringify(options), f.scale ? JSON.stringify(f.scale) : null, g.section === 'setup' ? 1 : 0, fi)
          .lastInsertRowid
      )
      fieldIds.set(f.key, id)
      fieldOptions.set(f.key, options)
    })
  })

  // Move old answers. Options not in the new lists are added, never dropped.
  const hasOldTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'block_logs'").get()
  if (hasOldTable) {
    const insValue = db.prepare('INSERT OR REPLACE INTO block_log_values (block_id, field_id, value) VALUES (?, ?, ?)')
    const put = (blockId: number, key: string, value: unknown): void => {
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return
      insValue.run(blockId, fieldIds.get(key)!, JSON.stringify(value))
    }
    const optionFor = (key: string, label: string, mapped?: string): string => {
      const options = fieldOptions.get(key)!
      const id = mapped ?? optionId(label)
      if (options.some((o) => o.id === id)) return id
      const byLabel = options.find((o) => o.label.toLowerCase() === label.toLowerCase())
      if (byLabel) return byLabel.id
      const created = { id: uniqueOptionId(label, options), label: label.charAt(0).toUpperCase() + label.slice(1) }
      options.push(created)
      return created.id
    }

    const rows = db.prepare('SELECT * FROM block_logs').all() as Record<string, unknown>[]
    for (const r of rows) {
      const id = r.block_id as number
      const activity = r.activity_type as string | null
      if (activity) put(id, 'activity', optionFor('activity', activity, OLD_ACTIVITIES[activity.toLowerCase()]))
      if (r.progress_amount !== null || r.progress_from !== null || r.progress_to !== null) {
        const p: ProgressValue = {
          amount: r.progress_amount as number | null,
          unit: r.progress_unit as string | null,
          from: r.progress_from as number | null,
          to: r.progress_to as number | null
        }
        put(id, 'progress', p)
      }
      put(id, 'focus', r.focus_rating)
      if (r.difficulty_rating !== null) put(id, 'difficulty', difficultyFromOld(r.difficulty_rating as number))
      if (r.place) put(id, 'place', optionFor('place', r.place as string))
      if (r.posture) put(id, 'posture', optionFor('posture', r.posture as string))
      if (r.music) put(id, 'sound', optionFor('sound', r.music as string, OLD_MUSIC[(r.music as string).toLowerCase()]))
      const side = JSON.parse((r.side_activities as string) || '[]') as string[]
      put(id, 'side', side.map((s) => optionFor('side', s)))
      put(id, 'energy', r.energy)
      put(id, 'note', r.free_note)
      // The old 1-5 mood number has no place in the new mood words; it is kept in the note.
      if (r.mood !== null && r.mood !== undefined) {
        const note = [r.free_note, `Mood (old scale): ${r.mood} of 5`].filter(Boolean).join('\n')
        put(id, 'note', note)
      }
    }
    const updOptions = db.prepare('UPDATE log_fields SET options = ? WHERE key = ?')
    for (const [key, options] of fieldOptions) updOptions.run(JSON.stringify(options), key)
    db.exec('DROP TABLE block_logs')
  }

  db.exec(CORE_VIEW)
}
