import { categoryMoveError, categoryPathLabel } from '@core/library'
import type { Category, CategoryInput, Id, Item, ItemInput, ItemResource, ItemStats, PickerItem } from '@core/types'
import type { Db } from '../db/database'

interface CategoryRow {
  id: number
  parent_id: number | null
  icon: string | null
  name: string
  color: string
  sort_order: number
  archived: number
  created_at: string
}

interface ItemRow {
  id: number
  category_id: number
  name: string
  color: string
  default_unit: string
  total_units: number | null
  notes_target_type: Item['notesTargetType']
  notes_target: string | null
  notes_vault: string | null
  pinned: number
  archived: number
  created_at: string
  prior_knowledge: Item['priorKnowledge']
  hours_before: number
  new_field: number | null
}

const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  parentId: r.parent_id,
  name: r.name,
  color: r.color,
  icon: r.icon,
  sortOrder: r.sort_order,
  archived: r.archived === 1,
  createdAt: r.created_at
})

const toItem = (r: ItemRow, buildsOn: Id[] = []): Item => ({
  id: r.id,
  categoryId: r.category_id,
  name: r.name,
  color: r.color,
  defaultUnit: r.default_unit,
  totalUnits: r.total_units,
  notesTargetType: r.notes_target_type,
  notesTarget: r.notes_target,
  notesVault: r.notes_vault,
  pinned: r.pinned === 1,
  archived: r.archived === 1,
  createdAt: r.created_at,
  priorKnowledge: r.prior_knowledge ?? null,
  buildsOn,
  hoursBefore: r.hours_before ?? 0,
  newField: r.new_field === null || r.new_field === undefined ? null : r.new_field === 1
})

function requireName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required.')
  return trimmed
}

export class LibraryRepo {
  constructor(private db: Db) {}

  listCategories(includeArchived: boolean): Category[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM categories ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY sort_order, id`
      )
      .all() as CategoryRow[]
    return rows.map(toCategory)
  }

  getCategory(id: Id): Category {
    const row = this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow | undefined
    if (!row) throw new Error(`Category ${id} not found.`)
    return toCategory(row)
  }

  createCategory(input: CategoryInput): Category {
    if (input.parentId !== null) {
      const err = categoryMoveError(this.listCategories(true), -1, input.parentId)
      if (err) throw new Error(err)
    }
    const { next } = this.db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories')
      .get() as { next: number }
    const info = this.db
      .prepare('INSERT INTO categories (name, color, icon, parent_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(requireName(input.name), input.color, input.icon || null, input.parentId, next, new Date().toISOString())
    return this.getCategory(Number(info.lastInsertRowid))
  }

  /** Rename, recolour or re-icon. Moving uses moveCategory. */
  updateCategory(id: Id, input: CategoryInput): Category {
    this.db
      .prepare('UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?')
      .run(requireName(input.name), input.color, input.icon || null, id)
    return this.getCategory(id)
  }

  /** Move a category to the top level (null) or under a top-level category. */
  moveCategory(id: Id, parentId: Id | null): void {
    const err = categoryMoveError(this.listCategories(true), id, parentId)
    if (err) throw new Error(err)
    this.db.prepare('UPDATE categories SET parent_id = ? WHERE id = ?').run(parentId, id)
  }

  moveItem(itemId: Id, categoryId: Id): void {
    this.getCategory(categoryId)
    this.db.prepare('UPDATE items SET category_id = ? WHERE id = ?').run(categoryId, itemId)
  }

  /** Time studied, blocks, last studied and logged progress per item. */
  itemStats(): ItemStats[] {
    const rows = this.db
      .prepare(
        `SELECT i.id AS item_id,
                COALESCE(SUM(b.focus_seconds), 0) AS focus_seconds,
                COUNT(DISTINCT b.session_id) AS blocks,
                MAX(b.focus_started_at) AS last_studied_at,
                COALESCE(SUM(CASE WHEN l.progress_unit = i.default_unit AND EXISTS (SELECT 1 FROM block_log_values v JOIN log_fields f ON f.id=v.field_id WHERE v.block_id=b.id AND f.key='progress' AND v.touched=1) THEN l.progress_amount END), 0) AS progress
         FROM items i
         LEFT JOIN blocks b ON b.item_id = i.id AND b.focus_ended_at IS NOT NULL
         LEFT JOIN block_log_core l ON l.block_id = b.id
         GROUP BY i.id`
      )
      .all() as { item_id: number; focus_seconds: number; blocks: number; last_studied_at: string | null; progress: number }[]
    return rows.map((r) => ({
      itemId: r.item_id,
      focusSeconds: r.focus_seconds,
      blocks: r.blocks,
      lastStudiedAt: r.last_studied_at,
      progress: r.progress
    }))
  }

  setCategoryArchived(id: Id, archived: boolean): void {
    this.db.prepare('UPDATE categories SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id)
  }

  /** Delete the grouping only; never delete subjects or their study records. */
  deleteCategory(id: Id): void {
    this.db.transaction(() => {
      const category = this.getCategory(id)
      const count = this.db.prepare('SELECT COUNT(*) AS n FROM items WHERE category_id = ?').get(id) as { n: number }
      if (count.n > 0) {
        let destination = category.parentId
        if (destination === null) {
          const existing = this.listCategories(true).find(c => c.id !== id && c.parentId === null && c.name === 'Uncategorised' && !c.archived)
          destination = existing?.id ?? this.createCategory({ name: 'Uncategorised', color: category.color, icon: null, parentId: null }).id
        }
        this.db.prepare('UPDATE items SET category_id = ? WHERE category_id = ?').run(destination, id)
      }
      this.db.prepare('UPDATE categories SET parent_id = ? WHERE parent_id = ?').run(category.parentId, id)
      this.db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    })()
  }

  reorderCategories(orderedIds: Id[]): void {
    const stmt = this.db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?')
    this.db.transaction(() => orderedIds.forEach((id, i) => stmt.run(i, id)))()
  }

  listItems(filter: { categoryId?: Id; includeArchived: boolean }): Item[] {
    const where: string[] = []
    const params: unknown[] = []
    if (filter.categoryId !== undefined) {
      where.push('category_id = ?')
      params.push(filter.categoryId)
    }
    if (!filter.includeArchived) where.push('archived = 0')
    const sql = `SELECT * FROM items ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name COLLATE NOCASE`
    const links = this.buildsOnMap()
    return (this.db.prepare(sql).all(...params) as ItemRow[]).map((r) => toItem(r, links.get(r.id)))
  }

  /** Active items in active categories, most recently studied first, then by name. */
  listPickerItems(): PickerItem[] {
    const rows = this.db
      .prepare(
        `SELECT i.*, c.name AS category_name, MAX(b.focus_started_at) AS last_used_at
         FROM items i
         JOIN categories c ON c.id = i.category_id
         LEFT JOIN categories p ON p.id = c.parent_id
         LEFT JOIN blocks b ON b.item_id = i.id
         WHERE i.archived = 0 AND c.archived = 0 AND COALESCE(p.archived, 0) = 0
         GROUP BY i.id
         ORDER BY i.pinned DESC, last_used_at IS NULL, last_used_at DESC, i.name COLLATE NOCASE`
      )
      .all() as (ItemRow & { category_name: string; last_used_at: string | null })[]
    const categories = this.listCategories(true)
    return rows.map((r) => ({
      ...toItem(r),
      categoryName: categoryPathLabel(categories, r.category_id) || r.category_name,
      lastUsedAt: r.last_used_at
    }))
  }

  getItem(id: Id): Item {
    const row = this.db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined
    if (!row) throw new Error(`Item ${id} not found.`)
    return toItem(row, this.buildsOnMap().get(id))
  }

  createItem(input: ItemInput): Item {
    return this.db.transaction(() => {
    const info = this.db
      .prepare(
        `INSERT INTO items (category_id, name, color, default_unit, total_units,
           notes_target_type, notes_target, notes_vault, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...this.itemParams(input), new Date().toISOString())
    const id = Number(info.lastInsertRowid)
    this.saveLearning(id, input)
    return this.getItem(id)
    })()
  }

  /** Learning-stage details: only the ones given are written. */
  private saveLearning(id: Id, input: ItemInput): void {
    if (input.priorKnowledge !== undefined) this.db.prepare('UPDATE items SET prior_knowledge = ? WHERE id = ?').run(input.priorKnowledge, id)
    if (input.hoursBefore !== undefined)
      this.db.prepare('UPDATE items SET hours_before = ? WHERE id = ?').run(Math.max(0, Number(input.hoursBefore) || 0), id)
    if (input.newField !== undefined) this.db.prepare('UPDATE items SET new_field = ? WHERE id = ?').run(input.newField === null ? null : input.newField ? 1 : 0, id)
    if (input.buildsOn !== undefined) {
      this.db.prepare('DELETE FROM item_builds_on WHERE item_id = ?').run(id)
      const ins = this.db.prepare('INSERT OR IGNORE INTO item_builds_on (item_id, builds_on) VALUES (?, ?)')
      for (const other of input.buildsOn) if (other !== id) {
        this.getItem(other)
        ins.run(id, other)
      }
    }
  }

  private buildsOnMap(): Map<Id, Id[]> {
    const out = new Map<Id, Id[]>()
    for (const r of this.db.prepare('SELECT item_id, builds_on FROM item_builds_on').all() as { item_id: number; builds_on: number }[]) {
      out.set(r.item_id, [...(out.get(r.item_id) ?? []), r.builds_on])
    }
    return out
  }

  updateItem(id: Id, input: ItemInput): Item {
    return this.db.transaction(() => {
    this.getItem(id)
    this.db
      .prepare(
        `UPDATE items SET category_id = ?, name = ?, color = ?, default_unit = ?, total_units = ?,
           notes_target_type = ?, notes_target = ?, notes_vault = ?
         WHERE id = ?`
      )
      .run(...this.itemParams(input), id)
    this.saveLearning(id, input)
    return this.getItem(id)
    })()
  }

  setItemPinned(id: Id, pinned: boolean): void {
    this.db.prepare('UPDATE items SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id)
  }

  listResources(itemId: Id): ItemResource[] {
    return (
      this.db
        .prepare('SELECT * FROM item_resources WHERE item_id = ? ORDER BY sort_order, id')
        .all(itemId) as { id: number; item_id: number; title: string; target: string; sort_order: number }[]
    ).map((r) => ({ id: r.id, itemId: r.item_id, title: r.title, target: r.target, sortOrder: r.sort_order }))
  }

  saveResource(r: { id?: Id; itemId: Id; title: string; target: string }): void {
    const title = requireName(r.title)
    const target = r.target.trim()
    if (!target) throw new Error('Add a link or a file path.')
    if (r.id) {
      this.db.prepare('UPDATE item_resources SET title = ?, target = ? WHERE id = ?').run(title, target, r.id)
    } else {
      const { next } = this.db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM item_resources WHERE item_id = ?')
        .get(r.itemId) as { next: number }
      this.db
        .prepare('INSERT INTO item_resources (item_id, title, target, sort_order) VALUES (?, ?, ?, ?)')
        .run(r.itemId, title, target, next)
    }
  }

  deleteResource(id: Id): void {
    this.db.prepare('DELETE FROM item_resources WHERE id = ?').run(id)
  }

  reorderResources(orderedIds: Id[]): void {
    const stmt = this.db.prepare('UPDATE item_resources SET sort_order = ? WHERE id = ?')
    this.db.transaction(() => orderedIds.forEach((id, i) => stmt.run(i, id)))()
  }

  setItemArchived(id: Id, archived: boolean): void {
    this.db.prepare('UPDATE items SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id)
  }

  private itemParams(input: ItemInput): unknown[] {
    const unit = input.defaultUnit.trim() || 'pages'
    const total = input.totalUnits !== null && input.totalUnits > 0 ? input.totalUnits : null
    const type = input.notesTargetType
    return [
      input.categoryId,
      requireName(input.name),
      input.color,
      unit,
      total,
      type,
      type === 'none' ? null : input.notesTarget?.trim() || null,
      type === 'obsidian' ? input.notesVault?.trim() || null : null
    ]
  }
}
