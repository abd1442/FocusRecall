import {
  isEmptyValue,
  uniqueOptionId,
  type FieldOption,
  type FieldType,
  type FieldValue,
  type GroupNotes,
  type LogField,
  type LogGroup,
  type LogSchema,
  type LogValues,
  type ScaleConfig,
  type Section
} from '@core/logfields'
import type { DayAnswers } from '@core/api'
import type { Id } from '@core/types'
import type { Db } from '../db/database'

interface GroupRow {
  id: number
  key: string | null
  name: string
  section: Exclude<Section, 'day'>
  scope: 'day' | null
  sort_order: number
  archived: number
}

interface FieldRow {
  id: number
  key: string | null
  group_id: number
  label: string
  type: FieldType
  options: string
  scale: string | null
  sort_order: number
  archived: number
}

const toGroup = (r: GroupRow): LogGroup => ({
  id: r.id,
  key: r.key,
  name: r.name,
  section: r.scope === 'day' ? 'day' : r.section,
  sortOrder: r.sort_order,
  archived: r.archived === 1
})

const toField = (r: FieldRow): LogField => ({
  id: r.id,
  key: r.key,
  groupId: r.group_id,
  label: r.label,
  type: r.type,
  options: JSON.parse(r.options) as FieldOption[],
  scale: r.scale ? (JSON.parse(r.scale) as ScaleConfig) : null,
  sortOrder: r.sort_order,
  archived: r.archived === 1
})

const requireText = (s: string, what: string): string => {
  const t = s.trim()
  if (!t) throw new Error(`Give the ${what} a name.`)
  return t
}

/** Default scale for a new slider or named-scale field. */
const DEFAULT_SCALES: Partial<Record<FieldType, ScaleConfig>> = {
  scale: { min: 1, max: 5, labels: ['Very low', 'Low', 'Medium', 'High', 'Very high'] },
  slider: { min: 1, max: 10, labels: ['None', 'Low', 'Moderate', 'High', 'Very high'] }
}

/** The log schema (groups, fields, options) and the answers per block. */
export class LogRepo {
  constructor(private db: Db) {}

  schema(): LogSchema {
    return {
      groups: (this.db.prepare('SELECT * FROM log_groups ORDER BY sort_order, id').all() as GroupRow[]).map(toGroup),
      fields: (this.db.prepare('SELECT * FROM log_fields ORDER BY group_id, sort_order, id').all() as FieldRow[]).map(toField)
    }
  }

  /**
   * Add or rename a group, or change how often it is asked (its section:
   * per session, remembered setup, or per day). The quick groups stay quick.
   */
  saveGroup(g: { id?: Id; name: string; section?: Section }): LogGroup {
    const name = requireText(g.name, 'group')
    const stored = (s: Section | undefined): { section: Exclude<Section, 'day'>; scope: 'day' | null } =>
      s === 'day' ? { section: 'detail', scope: 'day' } : { section: s ?? 'detail', scope: null }
    let id = g.id
    if (id) {
      this.db.prepare('UPDATE log_groups SET name = ? WHERE id = ?').run(name, id)
      const current = this.db.prepare('SELECT section FROM log_groups WHERE id = ?').get(id) as { section: string } | undefined
      if (g.section && current && current.section !== 'quick' && g.section !== 'quick') {
        const st = stored(g.section)
        this.db.prepare('UPDATE log_groups SET section = ?, scope = ? WHERE id = ?').run(st.section, st.scope, id)
        this.db.prepare('UPDATE log_fields SET is_setup = ? WHERE group_id = ?').run(st.section === 'setup' ? 1 : 0, id)
      }
    } else {
      const { next } = this.db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM log_groups').get() as { next: number }
      const st = stored(g.section)
      id = Number(
        this.db.prepare('INSERT INTO log_groups (name, section, scope, sort_order) VALUES (?, ?, ?, ?)').run(name, st.section, st.scope, next).lastInsertRowid
      )
    }
    return toGroup(this.db.prepare('SELECT * FROM log_groups WHERE id = ?').get(id) as GroupRow)
  }

  saveField(f: { id?: Id; groupId: Id; label: string; type?: FieldType; scale?: ScaleConfig | null }): LogField {
    const label = requireText(f.label, 'field')
    let id = f.id
    if (id) {
      // Moving a question to another group also moves it to that group's scope.
      const group = this.db.prepare('SELECT section FROM log_groups WHERE id = ?').get(f.groupId) as { section: string } | undefined
      this.db.prepare('UPDATE log_fields SET label = ?, group_id = ?, is_setup = ? WHERE id = ?').run(label, f.groupId, group?.section === 'setup' ? 1 : 0, id)
      if (f.scale !== undefined) this.db.prepare('UPDATE log_fields SET scale = ? WHERE id = ?').run(f.scale ? JSON.stringify(f.scale) : null, id)
    } else {
      const type = f.type ?? 'single'
      if (type === 'activity' || type === 'progress') throw new Error('That field type is built in.')
      const group = this.db.prepare('SELECT section FROM log_groups WHERE id = ?').get(f.groupId) as { section: Section } | undefined
      if (!group) throw new Error('That group does not exist.')
      const { next } = this.db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM log_fields WHERE group_id = ?')
        .get(f.groupId) as { next: number }
      const scale = f.scale ?? DEFAULT_SCALES[type] ?? null
      id = Number(
        this.db
          .prepare('INSERT INTO log_fields (group_id, label, type, options, scale, is_setup, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(f.groupId, label, type, '[]', scale ? JSON.stringify(scale) : null, group.section === 'setup' ? 1 : 0, next).lastInsertRowid
      )
    }
    return toField(this.db.prepare('SELECT * FROM log_fields WHERE id = ?').get(id) as FieldRow)
  }

  /** Replace a field's option list (add, rename, reorder, archive are edits of this list). */
  saveOptions(fieldId: Id, options: FieldOption[]): void {
    const clean: FieldOption[] = []
    for (const o of options) {
      const label = o.label.trim()
      if (!label) continue
      clean.push({ ...o, label, id: o.id || uniqueOptionId(label, clean) })
    }
    this.db.prepare('UPDATE log_fields SET options = ? WHERE id = ?').run(JSON.stringify(clean), fieldId)
  }

  /** Add one option by label and return its id (used by "+ Add option" in the log). */
  addOption(fieldId: Id, label: string): string {
    const row = this.db.prepare('SELECT options FROM log_fields WHERE id = ?').get(fieldId) as { options: string } | undefined
    if (!row) throw new Error('That field does not exist.')
    const options = JSON.parse(row.options) as FieldOption[]
    const existing = options.find((o) => o.label.toLowerCase() === label.trim().toLowerCase())
    if (existing) {
      if (existing.archived) {
        existing.archived = false
        this.saveOptions(fieldId, options)
      }
      return existing.id
    }
    const opt = { id: uniqueOptionId(requireText(label, 'option'), options), label: label.trim() }
    this.saveOptions(fieldId, [...options, opt])
    return opt.id
  }

  setArchived(kind: 'group' | 'field', id: Id, archived: boolean): void {
    const table = kind === 'group' ? 'log_groups' : 'log_fields'
    this.db.prepare(`UPDATE ${table} SET archived = ? WHERE id = ?`).run(archived ? 1 : 0, id)
  }

  reorder(kind: 'group' | 'field', orderedIds: Id[]): void {
    const table = kind === 'group' ? 'log_groups' : 'log_fields'
    const stmt = this.db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`)
    this.db.transaction(() => orderedIds.forEach((id, i) => stmt.run(i, id)))()
  }

  // --- answers ---------------------------------------------------------------

  values(blockId: Id): { values: LogValues; notes: GroupNotes; untouched: number[] } {
    const values: LogValues = {}
    const untouched: number[] = []
    for (const r of this.db.prepare('SELECT field_id, value, touched FROM block_log_values WHERE block_id = ?').all(blockId) as {
      field_id: number
      value: string
      touched: number
    }[]) {
      values[r.field_id] = JSON.parse(r.value) as FieldValue
      if (!r.touched) untouched.push(r.field_id)
    }
    const notes: GroupNotes = {}
    for (const r of this.db.prepare('SELECT group_id, note FROM block_group_notes WHERE block_id = ?').all(blockId) as {
      group_id: number
      note: string
    }[]) {
      notes[r.group_id] = r.note
    }
    return { values, notes, untouched }
  }

  /** All answers and notes, grouped by block, for History. */
  allValues(): Map<Id, { values: LogValues; notes: GroupNotes; untouched: number[] }> {
    const out = new Map<Id, { values: LogValues; notes: GroupNotes; untouched: number[] }>()
    const get = (id: Id): { values: LogValues; notes: GroupNotes; untouched: number[] } => {
      let e = out.get(id)
      if (!e) out.set(id, (e = { values: {}, notes: {}, untouched: [] }))
      return e
    }
    for (const r of this.db.prepare('SELECT block_id, field_id, value, touched FROM block_log_values').all() as {
      block_id: number
      field_id: number
      value: string
      touched: number
    }[]) {
      get(r.block_id).values[r.field_id] = JSON.parse(r.value) as FieldValue
      if (!r.touched) get(r.block_id).untouched.push(r.field_id)
    }
    for (const r of this.db.prepare('SELECT block_id, group_id, note FROM block_group_notes').all() as {
      block_id: number
      group_id: number
      note: string
    }[]) {
      get(r.block_id).notes[r.group_id] = r.note
    }
    return out
  }

  /** Replace a block's answers and notes, and mark its log done. `untouched`: sliders left at their default. */
  saveValues(blockId: Id, values: LogValues, notes: GroupNotes, untouched: number[] = []): void {
    const left = new Set(untouched)
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM block_log_values WHERE block_id = ?').run(blockId)
      this.db.prepare('DELETE FROM block_group_notes WHERE block_id = ?').run(blockId)
      const insV = this.db.prepare('INSERT INTO block_log_values (block_id, field_id, value, touched) VALUES (?, ?, ?, ?)')
      for (const [fieldId, v] of Object.entries(values)) {
        if (!isEmptyValue(v)) insV.run(blockId, Number(fieldId), JSON.stringify(v), left.has(Number(fieldId)) ? 0 : 1)
      }
      const insN = this.db.prepare('INSERT INTO block_group_notes (block_id, group_id, note) VALUES (?, ?, ?)')
      for (const [groupId, note] of Object.entries(notes)) {
        if (note.trim()) insN.run(blockId, Number(groupId), note.trim())
      }
      this.db.prepare("UPDATE blocks SET log_status = 'done' WHERE id = ?").run(blockId)
    })()
  }

  // --- the daily check-in --------------------------------------------------------

  /** A study day's answers, and whether its check-in was answered or skipped. */
  day(day: string): DayAnswers {
    const values: LogValues = {}
    const untouched: number[] = []
    for (const r of this.db.prepare('SELECT field_id, value, touched FROM day_log_values WHERE day = ?').all(day) as { field_id: number; value: string; touched: number }[]) {
      values[r.field_id] = JSON.parse(r.value) as FieldValue
      if (!r.touched) untouched.push(r.field_id)
    }
    const notes: GroupNotes = {}
    for (const r of this.db.prepare('SELECT group_id, note FROM day_group_notes WHERE day = ?').all(day) as { group_id: number; note: string }[]) {
      notes[r.group_id] = r.note
    }
    const row = this.db.prepare('SELECT skipped FROM day_checkins WHERE day = ?').get(day) as { skipped: number } | undefined
    return { day, values, notes, untouched, done: !!row, skipped: row?.skipped === 1 }
  }

  /** Replace a study day's answers; they apply to every session of that day. */
  saveDay(day: string, values: LogValues, notes: GroupNotes, untouched: number[] = []): void {
    const left = new Set(untouched)
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM day_log_values WHERE day = ?').run(day)
      this.db.prepare('DELETE FROM day_group_notes WHERE day = ?').run(day)
      const insV = this.db.prepare('INSERT INTO day_log_values (day, field_id, value, touched) VALUES (?, ?, ?, ?)')
      for (const [fieldId, v] of Object.entries(values)) if (!isEmptyValue(v)) insV.run(day, Number(fieldId), JSON.stringify(v), left.has(Number(fieldId)) ? 0 : 1)
      const insN = this.db.prepare('INSERT INTO day_group_notes (day, group_id, note) VALUES (?, ?, ?)')
      for (const [groupId, note] of Object.entries(notes)) if (note.trim()) insN.run(day, Number(groupId), note.trim())
      this.markDay(day, false)
    })()
  }

  /** Skip today's check-in: the card folds away until tomorrow. */
  skipDay(day: string): void {
    this.markDay(day, true)
  }

  private markDay(day: string, skipped: boolean): void {
    this.db
      .prepare('INSERT INTO day_checkins (day, skipped, updated_at) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET skipped = excluded.skipped, updated_at = excluded.updated_at')
      .run(day, skipped ? 1 : 0, new Date().toISOString())
  }

  /** Answers of the most recent logged block on a subject, for pre-filling. */
  previous(itemId: Id, excludeBlockId: Id): LogValues | null {
    const row = this.db
      .prepare(
        `SELECT b.id FROM blocks b
         WHERE b.item_id = ? AND b.id <> ? AND EXISTS (SELECT 1 FROM block_log_values v WHERE v.block_id = b.id)
         ORDER BY b.focus_started_at DESC LIMIT 1`
      )
      .get(itemId, excludeBlockId) as { id: number } | undefined
    const out=row?this.values(row.id).values:{}
    // The compact log may omit a question for many sessions. Retain its last
    // explicit structured detail answer rather than forgetting it after one skip.
    const remembered=this.db.prepare(`SELECT v.field_id,v.value FROM block_log_values v
      JOIN blocks b ON b.id=v.block_id JOIN log_fields f ON f.id=v.field_id JOIN log_groups g ON g.id=f.group_id
      WHERE b.item_id=? AND b.id<>? AND b.log_status='done' AND v.touched=1
      AND g.section='detail' AND g.scope IS NULL AND g.archived=0 AND f.archived=0 AND f.type NOT IN ('text','progress')
      ORDER BY b.focus_started_at DESC,b.id DESC`).all(itemId,excludeBlockId) as {field_id:number;value:string}[]
    const seen=new Set<number>()
    for(const v of remembered)if(!seen.has(v.field_id)){out[v.field_id]=JSON.parse(v.value) as FieldValue;seen.add(v.field_id)}
    return Object.keys(out).length?out:null
  }

  /** Saved activities on one subject, newest first, counted once per session. */
  activityHistory(itemId: Id): string[] {
    // Count a subject's activity once per session, even when it has several parts.
    const rows = this.db.prepare(
      `SELECT v.value FROM block_log_values v
       JOIN log_fields f ON f.id = v.field_id JOIN blocks b ON b.id = v.block_id
       WHERE b.item_id = ? AND b.log_status = 'done' AND f.key = 'activity'
       GROUP BY COALESCE(b.session_id, b.id), v.value
       ORDER BY MAX(b.focus_started_at) DESC, MAX(b.id) DESC`
    ).all(itemId) as { value: string }[]
    return rows.map((r) => JSON.parse(r.value) as unknown).filter((v): v is string => typeof v === 'string')
  }

  /** Study-setup answers of recent logged blocks, newest first. */
  setupHistory(limit = 40): LogValues[] {
    const blocks = this.db
      .prepare(
        `SELECT DISTINCT b.id, b.focus_started_at FROM blocks b
         JOIN block_log_values v ON v.block_id = b.id
         JOIN log_fields f ON f.id = v.field_id
         WHERE f.is_setup = 1
         ORDER BY b.focus_started_at DESC LIMIT ?`
      )
      .all(limit) as { id: number }[]
    const stmt = this.db.prepare(
      `SELECT v.field_id, v.value FROM block_log_values v JOIN log_fields f ON f.id = v.field_id
       WHERE v.block_id = ? AND f.is_setup = 1`
    )
    return blocks.map((b) => {
      const out: LogValues = {}
      for (const r of stmt.all(b.id) as { field_id: number; value: string }[]) out[r.field_id] = JSON.parse(r.value) as FieldValue
      return out
    })
  }
}
