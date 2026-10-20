import { DEFAULT_CAPTURES, type CaptureSettings } from './captures'
import { DEFAULT_QUALITY, DISTRACTION_REASONS, type QualityThresholds, type ReasonOption } from './distractions'
import { DEFAULT_STAGES, type StageStep } from './learning'
import type { LogValues } from './logfields'
import { DEFAULT_REST_RULES, DEFAULT_REST_SUGGESTIONS, type RestRules } from './rest'
import type { Weekday } from './studyDay'
import type { TimerMode } from './timer'
import type { AppLanguage } from './localization'
import type { HomeSubjectOrdering } from './homePreferences'

/** App settings with their defaults. Stored one key per row as JSON. */
export interface AppSettings {
  /** Missing/legacy preferences retain the complete workflow. */
  studyExperience: 'full' | 'quick'
  homeSubjectOrdering: HomeSubjectOrdering
  showTodayCheck: boolean
  /** Local calendar date; never the configurable study-day key. */
  todayCheckSkippedDate: string | null
  language: AppLanguage
  /** Collection requires an explicit current disclosure; old choices remain stored. */
  foregroundTrackingEnabled: boolean
  foregroundTrackingConsentVersion: 0 | 1
  foregroundTrackingTitlesEnabled: boolean
  starterGuideCompleted: boolean
  defaultNotesApp: 'none' | 'notion' | 'obsidian'
  obsidianVaultPath: string
  obsidianVaultName: string
  notionOpenIn: 'desktop' | 'browser'
  focusTargetMinutes: number
  defaultTimerMode: TimerMode
  /** Open the floating panel automatically when a session starts. */
  panelAutoShow: boolean
  /** Whether the floating panel is currently open (survives restarts). */
  panelOpen: boolean
  /** Expanded shows the stage buttons; compact only colour, item and timer. */
  panelExpanded: boolean
  panelPosition: { x: number; y: number } | null
  soundsEnabled: boolean
  /** 0 to 1. */
  soundVolume: number
  /** An open sitting ends by itself after this many hours without a block. */
  sittingAutoEndHours: number
  /** "HH:MM": a study day starts here, so late-night work counts on the previous day. */
  dayStart: string
  weekStartsOn: Weekday
  /** Fixed mode countdown length. */
  fixedMinutes: number
  /** Activity planned on Home; pre-selects the activity in the log. */
  plannedActivity: string | null
  /** Minimise the main window when a session starts. */
  preparationEnabled: boolean
  preparationChecks: string[]
  studyReminderDailyEnabled: boolean
  studyReminderDailyTime: string
  studyReminderSmartEnabled: boolean
  studyReminderQuietStart: string
  studyReminderQuietEnd: string
  minimizeOnStart: boolean
  /** The default study setup: the last one used, or the most used. */
  setupDefaultMode: 'last' | 'most'
  /** A setup chosen on Home for the next blocks; cleared once a log uses it. */
  setupOverride: LogValues | null
  /** Last progress unit per subject and activity ("itemId:activityId"). */
  unitMemory: Record<string, string>
  /** Whether to show the optional progress range, per subject. */
  progressRangeMemory: Record<string, boolean>
  /** "More detail" groups the user keeps open. */
  logOpenGroups: number[]
  /** Open the rest playlist when rest starts. */
  restMusic: boolean
  /** Spotify playlist link or URI for rests. */
  restPlaylist: string
  /** Request playback through Spotify's Windows media session; pause only if started here. */
  restMusicAutoPlay: boolean
  restRules: RestRules
  /** Screen-free things to do in a rest. */
  restSuggestions: string[]
  lastItemId: number | null
  lastTimerMode: TimerMode | null
  /** Global hotkey for Distracted / Back (Electron accelerator, e.g. "F8"). Empty = off. F9 stays unassigned. */
  hotkeyDistracted: string
  /** Global hotkey that opens the Switch picker. Empty = off. */
  hotkeySwitch: string
  /** Thresholds for Clean, Some distraction and Distracted. */
  quality: QualityThresholds
  /** Global hotkey that opens the "park a thought" box. Empty = off. */
  hotkeyPark: string
  /** Global hotkey for "I got stuck here". Unassigned by default. */
  hotkeyStuck: string
  /** Global hotkey for "I wanted to get distracted and did not". Unassigned by default. */
  hotkeyResisted: string
  /** Distraction reasons: renamed, reordered, archived and added by the user. */
  distractionReasons: ReasonOption[]
  /** Which quick captures are on. */
  captures: CaptureSettings
  /** Back after more than this many minutes away asks whether to end the session where you left. */
  longAbsenceMinutes: number
  /** The goal typed on the setup card for the next session; cleared when it starts. */
  nextGoal: string
  /** Learning stages by hours on a subject (round 4 section 3). */
  learningStages: StageStep[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  studyExperience: 'full',
  homeSubjectOrdering: { mode: 'recent', ids: [] },
  showTodayCheck: true,
  todayCheckSkippedDate: null,
  language: 'en',
  foregroundTrackingEnabled: false,
  foregroundTrackingConsentVersion: 0,
  foregroundTrackingTitlesEnabled: false,
  starterGuideCompleted: true,
  defaultNotesApp: 'none',
  obsidianVaultPath: '',
  obsidianVaultName: '',
  notionOpenIn: 'desktop',
  focusTargetMinutes: 25,
  defaultTimerMode: 'flow',
  panelAutoShow: true,
  panelOpen: false,
  panelExpanded: true,
  panelPosition: null,
  soundsEnabled: true,
  soundVolume: 0.6,
  sittingAutoEndHours: 2,
  dayStart: '04:00',
  weekStartsOn: 6,
  fixedMinutes: 25,
  plannedActivity: null,
  preparationEnabled: true,
  preparationChecks: ['Phone away or silenced','Distracting tabs and apps closed'],
  studyReminderDailyEnabled: false,
  studyReminderDailyTime: '18:00',
  studyReminderSmartEnabled: false,
  studyReminderQuietStart: '22:00',
  studyReminderQuietEnd: '08:00',
  minimizeOnStart: true,
  setupDefaultMode: 'last',
  setupOverride: null,
  unitMemory: {},
  progressRangeMemory: {},
  logOpenGroups: [],
  restMusic: false,
  restPlaylist: '',
  restMusicAutoPlay: true,
  restRules: DEFAULT_REST_RULES,
  restSuggestions: DEFAULT_REST_SUGGESTIONS,
  lastItemId: null,
  lastTimerMode: null,
  hotkeyDistracted: 'F8',
  hotkeySwitch: 'F10',
  quality: DEFAULT_QUALITY,
  hotkeyPark: 'F7',
  hotkeyStuck: '',
  hotkeyResisted: '',
  distractionReasons: DISTRACTION_REASONS,
  captures: DEFAULT_CAPTURES,
  longAbsenceMinutes: 10,
  nextGoal: '',
  learningStages: DEFAULT_STAGES
}

export type SettingKey = keyof AppSettings
