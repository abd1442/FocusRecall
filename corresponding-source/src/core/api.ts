import type { Preparation } from './preparation'
import type { LearnAction, LearnState } from './learn'
import type { AdviceIntent, AdviceSurface } from './adviceCatalog'
import type { MusicAction, MusicStatus } from './music'
import type { DiscoveryRecord } from './discoveries'
import type { ReminderStatus } from './studyReminders'
// The typed IPC contract. Main registers one handler per channel, preload
// exposes a generic invoke and on, and the renderer gets full types for both.
import type { SessionState } from './session'
import type { AppSettings, SettingKey } from './settings'
import type { TimerMode } from './timer'
import type { BlockSummary } from './stats'
import type { StatsRaw } from './statsData'
import type { Category, CategoryInput, Id, Item, ItemInput, ItemResource, ItemStats, PickerItem } from './types'
import type { Appearance } from './appearance'
import type { NoteInput, StudyNote } from './notes'
import type { StudyToolsData, ComparisonView, StudyExperiment, WeeklyReflection } from './studyTools'
import type { DistractionRow, HistorySitting, Rating, RecallInput } from './blocks'
import type { AppRule, Classification, ProgramRow, RuleScope } from './tracking'
import type { GoalResult, MarkKind, SessionMark } from './captures'
import type { FieldOption, FieldType, GroupNotes, LogField, LogGroup, LogSchema, LogValues, ScaleConfig, Section } from './logfields'

/** One block's after-block answers. */
export interface LogEntry {
  blockId: Id
  values: LogValues
  notes: GroupNotes
  /** Slider fields left at their default (saved, marked as not touched). */
  untouched?: number[]
}

/** Corrections to a finished block from History. */
export interface BlockPatch {
  itemId?: Id
  focusStartedAt?: string
  focusEndedAt?: string
  recallText?: string | null
  toReviewText?: string | null
  reviewMarked?: boolean
  recallRating?: Rating | null
  /** False when the rating is the untouched default. */
  recallRatingTouched?: boolean
}

/** What the log shows on the session timeline: its distractions and programs that have no rule yet. */
export interface SessionReview {
  distractions: DistractionRow[]
  /** Every program and browser site in front, with what it counts as. */
  programs: ProgramRow[]
  marks: SessionMark[]
  goal: string | null
  goalResult: GoalResult | null
  windowSwitches: number
  windowHistoryFrozen?: boolean
}

/** The answers of one study day (the daily check-in). */
export interface DayAnswers {
  day: string
  values: LogValues
  notes: GroupNotes
  /** Slider fields saved at their default without being touched. */
  untouched: number[]
  /** Answered or skipped: Home folds the card away. */
  done: boolean
  skipped: boolean
}

/** The rule saved when a program or site is tagged. */
export interface RuleInput {
  id?: Id
  matchType: AppRule['matchType']
  pattern: string
  classification: Classification
  itemId?: Id | null
  /** "Just this session". */
  sessionId?: Id | null
}

export interface HotkeyStatus {
  distracted: { key: string; ok: boolean }
  switch: { key: string; ok: boolean }
  stuck: { key: string; ok: boolean }
  resisted: { key: string; ok: boolean }
}

export type TrackingStatus = { state: 'stopped' } | { state: 'running' } | { state: 'failed'; reason: string }

export interface StartBlockInput {
  itemId: Id
  timerMode: TimerMode
  targetSeconds: number
  /** "What do I want to get done?" (optional). */
  goal?: string | null
}

export interface IpcContract {
  'learn:get': {args:[];result:LearnState}
  'learn:act': {args:[action:LearnAction];result:LearnState}
  'advice:choose': {args:[surface:AdviceSurface,intent:AdviceIntent,another:boolean];result:string|null}
  'advice:less': {args:[id:string];result:void}
  'advice:reset': {args:[];result:void}
  'music:status': { args: []; result: MusicStatus }
  'music:command': { args: [action: MusicAction]; result: MusicStatus }
  'app:version': {args:[];result:string}
  'studyReminders:status': {args:[];result:ReminderStatus}
  'studyReminders:test': {args:[];result:ReminderStatus}
  'studyReminders:pause': {args:[mode:'hour'|'today'|'resume'];result:ReminderStatus}
  'preparation:begin': {args:[input:StartBlockInput|null,force?:boolean];result:void}
  'preparation:get': {args:[];result:Preparation|null}
  'preparation:confirm': {args:[quickForSitting?:boolean];result:SessionState}
  'preparation:cancel': {args:[];result:void}
  'backup:create': { args: []; result: {name:string} | null }
  'backup:inspectRestore': { args: []; result: {token:string;name:string;schema:number;bytes:number} | null }
  'backup:restore': { args: [token:string]; result: void }
  'backup:reveal': { args: []; result: void }
  'backup:openFolder': { args: []; result: void }
  'tools:get': { args: []; result: StudyToolsData }
  'tools:saveDiscovery': { args: [entry:DiscoveryRecord]; result:StudyToolsData }
  'tools:saveView': { args: [view:ComparisonView]; result:StudyToolsData }
  'tools:saveExperiment': { args: [experiment:StudyExperiment]; result:StudyToolsData }
  'tools:saveReview': { args: [review:WeeklyReflection]; result:StudyToolsData }
  'tools:remove': { args: [kind:'view'|'experiment',id:string]; result:StudyToolsData }
  'notes:search': {args:[query:string];result:StudyNote[]}
  'notes:list': { args: [itemId: Id, blockId?: Id]; result: StudyNote[] }
  'notes:save': { args: [note: NoteInput, sync: boolean]; result: StudyNote }
  'notes:delete': { args: [id: string]; result: void }
  'notes:connection': { args: []; result: boolean }
  'notes:setToken': { args: [token: string]; result: void }
  'notes:testNotion': { args: [page: string]; result: { id: string; label: string; placement: 'inside'|'after' }[] }
  'notes:pickVault': { args: []; result: string | null }
  'notes:pickFile': { args: [vault: string]; result: string | null }
  'notes:copy': { args: [note: NoteInput, image: boolean]; result: void }
  'library:listCategories': { args: [includeArchived: boolean]; result: Category[] }
  'library:createCategory': { args: [input: CategoryInput]; result: Category }
  'library:updateCategory': { args: [id: Id, input: CategoryInput]; result: Category }
  'library:setCategoryArchived': { args: [id: Id, archived: boolean]; result: void }
  'library:deleteCategory': { args: [id: Id]; result: void }
  'library:reorderCategories': { args: [orderedIds: Id[]]; result: void }
  'library:moveCategory': { args: [id: Id, parentId: Id | null]; result: void }
  'library:moveItem': { args: [itemId: Id, categoryId: Id]; result: void }
  'library:itemStats': { args: []; result: ItemStats[] }

  'library:listItems': { args: [filter: { categoryId?: Id; includeArchived: boolean }]; result: Item[] }
  'library:listPickerItems': { args: []; result: PickerItem[] }
  'library:createItem': { args: [input: ItemInput]; result: Item }
  'library:updateItem': { args: [id: Id, input: ItemInput]; result: Item }
  'library:setItemArchived': { args: [id: Id, archived: boolean]; result: void }
  'library:setItemPinned': { args: [id: Id, pinned: boolean]; result: void }
  'resources:list': { args: [itemId: Id]; result: ItemResource[] }
  'resources:save': { args: [resource: { id?: Id; itemId: Id; title: string; target: string }]; result: void }
  'resources:delete': { args: [id: Id]; result: void }
  'resources:reorder': { args: [orderedIds: Id[]]; result: void }
  'blocks:summaries': { args: []; result: BlockSummary[] }
  'shell:open': { args: [target: string]; result: void }
  'shell:pickFile': { args: []; result: string | null }

  'settings:getAll': { args: []; result: AppSettings }
  'settings:set': { args: [key: SettingKey, value: AppSettings[SettingKey]]; result: AppSettings }
  'appearance:get': { args: []; result: Appearance }
  'appearance:set': { args: [appearance: Appearance]; result: Appearance }
  'appearance:presets': { args: []; result: {name:string;appearance:Appearance}[] }
  'appearance:savePreset': { args: [name:string,appearance:Appearance]; result: void }
  'appearance:deletePreset': { args: [name:string]; result: void }
  'appearance:export': { args: [appearance:Appearance]; result: string|null }
  'appearance:import': { args: []; result: Appearance|null }

  'session:get': { args: []; result: SessionState }
  'session:resumeWorkflow': { args: [sessionId: number]; result: SessionState }
  'session:leaveWorkflow': { args: [sessionId: number]; result: SessionState }
  'session:getLogDraft': { args: [sessionId: number]; result: unknown }
  'session:getRecallDraft': { args: [sessionId:number];result:unknown }
  'session:saveRecallDraft': {args:[sessionId:number,draft:unknown];result:void}
  'session:saveLogDraft': { args: [sessionId: number, draft: unknown]; result: void }
  'recall:get': { args: [blockId: number]; result: RecallInput | null }
  'session:start': { args: [input: StartBlockInput]; result: SessionState }
  'session:startLast': { args: []; result: SessionState }
  'session:distracted': { args: []; result: SessionState }
  'session:back': { args: []; result: SessionState }
  'session:toggleDistracted': { args: []; result: SessionState }
  'session:switch': { args: [itemId: Id]; result: SessionState }
  'session:wrapUp': { args: [nextItemId: Id]; result: SessionState }
  'session:finish': { args: []; result: SessionState }
  'session:quickAction': { args: [destination: 'next' | 'break' | 'finish', blockId: Id]; result: SessionState }
  'session:discardFinished': { args: []; result: SessionState }
  'session:splitLast': { args: [itemIds: Id[]]; result: SessionState }
  'session:completeRecall': { args: []; result: SessionState }
  'session:adjustSplit': { args: [blockIds: Id[], boundaries: string[]]; result: SessionState }
  'session:review': { args: [blockIds: Id[]]; result: SessionReview }
  /** Everything the Stats page analyses. */
  'stats:raw': { args: []; result: StatsRaw }
  /** Save the report; null when the save dialog was cancelled. */
  'stats:exportMarkdown': { args: [markdown: string, fileName: string]; result: string | null }
  'stats:exportPdf': { args: [html: string, fileName: string]; result: string | null }
  'stats:exportPng': { args: [html: string, fileName: string, width: number]; result: string | null }
  'distraction:label': { args: [id: Id, kind: string]; result: void }
  'distraction:confirm': { args: [id: Id]; result: void }
  'distraction:delete': { args: [id: Id]; result: void }
  'rules:list': { args: []; result: AppRule[] }
  'rules:save': { args: [rule: RuleInput]; result: AppRule[] }
  'rules:delete': { args: [id: Id]; result: AppRule[] }
  /**
   * Decide programs or sites from the log or History (Study, Distraction, Ignore) with a scope;
   * detections are worked out again everywhere. Returns the ids of the rules made.
   */
  'rules:decide': { args: [rules: RuleInput[]]; result: Id[] }
  /** Move a choice to another scope; returns the new rule's id. */
  'rules:rescope': { args: [id: Id, scope: RuleScope, context: { itemId: Id | null; sessionId: Id | null }]; result: Id }
  /** Never count this detected app or site again: an ignore rule, and its detections in the session go. */
  'distraction:alwaysIgnore': { args: [id: Id]; result: void }
  /** New start and end for a distraction dragged on the timeline. */
  'distraction:retime': { args: [id: Id, startedAt: string, endedAt: string]; result: void }
  /** A distraction added afterwards on the timeline (a Distracted spell that was not logged). Returns its id. */
  'distraction:add': { args: [blockIds: Id[], startedAt: string, endedAt: string, kind: string]; result: Id }
  /** Move the switch point between two parts of a session. */
  'session:moveSwitch': { args: [leftBlockId: Id, rightBlockId: Id, at: string]; result: void }
  'session:setGoalResult': { args: [sessionId: Id, result: GoalResult | null]; result: void }
  /** Back after a long absence: go on, or end the session when Distracted was pressed. */
  'session:longAbsence': { args: [choice: 'continue' | 'end']; result: SessionState }
  /** Uses of each reason, for ordering the picker. */
  'reasons:counts': { args: []; result: Record<string, number> }
  'capture:mark': { args: [kind: MarkKind, note: string | null]; result: void }
  /** Open the small capture box (park a thought, or a note for a stuck marker). */
  'capture:open': { args: [mode: 'stuck']; result: void }
  'capture:close': { args: []; result: void }
  /** The absence confirmation or the capture box has loaded and listens for 'reasons:show' / 'capture:show'. */
  'popup:ready': { args: [which: 'reasons' | 'capture']; result: void }
  'day:get': { args: [day: string]; result: DayAnswers }
  'day:save': { args: [day: string, values: LogValues, notes: GroupNotes, untouched?: number[]]; result: void }
  'day:skip': { args: [day: string]; result: void }
  'hotkeys:status': { args: []; result: HotkeyStatus }
  'tracking:deleteTitles': { args: []; result: { activityRows: number; distractionRows: number } }
  'tracking:status': { args: []; result: TrackingStatus }
  'session:finishWrapUp': { args:[entries:LogEntry[],destination:'finish'|'break'|'next'];result:SessionState }
  'session:submitLog': { args: [entries: LogEntry[]]; result: SessionState }
  'recall:save': { args: [blockId: Id, recall: RecallInput]; result: void }
  'log:previous': { args: [itemId: Id, excludeBlockId: Id]; result: LogValues | null }
  'log:activityHistory': { args: [itemId: Id]; result: string[] }
  'log:schema': { args: []; result: LogSchema }
  'log:saveGroup': { args: [group: { id?: Id; name: string; section?: Section }]; result: LogGroup }
  'log:saveField': { args: [field: { id?: Id; groupId: Id; label: string; type?: FieldType; scale?: ScaleConfig | null }]; result: LogField }
  'log:saveOptions': { args: [fieldId: Id, options: FieldOption[]]; result: void }
  'log:addOption': { args: [fieldId: Id, label: string]; result: string }
  'log:setArchived': { args: [kind: 'group' | 'field', id: Id, archived: boolean]; result: void }
  'log:reorder': { args: [kind: 'group' | 'field', orderedIds: Id[]]; result: void }
  'log:setupHistory': { args: []; result: LogValues[] }

  'history:list': { args: []; result: HistorySitting[] }
  'history:updateBlock': { args: [id: Id, patch: BlockPatch]; result: void }
  'history:saveLog': { args: [id: Id, values: LogValues, notes: GroupNotes, untouched?: number[]]; result: void }
  'history:deleteBlock': { args: [id: Id]; result: void }
  'history:deleteSession': { args: [sessionId: Id]; result: void }
  'history:setToReviewDone': { args: [id: Id, done: boolean]; result: void }
  'session:finishStudying': {args:[];result:SessionState}
  'session:endSitting': { args: []; result: SessionState }
  'session:resolveRecovery': { args: [choice: 'continue' | 'end']; result: SessionState }
  'rest:start': { args: [seconds: number]; result: SessionState }
  'rest:updatePlan': { args: [seconds: number]; result: SessionState }
  'rest:endEarly': { args: []; result: SessionState }
  'rest:skip': { args: []; result: SessionState }
  'rest:finish': { args: [activity: string | null]; result: SessionState }
  'rest:startNextBlock': { args: []; result: SessionState }

  'window:showMain': { args: []; result: void }
  'panel:focus': { args: []; result: void }
  'panel:toggle': { args: []; result: void }
  'panel:close': { args: []; result: void }
  'panel:hover': { args: [over: boolean]; result: void }
  /** Open the Switch picker in the main window (panel button, Switch hotkey). */
  'ui:openSwitch': { args: []; result: void }
  /** The Switch picker closed without a switch; FocusRecall goes back to where it was. */
  'ui:switchClosed': { args: []; result: void }
  'reasons:hide': { args: []; result: void }
  'app:demo': { args: []; result: boolean }
  'app:setDemo': { args: [on: boolean]; result: void }
}

/** Events pushed from main to every window. */
export interface EventContract {
  'music:changed': MusicStatus
  'ui:openHome': null
  'preparation:changed': Preparation|null
  'study:changed': null
  'tracking:changed': TrackingStatus
  'clock:changed': null
  'tools:changed': null
  'session:changed': SessionState
  'session:targetReached': { blockId: Id }
  'session:restOver': { blockId: Id }
  'settings:changed': AppSettings
  'appearance:changed': Appearance
  'log:schemaChanged': LogSchema
  'ui:openSwitch': null
  /** For the long-absence confirmation window. */
  'reasons:show': { kind: 'absence'; minutes: number }
  'capture:show': { mode: 'stuck' }
  /** A stuck or resisted marker was placed (the panel shows it briefly). */
  'capture:marked': { kind: MarkKind }
  /** A distraction app held the front for a while during a rest. */
  'rest:nudge': { app: string }
  /** A distraction was labelled, confirmed or deleted. */
  'distractions:changed': { blockId: Id | null }
  'hotkeys:changed': HotkeyStatus
}

export type Channel = keyof IpcContract
export type ArgsOf<C extends Channel> = IpcContract[C]['args']
export type ResultOf<C extends Channel> = IpcContract[C]['result']
export type EventName = keyof EventContract

export interface FocusRecallApi {
  invoke<C extends Channel>(channel: C, ...args: ArgsOf<C>): Promise<ResultOf<C>>
  /** Subscribe to a pushed event. Returns an unsubscribe function. */
  on<E extends EventName>(event: E, listener: (payload: EventContract[E]) => void): () => void
}
