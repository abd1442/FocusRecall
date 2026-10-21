import { expect, it, vi } from 'vitest'
import { openDatabase } from '../main/db/database'
import { SessionEngine } from '../main/session'
import { SessionRepo } from '../main/repos/sessions'
import { SettingsRepo } from '../main/repos/settings'
import { LogRepo } from '../main/repos/logs'
import { CaptureRepo } from '../main/repos/captures'
import { DistractionRepo } from '../main/repos/distractions'

it.each(['full', 'quick'] as const)('%s resumes without a reason prompt and preserves exact paused time and legacy records', mode => {
  vi.useFakeTimers()
  const db = openDatabase(':memory:')
  let now = Date.parse('2026-10-21T10:00:00Z')
  const settings = new SettingsRepo(db)
  const engine = new SessionEngine(new SessionRepo(db), new LogRepo(db), new DistractionRepo(db), new CaptureRepo(db), settings, () => [], () => now, () => now)
  try {
    db.exec("INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'Fictional','#123456',0,'2026-10-21'); INSERT INTO items(id,category_id,name,color,created_at) VALUES(100,100,'Biology','#123456','2026-10-21'); INSERT INTO parked_thoughts(created_at,text,done) VALUES('2026-10-19','Fictional legacy note',1)")
    settings.writeRaw('hotkeyPark', 'F7')
    settings.writeRaw('captures', { ...settings.getAll().captures, park: true })
    const legacy = db.prepare('SELECT * FROM parked_thoughts').all()
    settings.set('studyExperience', mode)
    const emitted = vi.spyOn(engine, 'emit')
    const advance = (seconds: number): void => { for (let i = 0; i < seconds; i++) { now += 1000; vi.advanceTimersByTime(1000) } }
    engine.start({ itemId: 100, timerMode: 'flow', targetSeconds: 1500 })
    advance(12)
    engine.distracted()
    advance(7)
    engine.back()
    advance(9)
    expect((emitted.mock.calls as unknown as unknown[][]).some(call => call[0] === 'distractionEnded')).toBe(false)
    expect(db.prepare('SELECT duration_seconds FROM distractions').get()).toEqual({ duration_seconds: 7 })
    engine.finish()
    expect(db.prepare('SELECT focus_seconds FROM blocks').get()).toEqual({ focus_seconds: 21 })
    expect(db.prepare('SELECT * FROM parked_thoughts').all()).toEqual(legacy)
    expect(settings.getAll()).not.toHaveProperty('hotkeyPark')
    expect(settings.readRaw('hotkeyPark')).toBe('F7')
  } finally {
    engine.dispose()
    db.close()
    vi.restoreAllMocks()
    vi.useRealTimers()
  }
})
