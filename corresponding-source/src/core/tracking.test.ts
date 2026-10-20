import { describe, expect, it } from 'vitest'
import {
  appSummary,
  classify,
  countWindowSwitches,
  deriveAutoDistractions,
  isBrowser,
  nextRun,
  programRows,
  ruleForRow,
  ruleScope,
  siteOf,
  titleWords,
  suggestTitleWord,
  switchesPer10Min,
  unknownApps,
  type AppRule,
  type WindowRun
} from './tracking'

const rules: AppRule[] = [
  { id: 1, matchType: 'title', pattern: 'YouTube', classification: 'distraction' },
  { id: 2, matchType: 'process', pattern: 'chrome', classification: 'study' },
  { id: 3, matchType: 'process', pattern: 'Discord.exe', classification: 'distraction' },
  { id: 4, matchType: 'process', pattern: 'Trifocus', classification: 'ignore' }
]
const S = 1000
const run = (from: number, to: number, process: string, title = ''): WindowRun => ({ startedAt: from * S, endedAt: to * S, process, title })

describe('classify', () => {
  it('lets title rules win over process rules', () => {
    expect(classify('chrome', 'Lecture 4 - YouTube - Google Chrome', rules)).toBe('distraction')
    expect(classify('chrome', 'Course notes', rules)).toBe('study')
  })
  it('matches process names without case or .exe', () => {
    expect(classify('discord', '', rules)).toBe('distraction')
    expect(classify('DISCORD.EXE', '', rules)).toBe('distraction')
    expect(classify('Trifocus', 'Trifocus', rules)).toBe('ignore')
    expect(classify('notepad', 'x', rules)).toBe('unknown')
  })
})

describe('nextRun', () => {
  it('extends the run for the same window and closes it on a change', () => {
    let r = nextRun(null, { at: 0, process: 'a', title: 't' })
    expect(r.closed).toBeNull()
    r = nextRun(r.current, { at: 2 * S, process: 'a', title: 't' })
    expect(r.current).toEqual(run(0, 2, 'a', 't'))
    r = nextRun(r.current, { at: 4 * S, process: 'b', title: 't' })
    expect(r.closed).toEqual(run(0, 4, 'a', 't'))
    expect(r.current).toEqual(run(4, 4, 'b', 't'))
  })
})

describe('deriveAutoDistractions', () => {
  it('keeps distraction runs of 10 seconds or more', () => {
    const out = deriveAutoDistractions([run(0, 8, 'discord'), run(20, 40, 'discord'), run(40, 60, 'notepad')], rules, [])
    expect(out).toEqual([{ startedAt: 20 * S, durationSeconds: 20, process: 'discord', title: '', kind: 'app' }])
  })
  it('joins back-to-back runs of one program and marks title matches as websites', () => {
    const out = deriveAutoDistractions([run(0, 6, 'chrome', 'A - YouTube'), run(6, 12, 'chrome', 'B - YouTube')], rules, [])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ startedAt: 0, durationSeconds: 12, kind: 'website' })
  })
  it('does not count time already removed as Distracted', () => {
    expect(deriveAutoDistractions([run(0, 30, 'discord')], rules, [{ start: 0, end: 25 * S }])).toEqual([])
    expect(deriveAutoDistractions([run(0, 30, 'discord')], rules, [{ start: 0, end: 15 * S }])[0].durationSeconds).toBe(15)
  })
})

describe('unknownApps', () => {
  it('sums programs without a rule that held the front 30 seconds or more', () => {
    const out = unknownApps([run(0, 20, 'notepad', 'a.txt'), run(30, 45, 'notepad', 'b.txt'), run(50, 60, 'paint'), run(60, 200, 'chrome')], rules)
    expect(out).toEqual([{ process: 'notepad', site: null, seconds: 35, exampleTitle: 'a.txt' }])
  })
})

describe('rules for one subject', () => {
  const subjectRules: AppRule[] = [...rules, { id: 9, matchType: 'title', pattern: 'YouTube', classification: 'study', itemId: 7 }]
  it('win over general rules while studying that subject only', () => {
    expect(classify('chrome', 'Lecture 4 - YouTube', subjectRules, 7)).toBe('study')
    expect(classify('chrome', 'Lecture 4 - YouTube', subjectRules, 8)).toBe('distraction')
    expect(classify('chrome', 'Lecture 4 - YouTube', subjectRules)).toBe('distraction')
  })
  it('turn off detection for that subject', () => {
    expect(deriveAutoDistractions([run(0, 30, 'chrome', 'Lecture - YouTube')], subjectRules, [], 10, 7)).toEqual([])
    expect(deriveAutoDistractions([run(0, 30, 'chrome', 'Lecture - YouTube')], subjectRules, [], 10, 8)).toHaveLength(1)
  })
})

describe('browsers and sites', () => {
  it('recognises browsers and guesses the site in a title', () => {
    expect(isBrowser('chrome.exe')).toBe(true)
    expect(isBrowser('notepad')).toBe(false)
    expect(suggestTitleWord('Lecture 4 - YouTube - Google Chrome')).toBe('YouTube')
    expect(suggestTitleWord('Inbox | Gmail')).toBe('Gmail')
    expect(suggestTitleWord('Wikipedia - Google Chrome')).toBe('Wikipedia')
    expect(suggestTitleWord('Notes')).toBe('Notes')
    expect(suggestTitleWord('SNEAKO Stream - Watch Live on Kick - Helium')).toBe('Kick')
    expect(suggestTitleWord('Hold on tight')).toBe('Hold on tight')
  })
  it('lists unknown sites in a browser separately', () => {
    const out = unknownApps([run(0, 40, 'msedge', 'Page - Wikipedia - Microsoft Edge'), run(40, 80, 'msedge', 'Docs - Notion - Microsoft Edge')], [])
    expect(out.map((u) => u.site)).toEqual(['Wikipedia', 'Notion'])
  })
})

describe('appSummary', () => {
  it('sums time per program and site with its tag, largest first, leaving out Trifocus', () => {
    const out = appSummary([run(0, 100, 'chrome', 'A - YouTube - Google Chrome'), run(100, 130, 'notepad', 'x'), run(130, 400, 'Trifocus', 'Trifocus'), run(400, 450, 'chrome', 'B - YouTube - Google Chrome')], rules)
    expect(out).toEqual([
      { label: 'YouTube (chrome)', process: 'chrome', site: 'YouTube', seconds: 150, classification: 'distraction' },
      { label: 'notepad', process: 'notepad', site: null, seconds: 30, classification: 'unknown' }
    ])
  })
})

describe('window switches', () => {
  it('counts changes of program or window, not Trifocus', () => {
    const runs = [run(0, 10, 'chrome', 'a'), run(10, 20, 'chrome', 'b'), run(20, 30, 'Trifocus', 'T'), run(30, 40, 'chrome', 'b'), run(40, 50, 'word', 'doc')]
    expect(countWindowSwitches(runs)).toBe(2)
    expect(switchesPer10Min(5, 1500)).toBe(2)
    expect(switchesPer10Min(5, 0)).toBe(0)
  })
})

describe('decisions per site, with a scope', () => {
  const r = (id: number, p: Partial<AppRule>): AppRule => ({ id, matchType: 'title', pattern: 'YouTube', classification: 'distraction', ...p })
  const title = 'Week 2 - Barbara Oakley - YouTube - Google Chrome'
  it('uses this session, then this subject, then always, then the latest choice anywhere', () => {
    const rules = [
      r(1, { classification: 'distraction' }),
      r(2, { classification: 'study', itemId: 7, updatedAt: '2026-10-10' }),
      r(3, { classification: 'ignore', sessionId: 42, updatedAt: '2026-10-11' })
    ]
    expect(classify('chrome', title, rules, { itemId: 7, sessionId: 42 })).toBe('ignore')
    expect(classify('chrome', title, rules, { itemId: 7, sessionId: 43 })).toBe('study')
    expect(classify('chrome', title, rules, { itemId: 8 })).toBe('distraction')
    // No "always" rule: the latest choice anywhere decides.
    expect(classify('chrome', title, rules.slice(1), { itemId: 8 })).toBe('ignore')
    expect(classify('chrome', 'Notes', rules.slice(1), { itemId: 8 })).toBe('unknown')
  })
  it('lets a refined rule (more words) win within its tier', () => {
    const rules = [r(1, { classification: 'distraction' }), r(2, { pattern: 'YouTube + Barbara Oakley', classification: 'study' })]
    expect(titleWords('YouTube + Barbara Oakley')).toEqual(['youtube', 'barbara oakley'])
    expect(classify('chrome', title, rules)).toBe('study')
    expect(classify('chrome', 'Cats - YouTube - Google Chrome', rules)).toBe('distraction')
  })
  it('names the scope of a rule', () => {
    expect(ruleScope({ sessionId: 1, itemId: 2 })).toBe('session')
    expect(ruleScope({ itemId: 2 })).toBe('subject')
    expect(ruleScope({})).toBe('always')
  })
})

describe('programRows', () => {
  it('merges title variants and browser/desktop appearances controlled by the same site rule', () => {
    const rules: AppRule[] = [{ id: 10, matchType: 'title', pattern: 'Claude', classification: 'study' }]
    const rows = programRows([run(0, 20, 'chrome', 'A - Claude - Google Chrome'), run(20, 50, 'Claude', 'Claude'), run(50, 65, 'helium', 'B | Claude')], rules)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ label: 'Claude', seconds: 65, classification: 'study', rule: rules[0] })
    expect(rows[0].titles.map(t=>t.seconds)).toEqual([30, 20, 15])
    expect(ruleForRow(rows[0])).toEqual({ matchType: 'title', pattern: 'Claude' })
  })
  it('keeps a title exception within one site and reports mixed classifications', () => {
    const scoped: AppRule[] = [rules[0], { id: 8, matchType: 'title', pattern: 'YouTube + Lecture', classification: 'study' }]
    const rows = programRows([run(0, 20, 'chrome', 'Lecture - YouTube'), run(20, 50, 'chrome', 'Cats - YouTube')], scoped)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ seconds: 50, classification: 'mixed', rule: rules[0] })
    expect(rows[0].titles.map(t=>t.classification)).toEqual(['distraction', 'study'])
    expect(ruleForRow(rows[0])).toEqual({ matchType: 'title', pattern: 'YouTube' })
  })
  it('aggregates time across parts and subjects, preserving each title context', () => {
    const scoped: AppRule[] = [rules[0], { id: 8, matchType: 'title', pattern: 'YouTube', classification: 'study', itemId: 7 }]
    const rows = programRows([
      { ...run(0, 20, 'chrome', 'A - YouTube'), context: { itemId: 7, sessionId: 1 } },
      { ...run(20, 50, 'chrome', 'A - YouTube'), context: { itemId: 8, sessionId: 1 } },
      { ...run(50, 75, 'chrome', 'A - YouTube'), context: { itemId: 7, sessionId: 1 } }
    ], scoped)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ seconds: 75, itemId: 7, classification: 'mixed' })
    expect(rows[0].titles.map(t=>[t.itemId,t.seconds])).toEqual([[7,45],[8,30]])
  })
  it('applies the duration cutoff after merging and keeps title keys stable when a rule changes', () => {
    const runs = [run(0, 2, 'chrome', 'A - YouTube'), run(2, 4, 'chrome', 'B - YouTube')]
    const before = programRows(runs, [])
    expect(before).toHaveLength(1)
    expect(programRows(runs, rules)[0].titles.map(t=>t.key)).toEqual(before[0].titles.map(t=>t.key))
    expect(programRows([run(5, 2, 'chrome', 'A - YouTube')], [])).toEqual([])
  })
  it('lists browser sites one by one, programs by name, with what they count as', () => {
    const rules: AppRule[] = [{ id: 1, matchType: 'title', pattern: 'Kick', classification: 'distraction' }]
    const rows = programRows(
      [run(0, 59, 'chrome', 'Lesson 1 | Coursera - Google Chrome'), run(59, 75, 'chrome', 'Chat - Claude - Helium'), run(75, 81, 'chrome', 'Watch the VOD - Kick - Helium'), run(81, 100, 'word', 'Essay'), run(100, 300, 'Trifocus', 'x')],
      rules
    )
    expect(rows.map((x) => [x.label, x.seconds, x.classification])).toEqual([
      ['Coursera', 59, 'unknown'],
      ['word', 19, 'unknown'],
      ['Claude', 16, 'unknown'],
      ['Kick', 6, 'distraction']
    ])
    expect(ruleForRow(rows[0])).toEqual({ matchType: 'title', pattern: 'Coursera' })
    expect(ruleForRow(rows[1])).toEqual({ matchType: 'process', pattern: 'word' })
    expect(siteOf('chrome', '')).toMatchObject({ site: null })
  })
})
