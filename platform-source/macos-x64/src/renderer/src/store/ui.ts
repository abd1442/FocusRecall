import { create } from 'zustand'
import type { Id } from '@core/types'

export type Tab = 'home' | 'learn' | 'history' | 'stats' | 'library' | 'settings'

export type CategoryView = 'subjects' | 'notes' | 'review' | 'stats'
export type SubjectView = 'overview' | 'notes' | 'review' | 'resources' | 'sessions'

export type LibraryRoute =
  | { kind: 'root' }
  | { kind: 'category'; id: Id; view: CategoryView }
  | { kind: 'subject'; id: Id; view: SubjectView }

interface UiState {
  settingsPage: 'general'|'log'|'appearance'|'about'
  tab: Tab
  library: LibraryRoute
  /** The between-blocks screen is showing (a sitting is open and the user has not exited to Home). */
  between: boolean
  setTab: (tab: Tab) => void
  openLibrary: (route: LibraryRoute) => void
  openSubject: (id: Id, view?: SubjectView) => void
  showBetween: () => void
  exitToHome: () => void
  /** A day picked on a heat map, for History to open. */
  historyDay: string | null
  openHistoryDay: (day: string) => void
  clearHistoryDay: () => void
  historySessionId: Id | null
  openHistorySession: (id: Id) => void
  clearHistorySession: () => void
}

export const useUi = create<UiState>((set) => ({
  settingsPage:'general',
  tab: 'home',
  library: { kind: 'root' },
  between: false,
  setTab: (tab) => set({ tab, between: false }),
  openLibrary: (library) => set({ tab: 'library', library, between: false }),
  openSubject: (id, view = 'overview') => set({ tab: 'library', library: { kind: 'subject', id, view }, between: false }),
  showBetween: () => set({ between: true }),
  exitToHome: () => set({ between: false, tab: 'home' }),
  historyDay: null,
  openHistoryDay: (day) => set({ tab: 'history', between: false, historyDay: day }),
  clearHistoryDay: () => set({ historyDay: null }),
  historySessionId:null,
  openHistorySession:(id)=>set({tab:'history',between:false,historyDay:null,historySessionId:id}),
  clearHistorySession:()=>set({historySessionId:null})
}))
