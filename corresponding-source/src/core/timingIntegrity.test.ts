import Database from 'better-sqlite3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openDatabase, type Db } from '../main/db/database'
import { SessionRepo } from '../main/repos/sessions'
import { LogRepo } from '../main/repos/logs'
import { SettingsRepo } from '../main/repos/settings'
import { DistractionRepo } from '../main/repos/distractions'
import { CaptureRepo } from '../main/repos/captures'
import { SessionEngine } from '../main/session'
import { runningFocusSeconds } from './session'
import { ObservedClock } from './timingIntegrity'
import { ReviewTimer } from './review'

let db: Db, engine: SessionEngine, wall: number, monotonic: number
const make = (): SessionEngine => new SessionEngine(new SessionRepo(db), new LogRepo(db), new DistractionRepo(db), new CaptureRepo(db), new SettingsRepo(db), () => [], () => wall, () => monotonic)
const start = (timerMode: 'flow' | 'fixed' | 'adaptive' = 'flow'): void => { engine.start({ itemId: 100, timerMode, targetSeconds: 1500 }) }
// Both clocks advance while the event loop actually observes each second.
const study = (ms: number): void => {
  for (let left = ms; left > 0;) { const step = Math.min(left, 1000); wall += step; monotonic += step; vi.advanceTimersByTime(step); left -= step }
}
const sleep = (monoAdvances = true): void => { wall += 8 * 3600000; if (monoAdvances) monotonic += 8 * 3600000 }
const restart = (): void => { engine.dispose(); engine = make() }
const rest = (): void => { start(); study(600000); engine.finish(); engine.finishWrapUp(engine.get().finished.map(b => ({ blockId: b.id, values: {}, notes: {} })), 'break') }
beforeEach(() => {
  vi.useFakeTimers(); wall = Date.parse('2026-10-17T10:00:00Z'); monotonic = 0
  db = openDatabase(':memory:')
  db.prepare("INSERT INTO categories(id,name,color,sort_order,created_at) VALUES(100,'Fictional QA','#123456',0,'2026-10-17')").run()
  db.prepare("INSERT INTO items(id,category_id,name,color,default_unit,created_at) VALUES(100,100,'Fictional algebra','#123456','pages','2026-10-17'),(101,100,'Fictional biology','#654321','pages','2026-10-17')").run()
  new SettingsRepo(db).set('foregroundTrackingEnabled', false)
  engine = make()
})
afterEach(() => { vi.restoreAllMocks(); engine.dispose(); db.close(); vi.useRealTimers() })

it.each(['flow', 'fixed', 'adaptive'] as const)('F-REL-1: %s excludes eight sleeping hours even when Finish is the first action', mode => {
  start(mode); study(600000); sleep()
  expect(() => engine.finish()).toThrow('No session')
  expect(engine.get().recovery?.focusSecondsAtLastKnown).toBe(600)
  engine.resolveRecovery('end')
  expect(engine.get().finished[0].focusSeconds).toBe(600)
})
it.each([true, false])('missed events are detected when the monotonic clock advances during sleep: %s', advances => {
  start(); study(600000); sleep(advances)
  vi.advanceTimersByTime(5000)
  expect(engine.get().recovery?.focusSecondsAtLastKnown).toBe(600)
  engine.resolveRecovery('continue'); study(120000); engine.finish()
  expect(engine.get().finished[0].focusSeconds).toBe(720)
  expect(db.prepare("SELECT kind,duration_seconds AS seconds FROM distractions").get()).toEqual({ kind: 'away', seconds: 8 * 3600 })
  const id = engine.get().finished[0].id
  expect(new SessionRepo(db).sessionParts(engine.get().finished[0].sessionId)[0].id).toBe(id)
})
it('suspend and duplicate resume/lock notifications preserve the precise observed cutoff', () => {
  start(); study(612000); engine.interruptTiming(); engine.interruptTiming(); sleep()
  engine.interruptTiming(true); engine.interruptTiming(true)
  expect(engine.get().recovery?.focusSecondsAtLastKnown).toBe(612)
  engine.resolveRecovery('continue'); study(30000); engine.finish()
  expect(engine.get().finished[0].focusSeconds).toBe(642)
  expect(db.prepare('SELECT COUNT(*) AS n FROM block_pauses').get()).toEqual({ n: 1 })
})
it('resume without suspend uses the last observation, never wake time', () => {
  start(); study(600000); sleep(); engine.interruptTiming(true)
  expect(engine.get().recovery?.focusSecondsAtLastKnown).toBe(600)
})
it('a short explicit suspend is excluded even below the fallback threshold', () => {
  start(); study(60000); engine.interruptTiming(); wall += 3000; monotonic += 3000
  engine.interruptTiming(true); engine.resolveRecovery('continue'); study(10000); engine.finish()
  expect(engine.get().finished[0].focusSeconds).toBe(70)
})
it('target callbacks after a blind gap cannot mark or announce a target', () => {
  const alert = vi.fn(); engine.on('targetReached', alert)
  start(); study(600000); sleep(); vi.advanceTimersByTime(1000000)
  expect(alert).not.toHaveBeenCalled()
  expect(db.prepare('SELECT target_alerted_at AS at FROM blocks').get()).toEqual({ at: null })
})
it('ordinary target, overtime, pauses and live subject switches retain correct totals', () => {
  const alert = vi.fn(); engine.on('targetReached', alert)
  start('fixed'); study(600000); engine.distracted(); study(120000); engine.back(true)
  study(600000); engine.switchTo(101); study(360000); engine.finish()
  expect(engine.get().finished.map(b => b.focusSeconds)).toEqual([1200, 360])
  expect(alert).toHaveBeenCalledOnce()
})
it('suspending a manual pause does not duplicate it or restart focus without Back', () => {
  start(); study(600000); engine.distracted(); study(60000); engine.interruptTiming(); sleep()
  engine.resolveRecovery('continue'); study(30000)
  expect(engine.get().running?.pauses.filter(p => p.endedAt === null)).toHaveLength(1)
  engine.back(true); study(60000); engine.finish()
  expect(engine.get().finished[0].focusSeconds).toBe(660)
})
it.each(['forward', 'backward'] as const)('a %s wall-clock jump cannot change accumulated study', direction => {
  start(); study(600000); wall += direction === 'forward' ? 3600000 : -3600000
  expect(engine.get().recovery?.focusSecondsAtLastKnown).toBe(600)
  engine.resolveRecovery('continue'); study(60000); engine.finish()
  expect(engine.get().finished[0].focusSeconds).toBe(660)
  const b = engine.get().finished[0]
  expect(Date.parse(b.focusEndedAt)).toBeGreaterThanOrEqual(Date.parse(b.focusStartedAt))
})
it('backward clock recovery survives restart and keeps positive additional focus', () => {
  start(); study(600000); wall -= 3600000; engine.get(); restart()
  expect(engine.get().recovery?.focusSecondsAtLastKnown).toBe(600)
  engine.resolveRecovery('continue'); study(60000); restart()
  expect(engine.get().recovery?.focusSecondsAtLastKnown).toBe(660)
  engine.resolveRecovery('end'); expect(engine.get().finished[0].focusSeconds).toBe(660)
})
it('disposal after an unobserved gap cannot overwrite the safe heartbeat', () => {
  start(); study(600000); sleep(); restart()
  expect(engine.get().recovery?.focusSecondsAtLastKnown).toBe(600)
  engine.resolveRecovery('continue'); study(60000); engine.finish()
  expect(engine.get().finished[0].focusSeconds).toBe(660)
})
it('hard crash recovery reads persisted observations without any graceful dispose', () => {
  start(); study(600000); const persisted = db.serialize()
  engine.dispose(); db.close(); db = new Database(persisted); sleep(); engine = make()
  expect(engine.get().recovery?.focusSecondsAtLastKnown).toBe(600)
  engine.resolveRecovery('end'); expect(engine.get().finished[0].focusSeconds).toBe(600)
})
it('interruption transaction failure retains the cutoff for a safe retry', () => {
  start(); study(600000); sleep()
  const fail = vi.spyOn(SessionRepo.prototype, 'heartbeat').mockImplementation(() => { throw Error('disk failure') })
  expect(() => engine.get()).toThrow('disk failure'); fail.mockRestore()
  expect(engine.get().recovery?.focusSecondsAtLastKnown).toBe(600)
})
it.each(['event', 'missed-event', 'clock-back'] as const)('running rest excludes interrupted time (%s), including after restart', kind => {
  rest(); study(60000)
  if (kind === 'event') engine.interruptTiming()
  if (kind === 'clock-back') wall -= 3600000; else sleep()
  const r = engine.get().rest!
  expect(r).toMatchObject({ phase: 'over', actualSeconds: 60 })
  const sessionId = new SessionRepo(db).sessionIdForBlock(r.blockId)!
  restart(); engine.resumeWorkflow(sessionId); engine.finishRest(null)
  expect(db.prepare('SELECT rest_actual_seconds AS seconds FROM blocks').get()).toEqual({ seconds: 60 })
})
it('rest completion timer cannot manufacture a completed rest after sleep', () => {
  rest(); study(60000); sleep(); vi.advanceTimersByTime(300000)
  expect(engine.get().rest).toMatchObject({ phase: 'over', actualSeconds: 60 })
})
it('ordinary planned rest completes and records the intended duration', () => {
  rest(); const planned = engine.get().rest!.plannedSeconds; study(planned * 1000 + 1000)
  expect(engine.get().rest).toMatchObject({ phase: 'over', actualSeconds: planned })
  engine.finishRest(null)
  expect(db.prepare('SELECT rest_actual_seconds AS seconds FROM blocks').get()).toEqual({ seconds: planned })
})
it('rest setup and recall drafts survive interruptions without rewriting finished history', () => {
  start(); study(600000); engine.finish(); const id = engine.get().finished[0].sessionId
  engine.saveRecallDraft(id, { text: 'Fictional explanation' })
  const before = db.prepare('SELECT * FROM blocks').all()
  sleep(); engine.interruptTiming(true)
  expect(engine.getRecallDraft(id)).toEqual({ text: 'Fictional explanation' })
  expect(db.prepare('SELECT * FROM blocks').all()).toEqual(before)
  engine.completeRecall(); engine.submitLog(engine.get().finished.map(b => ({ blockId: b.id, values: {}, notes: {} })))
  sleep(); engine.get(); expect(engine.get().rest?.phase).toBe('plan')
})
it('recovered exclusion intervals remain correct when history focus is recomputed', () => {
  start(); study(600000); engine.interruptTiming(); sleep(); engine.resolveRecovery('continue'); study(60000)
  const b = engine.get().running!
  expect(runningFocusSeconds(b, wall)).toBe(660)
  engine.finish()
  expect(new SessionRepo(db).pauses(b.id)).toHaveLength(1)
})
it('idle time and a time-zone display change do not create study or recovery', () => {
  sleep(); engine.get(); expect(engine.get().recovery).toBeNull(); start(); study(60000); engine.finish()
  expect(engine.get().finished[0].focusSeconds).toBe(60)
})
it.each([true, false])('observed review excludes suspension and needs explicit resume (monotonic advances: %s)', advances => {
  const timer = new ReviewTimer(() => wall, () => monotonic)
  timer.start(); wall += 10000; monotonic += 10000; expect(timer.sample().seconds).toBe(10)
  sleep(advances); expect(timer.sample()).toEqual({ seconds: 10, running: false })
  wall += 5000; monotonic += 5000; expect(timer.sample().seconds).toBe(10)
  timer.start(); wall += 5000; monotonic += 5000; expect(timer.sample().seconds).toBe(15)
})
it('review pause, OS interruption and clock rollback cannot inflate saved seconds', () => {
  const timer = new ReviewTimer(() => wall, () => monotonic)
  timer.start(); wall += 5000; monotonic += 5000; timer.pause(); sleep(); timer.start()
  wall += 10000; monotonic += 10000; timer.sample(); timer.interrupt(); sleep()
  expect(timer.sample()).toEqual({ seconds: 15, running: false })
  timer.start(); wall -= 3600000; expect(timer.sample()).toEqual({ seconds: 15, running: false })
})
it('small clock corrections use monotonic elapsed time and scheduling jitter stays ordinary', () => {
  const clock = new ObservedClock(() => wall, () => monotonic)
  const at = clock.at; wall += 9000; monotonic += 10000
  expect(clock.sample()).toMatchObject({ at: at + 10000, interrupted: false })
  wall += 15000; monotonic += 15000; expect(clock.sample().interrupted).toBe(false)
  wall += 15001; monotonic += 15001; expect(clock.sample().interrupted).toBe(true)
})
it('eight hours of continuously observed study are retained without an arbitrary session cap', () => {
  start(); study(8 * 3600000); engine.finish()
  expect(engine.get().finished[0].focusSeconds).toBe(8 * 3600)
})
it('restoring the wall clock after rollback realigns the timeline without crediting the correction', () => {
  start(); study(600000); wall -= 3600000; engine.get(); engine.resolveRecovery('continue'); study(60000)
  wall += 3600000
  expect(engine.get().recovery?.focusSecondsAtLastKnown).toBe(660)
  engine.resolveRecovery('continue'); study(60000); engine.finish()
  expect(engine.get().finished[0].focusSeconds).toBe(720)
  expect(engine.get().clockOffsetMs).toBe(0)
})
