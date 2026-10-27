import type { PriorKnowledge } from './learning'
// Domain types shared by main, preload and renderer. No Electron or Node imports.

export type Id = number

/** ISO 8601 timestamp in UTC, e.g. "2026-10-11T08:30:00.000Z". */
export type IsoUtc = string

export interface Category {
  id: Id
  /** null for a top-level category; set for a sub-category (two levels only). */
  parentId: Id | null
  name: string
  color: string
  /** An emoji or short symbol shown on the tile. */
  icon: string | null
  sortOrder: number
  archived: boolean
  createdAt: IsoUtc
}

export const UNIT_PRESETS = [
  'pages',
  'chapters',
  'lectures',
  'videos',
  'problems',
  'sections'
] as const

export type NotesTargetType = 'none' | 'notion' | 'obsidian'

export interface Item {
  id: Id
  categoryId: Id
  name: string
  color: string
  /** One of UNIT_PRESETS or any custom text. */
  defaultUnit: string
  totalUnits: number | null
  notesTargetType: NotesTargetType
  /** Notion page URL, or Obsidian file path inside the vault. */
  notesTarget: string | null
  /** Obsidian vault name (only for notesTargetType = 'obsidian'). */
  notesVault: string | null
  /** Pinned subjects show first on Home and in pickers. */
  pinned: boolean
  archived: boolean
  createdAt: IsoUtc
  /** What was known before starting (round 4 section 3). Null: not said. */
  priorKnowledge: PriorKnowledge | null
  /** Subjects this one builds on (History 2 builds on History 1). */
  buildsOn: Id[]
  /** Hours already spent before tracking started; counted toward the learning stage. */
  hoursBefore: number
  /** First subject in this area. Null: not said. */
  newField: boolean | null
}

/** A bookmark on a subject: a web link or a file path. */
export interface ItemResource {
  id: Id
  itemId: Id
  title: string
  target: string
  sortOrder: number
}

/** An item as shown in pickers: recent first. */
export interface PickerItem extends Item {
  categoryName: string
  lastUsedAt: IsoUtc | null
}

export interface CategoryInput {
  name: string
  color: string
  icon: string | null
  parentId: Id | null
}

/** Study totals for a library tile. */
export interface LibraryStats {
  focusSeconds: number
  blocks: number
  lastStudiedAt: IsoUtc | null
}

export interface ItemStats extends LibraryStats {
  itemId: Id
  /** Progress logged in the item's own unit, for "x of total". */
  progress: number
}

export interface ItemInput {
  categoryId: Id
  name: string
  color: string
  defaultUnit: string
  totalUnits: number | null
  notesTargetType: NotesTargetType
  notesTarget: string | null
  notesVault: string | null
  /** Learning-stage details; left out = unchanged on update, empty on create. */
  priorKnowledge?: PriorKnowledge | null
  buildsOn?: Id[]
  hoursBefore?: number
  newField?: boolean | null
}
