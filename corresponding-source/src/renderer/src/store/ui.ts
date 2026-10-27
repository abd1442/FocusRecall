import { create } from 'zustand'
import type { Id } from '@core/types'
import type { DayRange, GroupBy, RangePreset } from '@core/history'
import type { Quality } from '@core/distractions'

export type Tab = 'home' | 'learn' | 'history' | 'stats' | 'library' | 'settings'

export type CategoryView = 'subjects' | 'notes' | 'review' | 'stats'
export type SubjectView = 'overview' | 'notes' | 'review' | 'resources' | 'sessions'

/** Transient browsing context; retained across tabs, never written to the study database. */
export interface HistoryViewState {
  view: 'sessions' | 'notes' | 'review'
  showCharts: boolean
  quality: Quality | null
  preset: RangePreset
  custom: DayRange | null
  itemId: Id | null
  categoryId: Id | null
  activityId: string | null
  query: string
  groupBy: GroupBy
  selectedDay: string | null
}
export const initialHistoryView = (): HistoryViewState => ({view:'sessions',showCharts:false,quality:null,preset:'last-30',custom:null,itemId:null,categoryId:null,activityId:null,query:'',groupBy:'day',selectedDay:null})

export type LibraryRoute =
  | { kind: 'root' }
  | { kind: 'category'; id: Id; view: CategoryView }
  | { kind: 'subject'; id: Id; view: SubjectView }

interface UiState {
  historyView: HistoryViewState
  setHistoryView: (patch: Partial<HistoryViewState>) => void
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
  historyView:initialHistoryView(),
  setHistoryView:patch=>set(s=>({historyView:{...s.historyView,...patch}})),
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
  openHistoryDay: (day) => set(s=>({ tab: 'history', between: false, historyDay: day, historySessionId:null,historyView:{...s.historyView,view:'sessions',preset:'day',selectedDay:day,itemId:null,categoryId:null,activityId:null,quality:null,query:''} })),
  clearHistoryDay: () => set({ historyDay: null }),
  historySessionId:null,
  openHistorySession:(id)=>set(s=>({tab:'history',between:false,historyDay:null,historySessionId:id,historyView:{...s.historyView,view:'sessions',preset:'all',selectedDay:null,itemId:null,categoryId:null,activityId:null,quality:null,query:'',groupBy:'day'}})),
  clearHistorySession:()=>set({historySessionId:null})
}))
