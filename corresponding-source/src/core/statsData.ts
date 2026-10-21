// The Stats page's data: one record per session with its outcomes and every
// factor that might affect them, built from raw rows the main process reads.
// Pure; the analysis lives in insights.ts.
import { countsAsLost, qualityOf, type DistractionSource, type Quality, type QualityThresholds } from './distractions'
import { indexedHoursBefore, stageFor, type PriorKnowledge, type StageStep, PRIOR_KNOWLEDGE } from './learning'
import { scaleLabel, type LogField, type LogSchema, type ProgressValue } from './logfields'
import { parseDayStart, studyDayKey } from './studyDay'
import { siteOf } from './tracking'

// --- raw rows (main/repos/stats.ts) -------------------------------------------

export interface RawValue {
  fieldId: number
  value: unknown
  touched: boolean
}

export interface RawDistraction {
  /** Seconds of focus into the part when it started. */
  offsetSeconds: number
  durationSeconds: number
  startedAt: number
  source: DistractionSource
  kind: string
  app: string | null
  title: string | null
  confirmed: boolean
}

/** One subject part of a session (most sessions have one). */
export interface RawBlock {
  id: number
  sessionId: number
  sittingId: number
  itemId: number
  start: number
  end: number
  focusSeconds: number
  targetSeconds: number
  timerMode: 'flow' | 'fixed' | 'adaptive'
  recallRating: number | null
  recallTouched: boolean
  values: RawValue[]
  restPlannedSeconds: number | null
  restActualSeconds: number | null
  restActivity: string | null
  restSkipped: boolean
  /** Screens used during the rest (window tracking or the rest screen's own flags). */
  restScreen: boolean
  distractions: RawDistraction[]
  /** Time per program or site in front during focus (label → seconds). */
  appSeconds: Record<string, number>
  stuck: number
  resisted: number
}

export interface RawSession {
  id: number
  sittingId: number
  lostShare: number
  distractionCount: number
  distractedSeconds: number
  longestStretchSeconds: number
  goal: string | null
  goalResult: 'done' | 'partly' | 'not-done' | null
  windowSwitches: number
}

export interface RawItem {
  id: number
  categoryId: number
  name: string
  color: string
  priorKnowledge: PriorKnowledge | null
  hoursBefore: number
  newField: boolean | null
  buildsOn: number[]
}

export interface RawCategory {
  id: number
  parentId: number | null
  name: string
  color: string
}

export interface StatsRaw {
  blocks: RawBlock[]
  sessions: RawSession[]
  items: RawItem[]
  categories: RawCategory[]
  schema: LogSchema
  /** Daily check-in answers by study day. */
  dayValues: { day: string; values: RawValue[] }[]
}

export interface StatsSettings {
  dayStart: string
  stages: StageStep[]
  quality: QualityThresholds
}

// --- outcomes ---------------------------------------------------------------------

export type OutcomeKey = 'focus' | 'recall' | 'understanding' | 'distractionsPerHour' | 'lostShare' | 'longestStretch' | 'length' | 'progressRate'

export interface OutcomeDef {
  key: OutcomeKey
  label: string
  /** Short unit for differences: "steps" on a named scale, "per hour", "%", "min". */
  unit: string
  higherIsBetter: boolean | null
  /** Comes from a slider (so it can be an untouched default). */
  fromSlider: boolean
}

export const OUTCOMES: OutcomeDef[] = [
  { key: 'focus', label: 'Reported focus', unit: 'steps', higherIsBetter: true, fromSlider: true },
  { key: 'recall', label: 'Reported recall', unit: 'steps', higherIsBetter: true, fromSlider: true },
  { key: 'understanding', label: 'Reported understanding', unit: 'steps', higherIsBetter: true, fromSlider: true },
  { key: 'distractionsPerHour', label: 'Distractions per hour', unit: 'per hour', higherIsBetter: false, fromSlider: false },
  { key: 'lostShare', label: 'Time lost to distraction', unit: '%', higherIsBetter: false, fromSlider: false },
  { key: 'longestStretch', label: 'Longest uninterrupted stretch', unit: 'min', higherIsBetter: null, fromSlider: false },
  { key: 'length', label: 'Session length', unit: 'min', higherIsBetter: null, fromSlider: false },
  { key: 'progressRate', label: 'Recorded progress pace', unit: '% of prior pace', higherIsBetter: null, fromSlider: false }
]

export const outcomeDef = (k: OutcomeKey): OutcomeDef => OUTCOMES.find((o) => o.key === k)!

// --- one session --------------------------------------------------------------------

export interface StatDistraction extends RawDistraction {
  itemId: number
  /** Program or site label for detected ones. */
  label: string | null
}

export interface StatRest {
  activity: string | null
  plannedSeconds: number | null
  actualSeconds: number | null
  skipped: boolean
  screen: boolean
}

export interface StatSession {
  /** Per-subject time stays separate from whole-session outcomes. */
  subjectParts?: {itemId:number;categoryId:number;topCategoryId:number;focusSeconds:number}[]
  id: number
  start: number
  end: number
  day: string
  /** Local hour (0 to 23) and weekday (0 Sunday) at the start. */
  hour: number
  weekday: number
  sittingId: number
  /** 1 for the first session of its sitting, and so on. */
  positionInSitting: number
  /** 1 for the first session of its study day. */
  positionInDay: number
  /** The subject with the most focus in the session, and all subjects in it. */
  itemId: number
  itemIds: number[]
  categoryId: number
  /** Top-level category (the category itself when it has no parent). */
  topCategoryId: number
  /** Activity option id of the main part. */
  activity: string | null
  timerMode: 'flow' | 'fixed' | 'adaptive'
  focusSeconds: number
  targetSeconds: number
  overTarget: boolean
  /** Outcome values; an outcome nobody answered is missing. */
  outcomes: Partial<Record<OutcomeKey, number>>
  /** Answered-only aggregate when mixed parts also contain untouched defaults. */
  answeredOutcomes?: Partial<Record<OutcomeKey, number>>
  /** Actual part extents; deleted parts can leave a hole inside start/end. */
  wallRanges?:{start:number;end:number}[]
  /** Outcomes that are untouched slider defaults. */
  untouchedOutcomes: OutcomeKey[]
  /** Factor answers: factor key → option labels (several for a multi-choice). */
  factors: Record<string, string[]>
  /** Factors whose answer is an untouched slider default. */
  untouchedFactors: string[]
  difficulty: number | null
  difficultyTouched: boolean
  progressAmount: number | null
  progressUnit: string | null
  distractions: StatDistraction[]
  quality: Quality
  goalResult: 'done' | 'partly' | 'not-done' | null
  hasGoal: boolean
  resisted: number
  stuck: number
  windowSwitches: number
  appSeconds: Record<string, number>
  /** The rest after this session, and the one before it (same sitting). */
  rest: StatRest | null
  restBefore: StatRest | null
  /** Learning stage of the main subject at the start of the session. */
  stage: string
  stageIndex: number
  hoursOnSubject: number
  priorKnowledge: PriorKnowledge | null
  newField: boolean | null
  buildsOn: boolean
}

/** A factor that can be compared: a log field, a check-in field, or something derived (time of day). */
export interface FactorDef {
  semanticKey?: string | null
  key: string
  label: string
  /** Where it comes from, for grouping the list. */
  group: 'setup' | 'session' | 'detail' | 'day' | 'derived'
  /** Option labels in display order. */
  options: string[]
  multi: boolean
}

const SKIP_KEYS = new Set(['focus', 'understanding', 'progress'])

const field = (schema: LogSchema, key: string): LogField | undefined => schema.fields.find((f) => f.key === key)

/** The label of one answer, or labels for a multi-choice. Numbers are kept raw (binned later). */
function answerLabels(f: LogField, value: unknown): string[] | number | null {
  if (value === null || value === undefined || value === '') return null
  switch (f.type) {
    case 'single':
    case 'activity': {
      const o = f.options.find((x) => x.id === value)
      return o ? [o.label] : null
    }
    case 'multi':
      return Array.isArray(value) ? value.map((v) => f.options.find((x) => x.id === v)?.label).filter((x): x is string => !!x) : null
    case 'scale':
    case 'slider': {
      const l = f.scale ? scaleLabel(f.scale, Number(value)) : null
      return l ? [l] : null
    }
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    default:
      return null
  }
}

/** Three bins of about equal size for a number field: "under 6.5", "6.5 to 7.5", "7.5 and over". */
export function numberBins(values: number[], unit = ''): ((v: number) => string) | null {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length < 6) return null
  const q = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
  const a = q(1 / 3)
  const b = q(2 / 3)
  const u = unit ? ` ${unit}` : ''
  const fmt = (x: number): string => String(Math.round(x * 10) / 10)
  if (a === b) return (v) => (v < a ? `under ${fmt(a)}${u}` : `${fmt(a)}${u} and over`)
  return (v) => (v < a ? `under ${fmt(a)}${u}` : v < b ? `${fmt(a)} to ${fmt(b)}${u}` : `${fmt(b)}${u} and over`)
}

const TIME_OF_DAY = ['Early morning (before 9)', 'Morning (9 to 12)', 'Afternoon (12 to 17)', 'Evening (17 to 21)', 'Night (21 and later)']
export function timeOfDay(hour: number): string {
  if (hour < 4) return TIME_OF_DAY[4]
  if (hour < 9) return TIME_OF_DAY[0]
  if (hour < 12) return TIME_OF_DAY[1]
  if (hour < 17) return TIME_OF_DAY[2]
  if (hour < 21) return TIME_OF_DAY[3]
  return TIME_OF_DAY[4]
}
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const positionLabel = (n: number): string => (n >= 4 ? '4th or later' : ['1st', '2nd', '3rd'][n - 1])
export const lengthBucket = (minutes: number): string =>
  minutes < 15 ? 'under 15 min' : minutes < 30 ? '15 to 30 min' : minutes < 45 ? '30 to 45 min' : minutes < 60 ? '45 to 60 min' : '60 min and more'
const MODE_LABEL = { flow: 'Flow', fixed: 'Fixed', adaptive: 'Adaptive' } as const

/**
 * Build the per-session records. A session's log answers come from its main
 * part (the subject with the most focus); its distractions, captures and app
 * time from all parts. Untouched slider answers are kept but marked.
 */
export function buildStatSessions(raw: StatsRaw, settings: StatsSettings): { sessions: StatSession[]; factors: FactorDef[] } {
  const boundary = parseDayStart(settings.dayStart)
  const items = new Map(raw.items.map((i) => [i.id, i]))
  const cats = new Map(raw.categories.map((c) => [c.id, c]))
  const fieldsById = new Map(raw.schema.fields.map((f) => [f.id, f]))
  const groups = new Map(raw.schema.groups.map((g) => [g.id, g]))
  const sessionRows = new Map(raw.sessions.map((s) => [s.id, s]))
  const dayAnswers = new Map(raw.dayValues.map((d) => [d.day, d.values]))
  const byItemParts = raw.blocks.map((b) => ({ itemId: b.itemId, start: b.start, focusSeconds: b.focusSeconds }))
  const hoursBefore=indexedHoursBefore(byItemParts)

  const partsBySession = new Map<number, RawBlock[]>()
  for (const b of raw.blocks) {const rows=partsBySession.get(b.sessionId)??[];rows.push(b);partsBySession.set(b.sessionId,rows)}

  const sessions: StatSession[] = []
  const numbers = new Map<string, { session: StatSession; value: number; touched: boolean }[]>()
  const usedFactors = new Map<string, FactorDef>()

  const fieldFactorKey = (f: LogField): string => `field:${f.id}`
  const addAnswer = (s: StatSession, f: LogField, value: unknown, touched: boolean): void => {
    if (f.key && SKIP_KEYS.has(f.key)) return
    const group = groups.get(f.groupId)
    if (!group || f.type === 'text' || f.type === 'progress') return
    const key = fieldFactorKey(f)
    const labels = answerLabels(f, value)
    if (labels === null) return
    if (!usedFactors.has(key)) {
      const kind: FactorDef['group'] = group.section === 'day' ? 'day' : group.section === 'setup' ? 'setup' : group.section === 'quick' ? 'session' : 'detail'
      const options = f.type === 'scale' || f.type === 'slider' ? (f.scale?.labels ?? []) : f.options.filter((o) => !o.archived).map((o) => o.label)
      usedFactors.set(key, { key, semanticKey: f.key, label: f.label, group: kind, options, multi: f.type === 'multi' })
    }
    if (typeof labels === 'number') {
      const rows=numbers.get(key)??[];rows.push({session:s,value:labels,touched});numbers.set(key,rows)
      return
    }
    if (!labels.length) return
    s.factors[key] = labels
    if (!touched) s.untouchedFactors.push(key)
  }

  for (const [sessionId, parts] of partsBySession) {
    parts.sort((a, b) => a.start - b.start)
    const main = [...parts].sort((a, b) => b.focusSeconds - a.focusSeconds)[0]
    const row = sessionRows.get(sessionId)
    const item = items.get(main.itemId)
    const cat = item ? cats.get(item.categoryId) : undefined
    const start = parts[0].start
    const end = parts[parts.length - 1].end
    const focusSeconds = parts.reduce((s, p) => s + p.focusSeconds, 0)
    const targetSeconds = main.targetSeconds
    const startDate = new Date(start)
    const values = new Map(main.values.map((v) => [v.fieldId, v]))
    const valueOf = (key: string): RawValue | undefined => {
      const f = field(raw.schema, key)
      return f ? values.get(f.id) : undefined
    }
    const hours = item ? hoursBefore(main.itemId, start, item.hoursBefore) : 0
    const stage = stageFor(hours, settings.stages)
    const distractions: StatDistraction[] = parts.flatMap((p) =>
      p.distractions.map((d) => ({ ...d, itemId: p.itemId, label: d.source === 'auto' && d.app ? siteOf(d.app, d.title ?? '').label : null }))
    )
    const lost = distractions.filter((d) => countsAsLost(d))
    const stats = {
      distractionCount: row?.distractionCount ?? lost.length,
      distractedSeconds: row?.distractedSeconds ?? 0,
      lostShare: row?.lostShare ?? 0,
      longestStretchSeconds: row?.longestStretchSeconds ?? focusSeconds
    }
    const appSeconds: Record<string, number> = {}
    for (const p of parts) for (const [k, v] of Object.entries(p.appSeconds)) appSeconds[k] = (appSeconds[k] ?? 0) + v

    const s: StatSession = {
      id: sessionId,
      start,
      end,
      day: studyDayKey(startDate, boundary),
      hour: startDate.getHours(),
      weekday: startDate.getDay(),
      sittingId: main.sittingId,
      positionInSitting: 0,
      positionInDay: 0,
      itemId: main.itemId,
      itemIds: [...new Set(parts.map((p) => p.itemId))],
      subjectParts: parts.map(p=>{
        const categoryId=items.get(p.itemId)?.categoryId??0,category=cats.get(categoryId)
        return {itemId:p.itemId,categoryId,topCategoryId:category?.parentId??categoryId,focusSeconds:p.focusSeconds}
      }),
      wallRanges:parts.map(p=>({start:p.start,end:p.end})),
      categoryId: item?.categoryId ?? 0,
      topCategoryId: cat?.parentId ?? cat?.id ?? 0,
      activity: valueOf('activity')?.touched ? (valueOf('activity')?.value as string | undefined) ?? null : null,
      timerMode: main.timerMode,
      focusSeconds,
      targetSeconds,
      overTarget: main.timerMode !== 'fixed' ? focusSeconds > targetSeconds : focusSeconds > targetSeconds + 30,
      outcomes: {},
      untouchedOutcomes: [],
      factors: {},
      untouchedFactors: [],
      difficulty: null,
      difficultyTouched: true,
      progressAmount: null,
      progressUnit: null,
      distractions,
      quality: qualityOf(stats, settings.quality),
      goalResult: row?.goalResult ?? null,
      hasGoal: !!row?.goal,
      resisted: parts.reduce((n, p) => n + p.resisted, 0),
      stuck: parts.reduce((n, p) => n + p.stuck, 0),
      windowSwitches: row?.windowSwitches ?? 0,
      appSeconds,
      rest: restOf(parts[parts.length - 1]),
      restBefore: null,
      stage: stage.name,
      stageIndex: stage.index,
      hoursOnSubject: hours,
      priorKnowledge: item?.priorKnowledge ?? null,
      newField: item?.newField ?? null,
      buildsOn: (item?.buildsOn.length ?? 0) > 0
    }

    // Outcomes.
    const focus = valueOf('focus')
    if (typeof focus?.value === 'number') {
      s.outcomes.focus = focus.value
      if (!focus.touched) s.untouchedOutcomes.push('focus')
    }
    const und = valueOf('understanding')
    if (typeof und?.value === 'number') {
      s.outcomes.understanding = und.value
      if (!und.touched) s.untouchedOutcomes.push('understanding')
    }
    const recalls = parts.filter((p) => p.recallRating !== null)
    if (recalls.length) {
      s.outcomes.recall = recalls.reduce((n, p) => n + p.recallRating!, 0) / recalls.length
      const answered=recalls.filter((p)=>p.recallTouched)
      if(answered.length)s.answeredOutcomes={recall:answered.reduce((n,p)=>n+p.recallRating!,0)/answered.length}
      if (recalls.every((p) => !p.recallTouched)) s.untouchedOutcomes.push('recall')
    }
    if (focusSeconds >= 300) s.outcomes.distractionsPerHour = stats.distractionCount / (focusSeconds / 3600)
    s.outcomes.lostShare = stats.lostShare * 100
    s.outcomes.longestStretch = stats.longestStretchSeconds / 60
    s.outcomes.length = focusSeconds / 60
    const diff = valueOf('difficulty')
    if (typeof diff?.value === 'number') {
      s.difficulty = diff.value
      s.difficultyTouched = diff.touched
    }
    const prog = valueOf('progress')?.touched ? valueOf('progress')?.value as ProgressValue | undefined : undefined
    if (prog && prog.amount !== null && prog.amount >= 0) {
      s.progressAmount = prog.amount
      s.progressUnit = prog.unit
    }

    // Factors: every answered field of the main part, then the day's check-in.
    for (const v of main.values) {
      const f = fieldsById.get(v.fieldId)
      if (f) addAnswer(s, f, v.value, v.touched)
    }
    for (const v of dayAnswers.get(s.day) ?? []) {
      const f = fieldsById.get(v.fieldId)
      if (f) addAnswer(s, f, v.value, v.touched)
    }
    sessions.push(s)
  }

  // Numbers become three bins over everything answered.
  for (const [key, list] of numbers) {
    const f = fieldsById.get(Number(key.slice(6)))
    const bin = numberBins(
      (list.some(x=>x.touched)?list.filter(x=>x.touched):list).map((x) => x.value),
      f?.scale?.unit ?? ''
    )
    if (!bin) {
      usedFactors.delete(key)
      continue
    }
    const labels = [...new Set(list.map((x) => x.value).sort((a, b) => a - b).map(bin))]
    usedFactors.set(key, { ...usedFactors.get(key)!, options: labels })
    for (const x of list) {
      x.session.factors[key] = [bin(x.value)]
      if (!x.touched) x.session.untouchedFactors.push(key)
    }
  }

  // Positions in the sitting and the day, and the rest before.
  sessions.sort((a, b) => a.start - b.start)
  const inSitting = new Map<number, number>()
  const inDay = new Map<string, number>()
  const lastInSitting = new Map<number, StatSession>()
  for (const s of sessions) {
    s.positionInSitting = (inSitting.get(s.sittingId) ?? 0) + 1
    inSitting.set(s.sittingId, s.positionInSitting)
    s.positionInDay = (inDay.get(s.day) ?? 0) + 1
    inDay.set(s.day, s.positionInDay)
    s.restBefore = lastInSitting.get(s.sittingId)?.rest ?? null
    lastInSitting.set(s.sittingId, s)
  }

  // Prospective pace: prior completed sessions only, same subject/activity/unit.
  // Aggregate amounts/exposure rather than averaging individual session rates.
  const paceEligible=(s:StatSession):boolean=>s.itemIds.length===1&&!!s.activity&&!!s.progressUnit&&s.progressAmount!==null&&Number.isFinite(s.progressAmount)&&s.progressAmount>=0&&s.focusSeconds>=300&&s.end>s.start
  const ended=sessions.filter(paceEligible).sort((a,b)=>a.end-b.end),prior=new Map<string,{amount:number;seconds:number;n:number}>()
  const rateKey=(s:StatSession):string=>JSON.stringify([s.itemId,s.activity,s.progressUnit])
  let cursor=0
  for(const s of sessions){
    while(cursor<ended.length&&ended[cursor].end<=s.start){const p=ended[cursor++],key=rateKey(p),v=prior.get(key)??{amount:0,seconds:0,n:0};v.amount+=p.progressAmount!;v.seconds+=p.focusSeconds;v.n++;prior.set(key,v)}
    if(!paceEligible(s))continue
    const p=prior.get(rateKey(s));if(!p||p.n<3||p.seconds<=0)continue
    const usual=p.amount/p.seconds;if(usual>0)s.outcomes.progressRate=(s.progressAmount!/s.focusSeconds)/usual*100
  }

  // Derived factors.
  const derived: FactorDef[] = [
    { key: 'time-of-day', label: 'Time of day', group: 'derived', options: TIME_OF_DAY, multi: false },
    { key: 'weekday', label: 'Day of the week', group: 'derived', options: WEEKDAYS, multi: false },
    { key: 'position', label: 'Position in the sitting', group: 'derived', options: ['1st', '2nd', '3rd', '4th or later'], multi: false },
    { key: 'timer-mode', label: 'Timer mode', group: 'derived', options: ['Flow', 'Fixed', 'Adaptive'], multi: false },
    { key: 'goal-set', label: 'Session goal', group: 'derived', options: ['Goal set', 'No goal'], multi: false },
    { key: 'stage', label: 'Study-time milestones', group: 'derived', options: [...new Set(settings.stages.map((x) => x.name))], multi: false },
    { key: 'prior', label: 'Prior knowledge', group: 'derived', options: PRIOR_KNOWLEDGE.map((p) => p.label), multi: false },
    { key: 'rest-before', label: 'Rest before', group: 'derived', options: [], multi: false }
  ]
  const restActs = new Set<string>()
  for (const s of sessions) {
    s.factors['time-of-day'] = [timeOfDay(s.hour)]
    s.factors.weekday = [WEEKDAYS[s.weekday]]
    s.factors.position = [positionLabel(s.positionInSitting)]
    s.factors['timer-mode'] = [MODE_LABEL[s.timerMode]]
    s.factors['goal-set'] = [s.hasGoal ? 'Goal set' : 'No goal']
    s.factors.stage = [s.stage]
    const prior = PRIOR_KNOWLEDGE.find((p) => p.id === s.priorKnowledge)
    if (prior) s.factors.prior = [prior.label]
    if (s.restBefore) {
      const a = s.restBefore.skipped ? 'Skipped' : s.restBefore.activity ? cap(s.restBefore.activity) : 'Rest'
      s.factors['rest-before'] = [a]
      restActs.add(a)
    }
  }
  derived[derived.length - 1].options = [...restActs].sort()

  const order: FactorDef['group'][] = ['session', 'setup', 'day', 'detail', 'derived']
  const factors = [...usedFactors.values(), ...derived].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
  return { sessions, factors }
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

function restOf(b: RawBlock): StatRest | null {
  if (b.restPlannedSeconds === null && b.restActualSeconds === null && !b.restSkipped) return null
  return { activity: b.restActivity, plannedSeconds: b.restPlannedSeconds, actualSeconds: b.restActualSeconds, skipped: b.restSkipped, screen: b.restScreen }
}

// --- filters ----------------------------------------------------------------------

export interface StatsFilter {
  /** Study days, inclusive ("YYYY-MM-DD"); null = no limit. */
  from: string | null
  to: string | null
  itemId: number | null
  categoryId: number | null
  activity: string | null
}

export const NO_FILTER: StatsFilter = { from: null, to: null, itemId: null, categoryId: null, activity: null }

export function filterSessions(sessions: StatSession[], f: StatsFilter): StatSession[] {
  return sessions.filter(
    (s) =>
      (!f.from || s.day >= f.from) &&
      (!f.to || s.day <= f.to) &&
      (f.itemId === null || s.itemIds.includes(f.itemId)) &&
      (f.categoryId === null || (s.subjectParts??[{categoryId:s.categoryId,topCategoryId:s.topCategoryId}]).some(p=>p.categoryId===f.categoryId||p.topCategoryId===f.categoryId)) &&
      (f.activity === null || s.activity === f.activity)
  )
}
