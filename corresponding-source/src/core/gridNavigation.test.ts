import { describe, expect, it } from 'vitest'
import { gridDestination } from './gridNavigation'
import { yearGrid } from './heatmap'

describe('spatial roving grid', () => {
  const rows = [[null, 'a', 'b'], ['c', 'd', 'e'], ['f', 'g', null]]
  it('follows visual rows and columns without activating or wrapping', () => {
    expect(gridDestination(rows, 'd', 'ArrowRight')).toBe('e')
    expect(gridDestination(rows, 'd', 'ArrowLeft', true)).toBe('e')
    expect(gridDestination(rows, 'd', 'ArrowUp', true)).toBe('a')
    expect(gridDestination(rows, 'e', 'ArrowRight')).toBe('e')
    expect(gridDestination(rows, 'a', 'Tab')).toBeNull()
    expect(gridDestination(rows, 'unknown', 'Home')).toBeNull()
  })
  it('offers row and whole-grid boundaries, skipping padding', () => {
    expect(gridDestination(rows, 'b', 'Home')).toBe('a')
    expect(gridDestination(rows, 'f', 'End')).toBe('g')
    expect(gridDestination(rows, 'd', 'Home', false, true)).toBe('a')
    expect(gridDestination(rows, 'd', 'End', false, true)).toBe('g')
  })
  it('never moves into future days when the visible year is only partly elapsed', () => {
    const weeks = yearGrid(2026, 1).weeks
    const elapsed = Array.from({ length: 7 }, (_, i) => weeks.map(w => w[i] && w[i]! <= '2026-02-05' ? w[i] : null))
    expect(gridDestination(elapsed, '2026-01-29', 'ArrowRight')).toBe('2026-02-05')
    expect(gridDestination(elapsed, '2026-02-05', 'ArrowRight')).toBe('2026-02-05')
    expect(gridDestination(elapsed, '2026-02-04', 'ArrowDown')).toBe('2026-02-05')
    expect(gridDestination(elapsed, '2026-02-05', 'ArrowDown')).toBe('2026-02-05')
    expect(gridDestination(elapsed, '2026-02-05', 'End', false, true)! <= '2026-02-05').toBe(true)
  })
  it.each([2024, 2025, 2026, 2028])('keeps every elapsed date reachable in %i for every week start and direction', year => {
    for (const start of [0, 1, 2, 3, 4, 5, 6] as const) {
      const weeks = yearGrid(year, start).weeks
      const rows = Array.from({ length: 7 }, (_, i) => weeks.map(w => w[i]))
      const keys = rows.flat().filter((v): v is string => !!v)
      expect(new Set(keys).size).toBe(year % 4 === 0 ? 366 : 365)
      for (const rtl of [false, true]) for (const day of keys) {
        for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
          expect(keys).toContain(gridDestination(rows, day, key, rtl))
        }
      }
    }
  })
})
