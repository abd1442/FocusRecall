import { create } from 'zustand'
import type { Category, CategoryInput, Id, Item, ItemInput, ItemStats } from '@core/types'

const api = window.api

interface LibraryState {
  categories: Category[]
  items: Item[]
  stats: Map<Id, ItemStats>
  loaded: boolean
  refresh: () => Promise<void>
  createCategory: (input: CategoryInput) => Promise<Category>
  updateCategory: (id: Id, input: CategoryInput) => Promise<void>
  setCategoryArchived: (id: Id, archived: boolean) => Promise<void>
  deleteCategory: (id: Id) => Promise<void>
  /** Swap with the neighbouring sibling among `siblingIds` (the visible order). */
  moveCategoryInOrder: (id: Id, direction: -1 | 1, siblingIds: Id[]) => Promise<void>
  moveCategory: (id: Id, parentId: Id | null) => Promise<void>
  createItem: (input: ItemInput) => Promise<Item>
  updateItem: (id: Id, input: ItemInput) => Promise<void>
  setItemArchived: (id: Id, archived: boolean) => Promise<void>
  moveItem: (itemId: Id, categoryId: Id) => Promise<void>
}

/** Holds every category and item, archived included, plus study totals; views filter. */
export const useLibrary = create<LibraryState>((set, get) => {
  let request=0
  const after = async <T>(p: Promise<T>): Promise<T> => {
    const r = await p
    await get().refresh()
    return r
  }
  return {
    categories: [],
    items: [],
    stats: new Map(),
    loaded: false,

    refresh: async () => {
      const current=++request
      const [categories, items, stats] = await Promise.all([
        api.invoke('library:listCategories', true),
        api.invoke('library:listItems', { includeArchived: true }),
        api.invoke('library:itemStats')
      ])
      if(current===request)set({ categories, items, stats: new Map(stats.map((s) => [s.itemId, s])), loaded: true })
    },

    createCategory: (input) => after(api.invoke('library:createCategory', input)),
    updateCategory: async (id, input) => void (await after(api.invoke('library:updateCategory', id, input))),
    setCategoryArchived: async (id, archived) => void (await after(api.invoke('library:setCategoryArchived', id, archived))),
    deleteCategory: async (id) => void (await after(api.invoke('library:deleteCategory', id))),
    moveCategoryInOrder: async (id, direction, siblingIds) => {
      const ids = get()
        .categories.slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
        .map((c) => c.id)
      const v = siblingIds.indexOf(id)
      const w = v + direction
      if (v < 0 || w < 0 || w >= siblingIds.length) return
      const i = ids.indexOf(id)
      const j = ids.indexOf(siblingIds[w])
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
      await after(api.invoke('library:reorderCategories', ids))
    },
    moveCategory: async (id, parentId) => void (await after(api.invoke('library:moveCategory', id, parentId))),

    createItem: (input) => after(api.invoke('library:createItem', input)),
    updateItem: async (id, input) => void (await after(api.invoke('library:updateItem', id, input))),
    setItemArchived: async (id, archived) => void (await after(api.invoke('library:setItemArchived', id, archived))),
    moveItem: async (itemId, categoryId) => void (await after(api.invoke('library:moveItem', itemId, categoryId)))
  }
})

// Totals change whenever a block is saved; refresh when the session goes idle.
api.on('session:changed', (s) => {
  if (s.stage === 'idle') void useLibrary.getState().refresh()
})
api.on('study:changed',()=>void useLibrary.getState().refresh())
