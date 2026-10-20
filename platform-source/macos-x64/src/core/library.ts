// Library structure: category > sub-category > subject, two category levels only.
import type { Category, Id, Item, ItemStats, LibraryStats } from './types'

/** Only top-level categories may hold sub-categories. */
export function canHoldSubcategories(c: Pick<Category, 'parentId'>): boolean {
  return c.parentId === null
}

/**
 * Why a category cannot move under `newParentId`, or null if it can.
 * Rules: the parent must exist and be top level, a category cannot be its
 * own parent, and a category that has sub-categories must stay top level
 * (otherwise its children would sit three levels deep).
 */
export function categoryMoveError(categories: Category[], movingId: Id, newParentId: Id | null): string | null {
  if (newParentId === null) return null
  if (newParentId === movingId) return 'A category cannot be inside itself.'
  const parent = categories.find((c) => c.id === newParentId)
  if (!parent) return 'That category does not exist.'
  if (!canHoldSubcategories(parent)) return 'Sub-categories cannot hold sub-categories.'
  if (categories.some((c) => c.parentId === movingId)) {
    return 'This category has sub-categories, so it has to stay at the top level.'
  }
  return null
}

/** The category and, for a sub-category, its parent: ["University", "Year 3"]. */
export function categoryPath(categories: Category[], id: Id): Category[] {
  const c = categories.find((x) => x.id === id)
  if (!c) return []
  if (c.parentId === null) return [c]
  const parent = categories.find((x) => x.id === c.parentId)
  return parent ? [parent, c] : [c]
}

export function categoryPathLabel(categories: Category[], id: Id): string {
  return categoryPath(categories, id)
    .map((c) => c.name)
    .join(' › ')
}

/** Ids of a category and its sub-categories. */
export function categoryAndChildren(categories: Category[], id: Id): Id[] {
  return [id, ...categories.filter((c) => c.parentId === id).map((c) => c.id)]
}

export interface CategoryTotals extends LibraryStats {
  /** Active subjects in the category and its sub-categories. */
  subjects: number
}

/**
 * Totals per category, rolled up: a top-level category includes everything
 * in its sub-categories. Archived subjects count toward time (it was studied)
 * but not toward the subject count.
 */
export function rollUpTotals(categories: Category[], items: Item[], stats: ItemStats[]): Map<Id, CategoryTotals> {
  const byItem = new Map(stats.map((s) => [s.itemId, s]))
  const out = new Map<Id, CategoryTotals>()
  for (const c of categories) {
    const ids = new Set(categoryAndChildren(categories, c.id))
    const t: CategoryTotals = { focusSeconds: 0, blocks: 0, lastStudiedAt: null, subjects: 0 }
    for (const item of items) {
      if (!ids.has(item.categoryId)) continue
      if (!item.archived) t.subjects++
      const s = byItem.get(item.id)
      if (!s) continue
      t.focusSeconds += s.focusSeconds
      t.blocks += s.blocks
      if (s.lastStudiedAt && (!t.lastStudiedAt || s.lastStudiedAt > t.lastStudiedAt)) t.lastStudiedAt = s.lastStudiedAt
    }
    out.set(c.id, t)
  }
  return out
}

/** Categories and sub-categories in display order, for "Move to" and pickers. */
export function categoryTree(categories: Category[], includeArchived = false): { category: Category; depth: 0 | 1 }[] {
  const visible = categories.filter((c) => includeArchived || !c.archived)
  const order = (a: Category, b: Category): number => a.sortOrder - b.sortOrder || a.id - b.id
  const out: { category: Category; depth: 0 | 1 }[] = []
  for (const top of visible.filter((c) => c.parentId === null).sort(order)) {
    out.push({ category: top, depth: 0 })
    for (const sub of visible.filter((c) => c.parentId === top.id).sort(order)) out.push({ category: sub, depth: 1 })
  }
  return out
}

/**
 * Order for subject tiles and pickers: pinned first; within each group the
 * most recently studied first; never-studied ones after, by name.
 */
export function orderSubjects<T extends { name: string; pinned: boolean; lastUsedAt: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (a.lastUsedAt && b.lastUsedAt) return a.lastUsedAt < b.lastUsedAt ? 1 : a.lastUsedAt > b.lastUsedAt ? -1 : 0
    if (a.lastUsedAt !== b.lastUsedAt) return a.lastUsedAt ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}
