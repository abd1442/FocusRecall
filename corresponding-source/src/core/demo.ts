// Demo data: about four months of plausible study, generated deterministically
// from a seed, for a separate demo database. Answers carry gentle, known
// patterns so the Stats page has something real to find:
// - focus: the library, a phone in another room, blockers and silence help;
//   a phone face up, music with lyrics, lying down, noise, late evenings, the
//   4th session of a sitting, short sleep and a skipped or screen-filled rest hurt.
// - recall: self-testing and flashcards help, re-reading and highlighting do not.
// - understanding: lower in a subject's first 20 hours and when it is new to me.
// Option answers are option ids; named scales are numbers.

export interface DemoCategory {
  key: string
  name: string
  color: string
  parentKey: string | null
}

export interface DemoItem {
  key: string
  categoryKey: string
  name: string
  color: string
  unit: string
  total: number | null
  activity: string
  pinned?: boolean
  prior: 'new' | 'some' | 'before' | 'well'
  hoursBefore: number
  newField: boolean
  buildsOn: string[]
  /** Usual difficulty, 1 to 10. */
  difficulty: number
}

export interface DemoDistraction {
  /** Wall-clock start, ms. */
  start: number
  duration: number
  source: 'manual' | 'auto' | 'idle'
  kind: string
  app?: string
  title?: string
  confirmed: boolean
}

export interface DemoWindow {
  start: number
  end: number
  process: string
  title: string
  stage: 'focus' | 'rest'
}

/** One part of a session (a session with a switch has two). */
export interface DemoBlock {
  /** Parts with the same number belong to one session. */
  session: number
  origin: 'normal' | 'live_switch'
  itemKey: string
  start: number
  end: number
  focusSeconds: number
  timerMode: 'flow' | 'fixed' | 'adaptive'
  targetSeconds: number
  pauses: { start: number; end: number }[]
  recallText: string | null
  recallRating: number | null
  recallTouched: boolean
  reviewMarked: boolean
  reviewNote: string | null
  /** Answers by log field key; option answers are option ids. */
  answers: Record<string, unknown>
  /** Keys of slider answers left at their default. */
  untouched: string[]
  distractions: DemoDistraction[]
  rest: { planned: number; actual: number; activity: string; skipped: boolean; screen: boolean } | null
  marks: { at: number; kind: 'stuck' | 'resisted' }[]
  windows: DemoWindow[]
}

export interface DemoSession {
  number: number
  goal: string | null
  goalResult: 'done' | 'partly' | 'not-done' | null
  windowSwitches: number
}

export interface DemoSitting {
  start: number
  end: number
  blocks: DemoBlock[]
}

export interface DemoDay {
  /** "YYYY-MM-DD" (the demo never studies before 04:00, so the study day is the date). */
  day: string
  answers: Record<string, unknown>
  untouched: string[]
}

export interface DemoData {
  categories: DemoCategory[]
  items: DemoItem[]
  sittings: DemoSitting[]
  sessions: DemoSession[]
  days: DemoDay[]
}

/** Small, fast, seedable PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CATEGORIES: DemoCategory[] = [
  { key: 'uni', name: 'University', color: '#5B8DEF', parentKey: null },
  { key: 'y3', name: 'Year 3', color: '#4FA3A5', parentKey: 'uni' },
  { key: 'online', name: 'Online courses', color: '#6BAA75', parentKey: null },
  { key: 'books', name: 'Books', color: '#D9A441', parentKey: null },
  { key: 'skills', name: 'Skills', color: '#A77BCA', parentKey: null }
]

const ITEMS: DemoItem[] = [
  { key: 'structures', categoryKey: 'y3', name: 'Structures II', color: '#4FA3A5', unit: 'chapters', total: 14, activity: 'problems', pinned: true, prior: 'some', hoursBefore: 4, newField: false, buildsOn: [], difficulty: 7 },
  { key: 'physics', categoryKey: 'y3', name: 'Building Physics', color: '#D9825B', unit: 'lectures', total: 24, activity: 'lecture-recorded', prior: 'new', hoursBefore: 0, newField: false, buildsOn: ['structures'], difficulty: 6 },
  { key: 'history', categoryKey: 'y3', name: 'History of Architecture', color: '#A77BCA', unit: 'pages', total: 380, activity: 'reading-book', prior: 'before', hoursBefore: 30, newField: false, buildsOn: [], difficulty: 4 },
  { key: 'lhtl', categoryKey: 'online', name: 'Learning How to Learn', color: '#6BAA75', unit: 'videos', total: 52, activity: 'lecture-recorded', pinned: true, prior: 'new', hoursBefore: 0, newField: true, buildsOn: [], difficulty: 3 },
  { key: 'python', categoryKey: 'online', name: 'CS50 Python', color: '#5B8DEF', unit: 'problems', total: null, activity: 'coding', prior: 'some', hoursBefore: 6, newField: false, buildsOn: [], difficulty: 6 },
  { key: 'habits', categoryKey: 'books', name: 'Atomic Habits', color: '#D9A441', unit: 'pages', total: 320, activity: 'reading-book', prior: 'well', hoursBefore: 0, newField: false, buildsOn: [], difficulty: 2 },
  { key: 'arabic', categoryKey: 'skills', name: 'Arabic calligraphy', color: '#8A9BA8', unit: 'sheets', total: null, activity: 'studio', prior: 'new', hoursBefore: 0, newField: true, buildsOn: [], difficulty: 5 }
]

const RECALLS: Record<string, string[]> = {
  structures: [
    'Moment distribution: unbalanced moments shared by stiffness factors.\nCarry-over factor is one half for prismatic members.\nUnclear: sign convention at fixed ends.',
    'Influence lines show the response at one point for a moving unit load.\nMüller-Breslau: release the restraint, the deflected shape is the influence line.',
    'Slope-deflection: end moments from rotations and chord rotation.\nNear end 4EI/L, far end 2EI/L.\nNext: frames with sway.'
  ],
  physics: [
    'U-value is the inverse of total thermal resistance.\nCondensation: compare dew point with the surface temperature.',
    'Daylight factor = indoor / outdoor illuminance under an overcast sky.\nالضوء الطبيعي يعتمد على حجم النافذة وعمق الغرفة.'
  ],
  history: ['Gothic: pointed arch, rib vault, flying buttress; walls open up for glass.\nSaint-Denis, Abbot Suger, 1140s.', "Renaissance: proportion, the orders, Brunelleschi's dome without centring."],
  lhtl: [
    'Focused and diffuse modes. Chunking needs focus, understanding and practice.\nProcrastination: focus on the process, not the product.',
    'Recall beats re-reading. Test yourself, space it out, interleave.'
  ],
  python: ['Exceptions: try, except, else, finally.\nUnit tests with pytest, one idea per test.', 'Regular expressions: groups, non-greedy matching, re.fullmatch.'],
  habits: ['Habits are the compound interest of self-improvement.\nFour laws: obvious, attractive, easy, satisfying.', 'Identity-based habits: decide who you want to be, prove it with small wins.'],
  arabic: ['Naskh proportions: the alif is the unit; dots measure letter height.\nالنسخ يعتمد على النقطة كوحدة قياس.']
}

const STUDY_WINDOWS: Record<string, { process: string; title: string }> = {
  structures: { process: 'AcroRd32', title: 'Structures II - Chapter notes.pdf - Adobe Acrobat' },
  physics: { process: 'chrome', title: 'Building Physics, Lecture 6 - Panopto - Google Chrome' },
  history: { process: 'AcroRd32', title: 'History of Architecture.pdf - Adobe Acrobat' },
  lhtl: { process: 'chrome', title: 'Learning How to Learn - Coursera - Google Chrome' },
  python: { process: 'Code', title: 'problem_set_4.py - Visual Studio Code' },
  habits: { process: 'Kindle', title: 'Atomic Habits - Kindle' },
  arabic: { process: 'Photos', title: 'Naskh practice sheet - Photos' }
}

const REVIEWS = ['Redo the carry-over example', 'Check the sign convention again', 'Summarise this chapter in five lines', 'Look up a worked example', 'Re-watch the last ten minutes']
const RESTS = ['walk', 'stretch', 'water', 'window', 'eyes closed', 'tidy the desk']
const GOALS = ['Finish the chapter', 'Two problem sets', 'Notes for lecture 6', 'Read 20 pages', 'One clean practice sheet', 'Summarise the last video']

const DETECTED = [
  { app: 'chrome', title: 'Top 10 bridges that failed - YouTube - Google Chrome', kind: 'website' },
  { app: 'chrome', title: 'r/architecture - Reddit - Google Chrome', kind: 'website' },
  { app: 'chrome', title: 'Home / X - Google Chrome', kind: 'website' },
  { app: 'Discord', title: '#general - Discord', kind: 'app' },
  { app: 'WhatsApp', title: 'WhatsApp', kind: 'app' }
]

const pick = <T>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length)]
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const dayKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** A setup kept for a whole sitting (it is remembered), with its effect on focus. */
function sittingSetup(r: () => number): { answers: Record<string, unknown>; effect: number } {
  const place = pick(r, ['desk-at-home', 'desk-at-home', 'desk-at-home', 'library', 'library', 'cafe', 'bedroom', 'kitchen-table'] as const)
  const atHome = place === 'desk-at-home' || place === 'bedroom' || place === 'kitchen-table'
  const posture = place === 'bedroom' ? pick(r, ['sitting-on-bed', 'lying-down', 'desk-chair'] as const) : pick(r, ['desk-chair', 'desk-chair', 'desk-chair', 'sofa'] as const)
  const phone = pick(r, ['another-room', 'in-a-bag-or-drawer', 'on-desk-face-down', 'on-desk-face-down', 'on-desk-face-up'] as const)
  const sound = pick(r, ['silence', 'silence', 'instrumental', 'lo-fi', 'music-with-lyrics'] as const)
  const internet = pick(r, ['normal', 'normal', 'normal', 'blockers-on', 'offline'] as const)
  const noise = place === 'cafe' ? pick(r, [2, 3]) : place === 'library' ? 1 : pick(r, [1, 1, 2, 3])
  const lighting = pick(r, ['daylight', 'daylight', 'bright-lamp', 'dim'] as const)
  const people = place === 'library' || place === 'cafe' ? 'others-present-and-quiet' : pick(r, ['alone', 'alone', 'others-talking'] as const)
  const pet = atHome && r() < 0.3 ? 'yes' : 'no'
  const effect =
    { library: 0.7, cafe: -0.2, bedroom: -0.4, 'desk-at-home': 0, 'kitchen-table': -0.1 }[place] +
    { 'another-room': 0.6, 'in-a-bag-or-drawer': 0.3, 'on-desk-face-down': 0, 'on-desk-face-up': -0.9 }[phone] +
    { silence: 0.2, instrumental: 0.1, 'lo-fi': 0, 'music-with-lyrics': -0.7 }[sound] +
    { normal: 0, 'blockers-on': 0.4, offline: 0.3 }[internet] +
    ({ 'lying-down': -0.8, 'sitting-on-bed': -0.4, sofa: -0.2, 'desk-chair': 0 } as Record<string, number>)[posture] +
    (noise === 3 ? -0.5 : 0) +
    (lighting === 'dim' ? -0.2 : 0) +
    (people === 'others-talking' ? -0.4 : 0)
  return {
    answers: {
      place,
      posture,
      device: pick(r, ['laptop', 'laptop', 'laptop', 'tablet', 'desktop']),
      screens: pick(r, [1, 1, 2]),
      sound,
      headphones: sound === 'silence' ? pick(r, ['none', 'none', 'noise-cancelling']) : pick(r, ['earbuds', 'over-ear', 'noise-cancelling']),
      noise,
      lighting,
      temperature: pick(r, [2, 2, 2, 3, 1]),
      people,
      pet,
      'phone-location': phone,
      'phone-mode': phone === 'on-desk-face-up' ? pick(r, ['normal', 'silent']) : pick(r, ['do-not-disturb', 'silent', 'off']),
      internet
    },
    effect
  }
}

/**
 * About four months of study ending yesterday (local time), deterministic for
 * a seed. `now` is a timestamp so the data always sits just before "today".
 */
export function generateDemo(now: number, seed = 20261012, weeks = 18): DemoData {
  const r = rng(seed)
  const progress: Record<string, number> = {}
  const hours: Record<string, number> = Object.fromEntries(ITEMS.map((i) => [i.key, i.hoursBefore]))
  const sittings: DemoSitting[] = []
  const sessions: DemoSession[] = []
  const days: DemoDay[] = []
  let sessionNo = 1
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  // Subjects come and go: a book is finished, a course starts later.
  const activeFrom: Record<string, number> = { structures: 0, physics: 3, history: 0, lhtl: 0, python: 6, habits: 0, arabic: 9 }
  const activeUntil: Record<string, number> = { habits: 8 }

  for (let d = weeks * 7; d >= 1; d--) {
    const day = new Date(today)
    day.setDate(day.getDate() - d)
    const week = weeks - Math.ceil(d / 7)
    const weekend = day.getDay() === 5 || day.getDay() === 6
    if (r() < (weekend ? 0.45 : 0.16)) continue

    // The day's check-in (most days).
    const sleepHours = clamp(Math.round((6.8 + (r() - 0.5) * 3) * 2) / 2, 4, 9.5)
    const dayEnergy = clamp(Math.round(2.5 + (sleepHours - 6.5) * 0.6 + (r() - 0.5) * 1.6), 1, 5)
    const dayAnswers: Record<string, unknown> = {
      'day-energy': dayEnergy,
      'day-mood': clamp(Math.round(3 + (r() - 0.5) * 2.5), 1, 5),
      sleep: sleepHours < 6 ? 1 : sleepHours < 7.5 ? 2 : 3,
      'sleep-hours': sleepHours,
      exercise: pick(r, [1, 1, 2, 2, 3, 4]),
      physical: r() < 0.7 ? ['fine'] : [pick(r, ['headache', 'eye-strain', 'back-or-neck-pain'])],
      pressure: week > weeks - 4 ? pick(r, [3, 4, 4]) : pick(r, [1, 1, 2, 2, 3])
    }
    const checkedIn = r() < 0.8
    if (checkedIn) days.push({ day: dayKey(day), answers: dayAnswers, untouched: r() < 0.15 ? ['day-mood'] : [] })
    const sleepEffect = sleepHours < 6 ? -0.6 : sleepHours >= 7.5 ? 0.3 : 0

    const sittingCount = r() < 0.3 ? 2 : 1
    let t = day.getTime() + (8 + r() * 3.5) * 3_600_000
    for (let si = 0; si < sittingCount; si++) {
      const blocks: DemoBlock[] = []
      const sittingStart = t
      const setup = sittingSetup(r)
      const mode = pick(r, ['flow', 'flow', 'flow', 'fixed', 'fixed', 'adaptive'] as const)
      const n = 1 + Math.floor(r() * 4)
      let restBefore: DemoBlock['rest'] = null
      for (let k = 0; k < n; k++) {
        const pool = ITEMS.filter((i) => week >= activeFrom[i.key] && (activeUntil[i.key] === undefined || week <= activeUntil[i.key]))
        const item = pick(r, r() < 0.6 ? pool.slice(0, Math.min(4, pool.length)) : pool)
        const hour = new Date(t).getHours()
        const timeEffect = hour < 12 ? 0.2 : hour >= 21 ? -0.6 : hour >= 17 ? -0.2 : 0
        const positionEffect = k >= 3 ? -0.5 : k === 2 ? -0.2 : 0
        const restEffect = restBefore ? (restBefore.skipped ? -0.4 : restBefore.screen ? -0.3 : 0.1) : 0
        const modeEffect = mode === 'fixed' ? 0.2 : 0
        const latent = 3 + setup.effect + timeEffect + positionEffect + restEffect + modeEffect + sleepEffect + (r() - 0.5) * 1.5
        const focus = clamp(Math.round(latent), 1, 5)
        const target = mode === 'fixed' ? pick(r, [25, 25, 45]) * 60 : mode === 'adaptive' ? pick(r, [30, 35, 40]) * 60 : 25 * 60
        const minutes =
          mode === 'fixed' ? Math.round(target / 60 + (r() < 0.3 ? r() * 4 : 0)) : Math.max(9, Math.round(14 + latent * 5 + (r() - 0.5) * 16))
        const pauses: DemoBlock['pauses'] = []
        let wall = minutes * 60_000
        const distractions: DemoDistraction[] = []
        if (r() < 0.12 + Math.max(0, 3 - latent) * 0.15) {
          const at = t + Math.round(r() * minutes * 0.6 * 60_000) + 60_000
          const len = Math.round((1 + r() * 4) * 60_000)
          pauses.push({ start: at, end: at + len })
          distractions.push({ start: at, duration: Math.round(len / 1000), source: 'manual', kind: pick(r, ['phone', 'phone', 'people', 'toilet-water', 'call-message', 'mind-wandering', 'food-drink']), confirmed: true })
          wall += len
        }
        // Detected apps and sites: more of them when focus was low or the phone was in view.
        const detected = Math.max(0, Math.round((3.6 - latent) * r() * 1.5))
        const sites: DemoWindow[] = []
        for (let m = 0; m < detected; m++) {
          const dd = pick(r, DETECTED)
          const at = t + Math.round(60_000 + r() * (wall - 240_000))
          const dur = Math.round(15 + r() * 110)
          distractions.push({ start: at, duration: dur, source: 'auto', kind: dd.kind, app: dd.app, title: dd.title, confirmed: r() < 0.7 })
          sites.push({ start: at, end: at + dur * 1000, process: dd.app, title: dd.title, stage: 'focus' })
        }
        if (r() < 0.05) {
          const at = t + Math.round(wall * 0.5)
          const len = Math.round((5.5 + r() * 4) * 60_000)
          pauses.push({ start: at, end: at + len })
          distractions.push({ start: at, duration: Math.round(len / 1000), source: 'idle', kind: 'away', confirmed: true })
          wall += len
        }
        distractions.sort((a, b) => a.start - b.start)

        // The study window in front, broken by the detected sites.
        const study = STUDY_WINDOWS[item.key]
        const windows: DemoWindow[] = []
        let cursor = t
        for (const s of [...sites].sort((a, b) => a.start - b.start)) {
          if (s.start > cursor) windows.push({ start: cursor, end: s.start, process: study.process, title: study.title, stage: 'focus' })
          windows.push(s)
          cursor = Math.max(cursor, s.end)
        }
        if (t + wall > cursor) windows.push({ start: cursor, end: t + wall, process: study.process, title: study.title, stage: 'focus' })

        const from = progress[item.key] ?? (item.unit === 'pages' ? 1 : 0)
        // With a total, about two thirds of it over the period, never past it; without one, a steady trickle.
        const pace = (focus / 3) * (minutes / 30) * (0.6 + r() * 0.8)
        const wanted = item.total ? Math.round(((item.total * 0.65) / 45) * pace) : item.unit === 'pages' ? Math.round(12 * pace) : Math.max(1, Math.round(pace))
        const amount = item.total ? Math.max(0, Math.min(wanted, item.total - from)) : wanted
        progress[item.key] = from + amount

        const firstHours = hours[item.key] < 20
        const methods = [pick(r, ['reading', 'typed-notes', 'practice-problems', 'following-along'])]
        if (r() < 0.35) methods.push('self-testing')
        if (r() < 0.25) methods.push('flashcards')
        if (r() < 0.3) methods.push('re-reading')
        if (r() < 0.25) methods.push('highlighting')
        const methodEffect = (methods.includes('self-testing') ? 0.6 : 0) + (methods.includes('flashcards') ? 0.4 : 0) - (methods.includes('re-reading') ? 0.4 : 0) - (methods.includes('highlighting') ? 0.3 : 0)
        const priorEffect = item.prior === 'before' || item.prior === 'well' ? 0.4 : item.prior === 'new' ? -0.2 : 0
        const difficulty = clamp(Math.round(item.difficulty + (r() - 0.5) * 3 + (firstHours ? 1 : 0)), 1, 10)
        const understanding = clamp(Math.round(1.6 + latent * 0.35 + priorEffect - (firstHours ? 0.45 : 0) - (difficulty - 5) * 0.12 + (r() - 0.5) * 1.2), 1, 4)
        const recallOn = r() < 0.85
        const recall = clamp(Math.round(latent * 0.7 + 0.9 + methodEffect + (r() - 0.5) * 1.3), 1, 5)

        const detail = r() < 0.55
        const answers: Record<string, unknown> = {
          activity: item.activity,
          ...(amount > 0 ? { progress: { amount, unit: item.unit, from, to: from + amount } } : {}),
          focus,
          difficulty,
          understanding,
          ...setup.answers,
          format: item.key === 'physics' || item.key === 'lhtl' ? 'video' : item.key === 'habits' ? 'e-reader' : pick(r, ['pdf', 'printed-book', 'pdf']),
          ...(detail
            ? {
                drinks: pick(r, ['water', 'water', 'coffee', 'tea', 'none']),
                food: pick(r, ['nothing', 'nothing', 'snacking', 'just-ate']),
                methods,
                ...(r() < 0.3 ? { side: [pick(r, ['fidget-toy', 'doodling', 'chewing-gum'])] } : {}),
                energy: clamp(Math.round(dayEnergy + (r() - 0.5) * 1.5 - k * 0.3), 1, 5),
                stress: clamp(Math.round(3 + Number(dayAnswers.pressure) + (r() - 0.5) * 3), 1, 10),
                motivation: clamp(Math.round(5 + latent - 3 + (r() - 0.5) * 3), 1, 10)
              }
            : {})
        }
        // About one slider in eight was left at its default.
        const untouched = ['focus', 'understanding', 'difficulty', ...(detail ? ['energy', 'stress', 'motivation'] : [])].filter(() => r() < 0.12)

        const skipped = r() < 0.1
        const restActual = skipped ? 0 : Math.round(Math.min(15, Math.max(5, minutes / 5)) * 60 * (0.7 + r() * 0.6))
        const screen = !skipped && r() < 0.2
        const rest = { planned: Math.round(Math.min(15, Math.max(5, minutes / 5)) * 60), actual: restActual, activity: pick(r, RESTS), skipped, screen }
        if (screen) windows.push({ start: t + wall + 30_000, end: t + wall + 30_000 + Math.min(restActual * 1000, 180_000), process: 'chrome', title: 'Home / X - Google Chrome', stage: 'rest' })

        const marks: DemoBlock['marks'] = []
        if (r() < 0.25) marks.push({ at: t + Math.round(wall * r()), kind: 'resisted' })
        if (r() < 0.12) marks.push({ at: t + Math.round(wall * r()), kind: 'resisted' })
        if (r() < 0.15) marks.push({ at: t + Math.round(wall * r()), kind: 'stuck' })

        const hasGoal = r() < 0.4
        const goalScore = latent + (r() - 0.5) * 1.5
        sessions.push({
          number: sessionNo,
          goal: hasGoal ? pick(r, GOALS) : null,
          goalResult: hasGoal ? (goalScore >= 3.4 ? 'done' : goalScore >= 2.5 ? 'partly' : 'not-done') : null,
          windowSwitches: Math.max(0, windows.filter((w) => w.stage === 'focus').length - 1 + Math.round(r() * 4))
        })

        const whole: DemoBlock = {
          session: sessionNo,
          origin: 'normal',
          itemKey: item.key,
          start: t,
          end: t + wall,
          focusSeconds: minutes * 60,
          timerMode: mode,
          targetSeconds: target,
          pauses,
          recallText: recallOn ? pick(r, RECALLS[item.key]) : null,
          recallRating: recallOn ? recall : null,
          recallTouched: !(recallOn && r() < 0.1),
          reviewMarked: r() < 0.2,
          reviewNote: null,
          answers,
          untouched,
          distractions,
          rest,
          marks,
          windows
        }
        if (whole.reviewMarked) whole.reviewNote = pick(r, REVIEWS)
        hours[item.key] += minutes / 60
        const other = pool.filter((i) => i.key !== item.key)
        if (r() < 0.15 && minutes >= 20 && other.length) blocks.push(...switchPart(whole, pick(r, other), 0.4 + r() * 0.3))
        else blocks.push(whole)
        sessionNo++
        restBefore = rest
        t += wall + restActual * 1000 + 30_000
      }
      sittings.push({ start: sittingStart, end: t, blocks })
      t += (2 + r() * 4) * 3_600_000
    }
  }
  return { categories: CATEGORIES, items: ITEMS, sittings, sessions, days }
}

/**
 * Cut a demo session into two parts at `fraction` of its time: the second part
 * is on another subject (a live switch). Pauses, distractions, windows and
 * marks go to the part they started in; the rest belongs to the last part.
 */
function switchPart(b: DemoBlock, second: DemoItem, fraction: number): DemoBlock[] {
  let cut = Math.round(b.start + (b.end - b.start) * fraction)
  // Never cut through a pause.
  for (const p of b.pauses) if (cut > p.start && cut < p.end) cut = p.end
  const removedIn = (from: number, to: number): number => b.pauses.reduce((sum, p) => sum + Math.max(0, Math.min(to, p.end) - Math.max(from, p.start)), 0)
  const focusA = Math.floor((cut - b.start - removedIn(b.start, cut)) / 1000)
  const focusWindows = b.windows.filter((w) => w.stage === 'focus')
  const a: DemoBlock = {
    ...b,
    end: cut,
    focusSeconds: focusA,
    pauses: b.pauses.filter((p) => p.start < cut),
    distractions: b.distractions.filter((d) => d.start < cut),
    marks: b.marks.filter((m) => m.at < cut),
    windows: focusWindows.filter((w) => w.start < cut).map((w) => ({ ...w, end: Math.min(w.end, cut) })),
    rest: null
  }
  const study = STUDY_WINDOWS[second.key]
  const c: DemoBlock = {
    ...b,
    origin: 'live_switch',
    itemKey: second.key,
    start: cut,
    focusSeconds: Math.floor((b.end - cut - removedIn(cut, b.end)) / 1000),
    pauses: b.pauses.filter((p) => p.start >= cut),
    distractions: b.distractions.filter((d) => d.start >= cut),
    marks: b.marks.filter((m) => m.at >= cut),
    windows: [
      { start: cut, end: b.end, process: study.process, title: study.title, stage: 'focus' },
      ...b.windows.filter((w) => w.stage === 'rest')
    ],
    recallText: b.recallText ? (RECALLS[second.key]?.[0] ?? null) : null,
    // The second subject's progress is not logged (so totals are never overshot).
    answers: Object.fromEntries(Object.entries({ ...b.answers, activity: second.activity }).filter(([k]) => k !== 'progress'))
  }
  return [a, c]
}
