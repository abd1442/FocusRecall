import { afterEach, expect, it, vi } from 'vitest'
import { StudyDayClock, checkinSaveDay } from './dayClock'
afterEach(() => vi.useRealTimers())
it('rolls over an idle window at a custom boundary and checks clock changes', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 14, 3, 59, 59))
  let day = ''; let boundary = '04:00'
  const clock = new StudyDayClock(() => boundary, (d) => { day = d })
  clock.recheck(); expect(day).toBe('2026-10-13')
  vi.advanceTimersByTime(1002); expect(day).toBe('2026-10-14')
  vi.setSystemTime(new Date(2026, 9, 16, 2)); clock.recheck(); expect(day).toBe('2026-10-15')
  boundary = '00:00'; clock.recheck(); expect(day).toBe('2026-10-16')
  vi.setSystemTime(new Date(2026, 9, 12, 2)); clock.recheck(); expect(day).toBe('2026-10-12')
  clock.stop(); expect(vi.getTimerCount()).toBe(0)
})
it('requires a dated decision again after another rollover; never changes the original day', () => {
  expect(checkinSaveDay('2026-10-13','2026-10-14',null)).toBeNull()
  expect(checkinSaveDay('2026-10-13','2026-10-14',{current:'2026-10-14',day:'2026-10-13'})).toBe('2026-10-13')
  expect(checkinSaveDay('2026-10-13','2026-10-14',{current:'2026-10-14',day:'2026-10-14'})).toBe('2026-10-14')
  expect(checkinSaveDay('2026-10-13','2026-10-15',{current:'2026-10-14',day:'2026-10-14'})).toBeNull()
})
