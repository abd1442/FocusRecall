import { create } from 'zustand'
import type { BlockSummary } from '@core/stats'
import type { Id } from '@core/types'

// Preparation shares this module with the main UI. Auxiliary windows must not
// fetch the main window's full history or subscribe to refreshes for it.
const canReadHistory = !['#panel', '#reasons', '#capture'].includes(window.location.hash)

interface BlocksState {
  blocks: BlockSummary[]
  loaded: boolean
  refresh: () => Promise<void>
  setReviewDone: (id: Id, done: boolean) => Promise<void>
}

/** Light summaries of every finished block, for the overview cards. */
export const useBlocks = create<BlocksState>((set, get) => ({
  blocks: [],
  loaded: false,
  refresh: async () => {
    if (canReadHistory) set({ blocks: await window.api.invoke('blocks:summaries'), loaded: true })
  },
  setReviewDone: async (id, done) => {
    set({ blocks: get().blocks.map((b) => (b.id === id ? { ...b, reviewDone: done } : b)) })
    await window.api.invoke('history:setToReviewDone', id, done)
  }
}))

if (canReadHistory) {
void useBlocks.getState().refresh()
// New blocks appear when a block's log is saved (the session goes idle).
window.api.on('session:changed', (s) => {
  if (s.stage === 'idle') void useBlocks.getState().refresh()
})
window.api.on('study:changed',()=>void useBlocks.getState().refresh())
}
