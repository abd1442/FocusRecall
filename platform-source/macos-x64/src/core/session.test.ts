import { describe, expect, it } from 'vitest'
import { runningFocusSeconds, sittingExpired } from './session'

const H = 3_600_000
const T0 = Date.UTC(2026, 9, 11, 8)

describe('sittingExpired', () => {
  it('ends after the configured quiet time', () => {
    expect(sittingExpired(T0, T0 + 2 * H - 1, 2)).toBe(false)
    expect(sittingExpired(T0, T0 + 2 * H, 2)).toBe(true)
  })
  it('respects other durations', () => {
    expect(sittingExpired(T0, T0 + 1.5 * H, 1)).toBe(true)
    expect(sittingExpired(T0, T0 + 3 * H, 4)).toBe(false)
  })
  it('never expires when disabled (0 or invalid)', () => {
    expect(sittingExpired(T0, T0 + 100 * H, 0)).toBe(false)
    expect(sittingExpired(T0, T0 + 100 * H, Number.NaN)).toBe(false)
  })
})

describe('runningFocusSeconds', () => {
  it('reads ISO timestamps and subtracts pauses', () => {
    const block = {
      focusStartedAt: new Date(T0).toISOString(),
      pauses: [{ startedAt: new Date(T0 + 60_000).toISOString(), endedAt: new Date(T0 + 120_000).toISOString() }]
    }
    expect(runningFocusSeconds(block, T0 + 600_000)).toBe(540)
  })
})
