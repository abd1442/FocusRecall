import { isOwnAppProcess } from './identity'
// Automatic tracking: classify foreground windows with the app rules, turn
// samples into runs, and derive distractions, unknown programs, the session's
// app summary and its window switches from the runs.
import { overlapMs, type Interval } from './timer'

export type Classification = 'study' | 'distraction' | 'ignore'

export interface AppRule {
  id: number
  /** 'process': the program name (without .exe). 'title': a word in the window title (how websites are matched). */
  matchType: 'process' | 'title'
  pattern: string
  classification: Classification
  /** Set: the rule applies only while studying this subject (e.g. YouTube is study for a lecture course). */
  itemId?: number | null
  /** Set: "just this session". Such a rule decides only in that session (and is a hint elsewhere). */
  sessionId?: number | null
  /** When the choice was made; the most recent choice anywhere is the fallback for a site. */
  updatedAt?: string | null
}

export type RuleScope = 'session' | 'subject' | 'always'

export function ruleScope(r: Pick<AppRule, 'sessionId' | 'itemId'>): RuleScope {
  return r.sessionId ? 'session' : r.itemId ? 'subject' : 'always'
}

/** Where a window is being judged: the subject studied and the session. */
export interface RuleContext {
  itemId?: number | null
  sessionId?: number | null
}

const ctxOf = (c: RuleContext | number | null | undefined): RuleContext => (typeof c === 'number' ? { itemId: c } : (c ?? {}))

/** Shown when Windows gives no title (for example an elevated window). */
export const NO_TITLE = 'unknown, no title'

const norm = (s: string): string => s.trim().toLowerCase().replace(/\.exe$/, '')

/** The words a title rule needs, all of them: "YouTube + Barbara Oakley". */
export function titleWords(pattern: string): string[] {
  return pattern
    .split('+')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
}

const titleHit = (r: AppRule, title: string): boolean => {
  if (r.matchType !== 'title'||title===NO_TITLE||!title.trim()) return false
  const words = titleWords(r.pattern)
  const t = title.toLowerCase()
  return words.length > 0 && words.every((w) => t.includes(w))
}
const processHit = (r: AppRule, process: string): boolean => r.matchType === 'process' && norm(r.pattern) === norm(process)

/** In one tier: the most specific title rule (most words) first, then a program rule. */
function pick(set: AppRule[], process: string, title: string): AppRule | null {
  const byTitle = set.filter((r) => titleHit(r, title)).sort((a, b) => titleWords(b.pattern).length - titleWords(a.pattern).length)
  if (byTitle[0]) return byTitle[0]
  return set.find((r) => processHit(r, process)) ?? null
}

/**
 * The rule that decides a window, in tiers:
 * 1. a choice for this session;
 * 2. a choice for this subject;
 * 3. an "always" rule;
 * 4. otherwise the most recent choice for it anywhere (another subject or session).
 * Within a tier, a refined title rule (more words) wins, then a title word, then
 * a program, so a browser marked as study still counts a YouTube tab as a distraction.
 */
export function matchRule(process: string, title: string, rules: AppRule[], context: RuleContext | number | null = null): AppRule | null {
  const ctx = ctxOf(context)
  const session = ctx.sessionId ? rules.filter((r) => r.sessionId === ctx.sessionId) : []
  const subject = ctx.itemId ? rules.filter((r) => !r.sessionId && r.itemId === ctx.itemId) : []
  const always = rules.filter((r) => !r.sessionId && !r.itemId)
  for (const set of [session, subject, always]) {
    const hit = pick(set, process, title)
    if (hit) return hit
  }
  const elsewhere = rules
    .filter((r) => !session.includes(r) && !subject.includes(r) && !always.includes(r))
    .filter((r) => titleHit(r, title) || processHit(r, process))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || titleWords(b.pattern).length - titleWords(a.pattern).length)
  return elsewhere[0] ?? null
}

/** The classification of a window, or 'unknown' when no rule matches. */
export function classify(process: string, title: string, rules: AppRule[], context: RuleContext | number | null = null): Classification | 'unknown' {
  return matchRule(process, title, rules, context)?.classification ?? 'unknown'
}

/**
 * What a window counts as for decisions: a browser by its site (from the
 * title), anything else by its program. Browsers are never one program.
 */
export function siteOf(process: string, title: string): { key: string; label: string; site: string | null } {
  if (isBrowser(process)) {
    const site = title && title !== NO_TITLE ? suggestTitleWord(title) : ''
    if (site) return { key: `site:${site.toLowerCase()}`, label: site, site }
    return { key: `site:${process.toLowerCase()}`, label: `${process} (no title)`, site: null }
  }
  return { key: `program:${norm(process)}`, label: process || NO_TITLE, site: null }
}

/** The rule a decision on a row makes: a site word for a browser site, the program otherwise. */
export function ruleForRow(row: { process: string; site: string | null }): Pick<AppRule, 'matchType' | 'pattern'> {
  return row.site ? { matchType: 'title', pattern: row.site } : { matchType: 'process', pattern: row.process }
}

export interface ProgramRow {
  key: string
  label: string
  process: string
  site: string | null
  seconds: number
  /** What it counts as now; 'unknown' shows as "Needs a look". */
  classification: Classification | 'unknown' | 'mixed'
  /** The rule deciding it, if any (for the scope shown beside the toggle). */
  rule: AppRule | null
  exampleTitle: string
  /** The subject it was studied under (where it was in front longest), for "For this subject". */
  itemId?: number | null
  titles: ProgramTitle[]
}

export interface ProgramTitle {
  key: string
  title: string
  process: string
  seconds: number
  classification: Classification | 'unknown'
  rule: AppRule | null
  itemId?: number | null
}

export interface ContextualWindowRun extends WindowRun {
  context?: RuleContext
}

/**
 * Every program and site in front during a session, with what it counts as,
 * largest first. FocusRecall itself is left out.
 */
export function programRows(runs: ContextualWindowRun[], rules: AppRule[], context: RuleContext | number | null = null, minSeconds = 3): ProgramRow[] {
  const m = new Map<string, { row: ProgramRow; titles: Map<string, ProgramTitle>; contexts: Map<string, { seconds: number; context: RuleContext; process: string }> }>()
  for (const r of runs) {
    if (isOwnAppProcess(norm(r.process))) continue
    const secs = Math.max(0, (r.endedAt - r.startedAt) / 1000)
    if (!secs) continue
    const ctx = r.context ?? ctxOf(context)
    const rule = matchRule(r.process, r.title, rules, ctx)
    const s = siteOf(r.process, r.title)
    // A title rule may recognise a site when the browser title parser cannot.
    // Refined rules stay inside that site's parent row, never as duplicate toggles.
    const ruleBase = rule?.matchType === 'title'
      ? (s.site && titleWords(rule.pattern).includes(s.site.toLowerCase()) ? s.site : rule.pattern.split('+')[0].trim())
      : null
    const base = ruleBase && (isBrowser(r.process) || norm(ruleBase) === norm(r.process)) ? ruleBase : s.site
    const key = base ? `site:${base.toLowerCase()}` : s.key
    let e = m.get(key)
    if (!e) {
      e = {
        row: { key, label: base ?? s.label, process: r.process, site: base, seconds: 0, classification: 'unknown', rule: null, exampleTitle: r.title, titles: [] },
        titles: new Map(), contexts: new Map()
      }
      m.set(key, e)
    }
    e.row.seconds += secs
    const contextKey = `${ctx.itemId ?? ''}:${ctx.sessionId ?? ''}`
    const c = e.contexts.get(contextKey) ?? { seconds: 0, context: ctx, process: r.process }
    c.seconds += secs
    e.contexts.set(contextKey, c)
    const titleKey = `${r.title}\u0000${contextKey}\u0000${norm(r.process)}`
    const t = e.titles.get(titleKey) ?? { key: titleKey, title: r.title || NO_TITLE, process: r.process, seconds: 0, classification: rule?.classification ?? 'unknown', rule, itemId: ctx.itemId }
    t.seconds += secs
    e.titles.set(titleKey, t)
  }
  return [...m.values()]
    .filter((e) => e.row.seconds >= minSeconds)
    .map(({ row, titles, contexts }) => {
      const dominant = [...contexts.values()].sort((a, b) => b.seconds - a.seconds)[0]
      const list = [...titles.values()].sort((a, b) => b.seconds - a.seconds)
      const classes = new Set(list.map((t) => t.classification))
      // The parent's rule must be the site-wide rule, not one title's exception.
      const rule = matchRule(dominant.process, row.site ?? '', rules, dominant.context)
      return { ...row, process: dominant.process, rule, itemId: dominant.context.itemId, titles: list, exampleTitle: list[0].title,
        classification: classes.size === 1 ? list[0].classification : 'mixed' as const }
    })
    .sort((a, b) => b.seconds - a.seconds)
}

const BROWSERS = new Set(['chrome', 'msedge', 'firefox', 'brave', 'opera', 'vivaldi', 'arc', 'helium', 'iexplore', 'safari', 'librewolf', 'waterfox', 'zen', 'thorium'])

/** Browsers show many sites; for them a title word usually makes a better rule than the program. */
export function isBrowser(process: string): boolean {
  return BROWSERS.has(norm(process))
}

/**
 * A guess at the site in a browser title, to offer as the title word:
 * "Lecture 4 - YouTube - Google Chrome" gives "YouTube". The user confirms or edits it.
 */
export function suggestTitleWord(title: string): string {
  const parts = title
    .split(/\s+[-–—|·]\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const browserName = /\b(chrome|edge|firefox|brave|opera|vivaldi|helium|arc|browser)\b/i
  const pick = parts.length >= 3 ? parts[parts.length - 2] : parts.length === 2 ? (browserName.test(parts[1]) ? parts[0] : parts[1]) : (parts[0] ?? '')
  // "Watch Live on Kick" names the site at the end: keep "Kick".
  const on = /\s+on\s+(\S+(?:\s\S+)?)$/i.exec(pick)
  return on && parts.length >= 2 ? on[1] : pick
}

export interface ForegroundSample {
  at: number
  process: string
  title: string
}

/** One stretch of time with the same window in front. */
export interface WindowRun {
  startedAt: number
  endedAt: number
  process: string
  title: string
}

/**
 * Feed one sample into the current run. The same window extends the run;
 * a different one closes it at the moment of the sample and starts a new one.
 */
export function nextRun(current: WindowRun | null, s: ForegroundSample): { current: WindowRun; closed: WindowRun | null } {
  if (current && current.process === s.process && current.title === s.title) {
    return { current: { ...current, endedAt: Math.max(current.endedAt, s.at) }, closed: null }
  }
  const closed = current ? { ...current, endedAt: Math.max(current.endedAt, s.at) } : null
  return { current: { startedAt: s.at, endedAt: s.at, process: s.process, title: s.title }, closed }
}

export interface AutoDistraction {
  startedAt: number
  durationSeconds: number
  process: string
  title: string
  /** 'website' when a title rule matched, 'app' when a process rule did. */
  kind: 'app' | 'website'
}

/** Runs on a distraction this close together (same program) count as one. */
const JOIN_GAP_MS = 3_000

/**
 * Distractions from a part's window runs: distraction-classified runs of
 * `minSeconds` or more, not counting time already removed (Distracted spells
 * and confirmed idle). Back-to-back runs of the same program join up, so a
 * video site whose title changes with every video is one distraction.
 */
export function deriveAutoDistractions(runs: WindowRun[], rules: AppRule[], removed: Interval[], minSeconds = 10, context: RuleContext | number | null = null): AutoDistraction[] {
  const hits = runs
    .map((r) => ({ r, rule: matchRule(r.process, r.title, rules, context) }))
    .filter((x) => x.rule?.classification === 'distraction')
    .sort((a, b) => a.r.startedAt - b.r.startedAt)
  const joined: { run: WindowRun; byTitle: boolean }[] = []
  for (const { r, rule } of hits) {
    const last = joined[joined.length - 1]
    // Back-to-back runs of the same site (or program) join up.
    if (last && siteOf(last.run.process, last.run.title).key === siteOf(r.process, r.title).key && r.startedAt - last.run.endedAt <= JOIN_GAP_MS)
      last.run.endedAt = Math.max(last.run.endedAt, r.endedAt)
    else joined.push({ run: { ...r }, byTitle: rule!.matchType === 'title' })
  }
  const out: AutoDistraction[] = []
  for (const { run: r, byTitle } of joined) {
    const ms = r.endedAt - r.startedAt - overlapMs(removed.map((iv) => ({ start: iv.start, end: iv.end ?? r.endedAt })), r.startedAt, r.endedAt)
    if (ms < minSeconds * 1000) continue
    out.push({ startedAt: r.startedAt, durationSeconds: ms / 1000, process: r.process, title: r.title, kind: byTitle ? 'website' : 'app' })
  }
  return out
}

export interface UnknownApp {
  process: string
  /** For browsers: the site guessed from the titles, offered as the title word. Null for other programs. */
  site: string | null
  seconds: number
  /** The title it showed longest, as an example. */
  exampleTitle: string
}

/**
 * Programs (and, in browsers, sites) with no rule that held the foreground for
 * `minSeconds` or more in total.
 */
export function unknownApps(runs: WindowRun[], rules: AppRule[], minSeconds = 30, itemId: number | null = null): UnknownApp[] {
  const m = new Map<string, { process: string; site: string | null; seconds: number; titles: Map<string, number> }>()
  for (const r of runs) {
    if (classify(r.process, r.title, rules, itemId) !== 'unknown') continue
    const process = r.process || NO_TITLE
    const site = isBrowser(process) && r.title !== NO_TITLE ? suggestTitleWord(r.title) || null : null
    const key = `${process}\u0000${site ?? ''}`
    const e = m.get(key) ?? { process, site, seconds: 0, titles: new Map() }
    const s = (r.endedAt - r.startedAt) / 1000
    e.seconds += s
    e.titles.set(r.title, (e.titles.get(r.title) ?? 0) + s)
    m.set(key, e)
  }
  return [...m.values()]
    .filter((e) => e.seconds >= minSeconds)
    .map((e) => ({ process: e.process, site: e.site, seconds: e.seconds, exampleTitle: [...e.titles.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.seconds - a.seconds)
}

export interface AppTime {
  /** "YouTube (chrome)" for a site in a browser, the program name otherwise. */
  label: string
  process: string
  site: string | null
  seconds: number
  classification: Classification | 'unknown'
}

/** Time per program and site during a session, largest first. */
export function appSummary(runs: WindowRun[], rules: AppRule[], itemId: number | null = null, top = 5): AppTime[] {
  const m = new Map<string, AppTime>()
  for (const r of runs) {
    if (isOwnAppProcess(r.process)) continue
    const site = isBrowser(r.process) && r.title !== NO_TITLE ? suggestTitleWord(r.title) || null : null
    const key = `${r.process}\u0000${site ?? ''}`
    const e = m.get(key) ?? { label: site ? `${site} (${r.process})` : r.process || NO_TITLE, process: r.process, site, seconds: 0, classification: classify(r.process, r.title, rules, itemId) }
    e.seconds += (r.endedAt - r.startedAt) / 1000
    m.set(key, e)
  }
  return [...m.values()].sort((a, b) => b.seconds - a.seconds).slice(0, top)
}

/**
 * How often the window in front changed: a different program, or another
 * window or tab of the same program. FocusRecall's own windows do not count.
 */
export function countWindowSwitches(runs: WindowRun[]): number {
  const seen = runs.filter((r) => !isOwnAppProcess(r.process)).sort((a, b) => a.startedAt - b.startedAt)
  let n = 0
  for (let i = 1; i < seen.length; i++) {
    const a = seen[i - 1]
    const b = seen[i]
    if (a.process !== b.process || a.title !== b.title) n++
  }
  return n
}

/** Switches per 10 minutes of session time. */
export function switchesPer10Min(switches: number, sessionSeconds: number): number {
  return sessionSeconds > 0 ? (switches * 600) / sessionSeconds : 0
}

/** The starting list, all editable in Settings. Websites are title words: Windows gives browsers' titles, not their addresses. */
export const SEED_APP_RULES: Omit<AppRule, 'id'>[] = [
  ...['Discord', 'WhatsApp', 'Telegram', 'Messenger', 'Signal', 'Steam', 'EpicGamesLauncher', 'Battle.net', 'RiotClientServices', 'Netflix', 'TikTok', 'Instagram'].map(
    (pattern) => ({ matchType: 'process' as const, pattern, classification: 'distraction' as const })
  ),
  ...['YouTube', 'Netflix', 'Facebook', 'Instagram', 'TikTok', 'Twitter', 'Reddit', 'Twitch', 'WhatsApp', 'Messenger', 'Discord', 'Telegram', 'Prime Video', 'Disney+', 'Snapchat', 'Pinterest', '9GAG'].map(
    (pattern) => ({ matchType: 'title' as const, pattern, classification: 'distraction' as const })
  ),
  ...['FocusRecall', 'LockApp', 'ShellExperienceHost', 'StartMenuExperienceHost', 'SearchHost', 'SearchApp'].map(
    (pattern) => ({ matchType: 'process' as const, pattern, classification: 'ignore' as const })
  )
]
