import { describe, expect, it } from 'vitest'
import { categoryMoveError, categoryPathLabel, categoryTree, orderSubjects, rollUpTotals } from './library'
import type { Category, Item, ItemStats } from './types'

const cat = (id: number, name: string, parentId: number | null = null, sortOrder = id, archived = false): Category => ({
  id,
  parentId,
  name,
  color: '#888888',
  icon: null,
  sortOrder,
  archived,
  createdAt: '2026-01-01T00:00:00.000Z'
})

const item = (id: number, categoryId: number, archived = false): Item => ({
  id,
  categoryId,
  name: `Item ${id}`,
  color: '#888888',
  defaultUnit: 'pages',
  totalUnits: null,
  notesTargetType: 'none',
  notesTarget: null,
  notesVault: null,
  pinned: false,
  archived,
  createdAt: '2026-01-01T00:00:00.000Z',
  priorKnowledge: null,
  buildsOn: [],
  hoursBefore: 0,
  newField: null
})

// University (1) > Year 3 (2); Books (3); Online (4) > Python (5)
const cats = [cat(1, 'University'), cat(2, 'Year 3', 1), cat(3, 'Books'), cat(4, 'Online'), cat(5, 'Python', 4)]

describe('categoryMoveError (two levels only)', () => {
  it('allows moving to the top level and under a top-level category', () => {
    expect(categoryMoveError(cats, 2, null)).toBeNull()
    expect(categoryMoveError(cats, 2, 3)).toBeNull()
    expect(categoryMoveError(cats, 3, 1)).toBeNull()
  })
  it('refuses a sub-category as parent (would be three levels)', () => {
    expect(categoryMoveError(cats, 3, 2)).toMatch(/cannot hold/)
  })
  it('refuses moving a category that has sub-categories under another', () => {
    expect(categoryMoveError(cats, 1, 3)).toMatch(/top level/)
  })
  it('refuses itself and unknown parents', () => {
    expect(categoryMoveError(cats, 3, 3)).toMatch(/itself/)
    expect(categoryMoveError(cats, 3, 99)).toMatch(/exist/)
  })
})

describe('categoryPathLabel', () => {
  it('names the parent for a sub-category', () => {
    expect(categoryPathLabel(cats, 2)).toBe('University › Year 3')
    expect(categoryPathLabel(cats, 3)).toBe('Books')
  })
})

describe('rollUpTotals', () => {
  const items = [item(10, 1), item(11, 2), item(12, 2, true), item(13, 3), item(14, 5)]
  const stats: ItemStats[] = [
    { itemId: 10, focusSeconds: 600, blocks: 1, lastStudiedAt: '2026-10-01T10:00:00.000Z', progress: 0 },
    { itemId: 11, focusSeconds: 1500, blocks: 2, lastStudiedAt: '2026-10-05T10:00:00.000Z', progress: 0 },
    { itemId: 12, focusSeconds: 300, blocks: 1, lastStudiedAt: '2026-09-01T10:00:00.000Z', progress: 0 },
    { itemId: 14, focusSeconds: 900, blocks: 1, lastStudiedAt: '2026-10-09T10:00:00.000Z', progress: 0 }
  ]
  const totals = rollUpTotals(cats, items, stats)

  it('rolls sub-category totals up into the parent', () => {
    expect(totals.get(1)).toEqual({ focusSeconds: 2400, blocks: 4, lastStudiedAt: '2026-10-05T10:00:00.000Z', subjects: 2 })
    expect(totals.get(2)).toEqual({ focusSeconds: 1800, blocks: 3, lastStudiedAt: '2026-10-05T10:00:00.000Z', subjects: 1 })
    expect(totals.get(4)?.focusSeconds).toBe(900)
  })
  it('counts archived subjects in time but not in the subject count', () => {
    expect(totals.get(2)?.subjects).toBe(1)
    expect(totals.get(2)?.focusSeconds).toBe(1800)
  })
  it('handles categories with no study yet', () => {
    expect(totals.get(3)).toEqual({ focusSeconds: 0, blocks: 0, lastStudiedAt: null, subjects: 1 })
  })
})

describe('categoryTree', () => {
  it('lists each top-level category followed by its sub-categories', () => {
    expect(categoryTree(cats).map((n) => [n.category.name, n.depth])).toEqual([
      ['University', 0],
      ['Year 3', 1],
      ['Books', 0],
      ['Online', 0],
      ['Python', 1]
    ])
  })
  it('hides archived categories unless asked', () => {
    const withArchived = [...cats, cat(6, 'Old', null, 0, true)]
    expect(categoryTree(withArchived).some((n) => n.category.name === 'Old')).toBe(false)
    expect(categoryTree(withArchived, true)[0].category.name).toBe('Old')
  })
})

describe('orderSubjects', () => {
  it('puts pinned subjects first, then most recently studied, then by name', () => {
    const rows = [
      { id: 1, name: 'Beta', pinned: false, lastUsedAt: '2026-10-01T10:00:00.000Z' },
      { id: 2, name: 'Alpha', pinned: false, lastUsedAt: null },
      { id: 3, name: 'Gamma', pinned: true, lastUsedAt: null },
      { id: 4, name: 'Delta', pinned: false, lastUsedAt: '2026-10-05T10:00:00.000Z' },
      { id: 5, name: 'Aardvark', pinned: true, lastUsedAt: '2026-09-01T10:00:00.000Z' },
      { id: 6, name: 'Zeta', pinned: false, lastUsedAt: null }
    ]
    expect(orderSubjects(rows).map((r) => r.id)).toEqual([5, 3, 4, 1, 2, 6])
  })
})
