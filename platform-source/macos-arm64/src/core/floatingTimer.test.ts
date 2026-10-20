import { describe, expect, it } from 'vitest'
import { floatingFocusClock, floatingPanelSize } from './floatingTimer'
import { clockDisplay } from './modes'
import type { RunningBlock } from './session'
import { openDatabase } from '../main/db/database'
import { SettingsRepo } from '../main/repos/settings'

const start = Date.UTC(2026, 9, 19, 9)
const iso = (seconds: number): string => new Date(start + seconds * 1000).toISOString()
const block = (patch: Partial<RunningBlock> = {}): RunningBlock => ({
  id: 1, sessionId: 1, sittingId: 1, itemId: 1, itemName: 'Fictional mechanics', itemColor: '#123456',
  timerMode: 'flow', targetSeconds: 1500, focusStartedAt: iso(0), pauses: [], targetAlerted: false, parts: [], ...patch
})

describe('floating timer views', () => {
  it('reads legacy appearances without writing them and saves the choice through the existing settings repository', () => {
    const db = openDatabase(':memory:')
    try {
      const repo = new SettingsRepo(db), legacy = { panelSize: 'small', panelOpacity: 0.6, colourId: 'original' }
      repo.writeRaw('appearance', legacy)
      expect(repo.getAppearance().panelTimerDisplay).toBe('digital')
      expect(repo.readRaw('appearance')).toEqual(legacy)
      repo.setAppearance({ ...repo.getAppearance(), panelTimerDisplay: 'circular' })
      const restarted = new SettingsRepo(db).getAppearance()
      expect(restarted).toMatchObject({ panelTimerDisplay: 'circular', panelSize: 'small', panelOpacity: 0.6 })
      expect(db.prepare('SELECT COUNT(*) AS n FROM blocks').get()).toEqual({ n: 0 })
      expect(repo.getAll().foregroundTrackingEnabled).toBe(false)
    } finally { db.close() }
  })
  for (const timerMode of ['flow', 'fixed', 'adaptive'] as const) {
    it(`preserves the existing ${timerMode} digital display`, () => {
      for (const seconds of [0, 300, 1499, 1500, 2100]) expect(floatingFocusClock(block({ timerMode }), start + seconds * 1000, 'digital')).toEqual(clockDisplay(timerMode, 1500, seconds))
    })
    it(`shows remaining time without changing the ${timerMode} session`, () => {
      const b = block({ timerMode }), before = structuredClone(b)
      expect(floatingFocusClock(b, start + 300000, 'circular')).toMatchObject({ main: '20:00', progress: 0.2, overtime: false })
      expect(floatingFocusClock(b, start + 1500000, 'circular')).toMatchObject({ main: '+00:00', progress: 1, overtime: true })
      expect(floatingFocusClock(b, start + 1800000, 'circular')).toMatchObject({ main: '+05:00', progress: 1, overtime: true })
      expect(b).toEqual(before)
    })
  }
  it('freezes during distraction and recovery pauses, resumes, and includes prior subject parts', () => {
    const b = block({ parts: [{ id: 2, itemId: 2, itemName: 'Earlier subject', itemColor: '#654321', focusSeconds: 300 }], pauses: [{ startedAt: iso(120), endedAt: null }] })
    const paused = floatingFocusClock(b, start + 180000, 'circular')
    expect(paused).toMatchObject({ main: '18:00', progress: 420 / 1500 })
    const recovered = JSON.parse(JSON.stringify(b)) as RunningBlock
    expect(floatingFocusClock(recovered, start + 8 * 3600000, 'circular')).toEqual(paused)
    recovered.pauses[0].endedAt = iso(8 * 3600)
    expect(floatingFocusClock(recovered, start + (8 * 3600 + 60) * 1000, 'circular').main).toBe('17:00')
    expect(floatingFocusClock(recovered, start + (8 * 3600 + 60) * 1000, 'digital').main).toBe('08:00')
  })
  it('reserves footer space and room for the centered ring in expanded and compact layouts', () => {
    expect(floatingPanelSize(false, 'digital')).toEqual({ width: 296, height: 98 })
    expect(floatingPanelSize(true, 'digital')).toEqual({ width: 360, height: 188 })
    expect(floatingPanelSize(false, 'circular').height).toBeGreaterThanOrEqual(240)
    expect(floatingPanelSize(true, 'circular').height).toBeGreaterThanOrEqual(320)
  })
  it('narrows Quick only, retaining title clearance and the approved ring size',()=>{
    for(const expanded of [false,true])for(const display of ['digital','circular'] as const){
      const quick=floatingPanelSize(expanded,display,true),full=floatingPanelSize(expanded,display)
      expect(quick.width).toBeLessThan(full.width)
      expect(quick.height).toBeGreaterThanOrEqual(full.height)
      if(display==='circular')expect(quick.width).toBeGreaterThanOrEqual(expanded?250:212)
    }
  })
})
