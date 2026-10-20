import { describe, expect, it } from 'vitest'
import { evenBoundaries, normalizeBoundaries, partIndexAt, partRanges } from './split'

const MIN = 60_000

describe('split', () => {
  it('cuts a range into equal parts', () => {
    expect(evenBoundaries(0, 30 * MIN, 3)).toEqual([10 * MIN, 20 * MIN])
    expect(evenBoundaries(0, 30 * MIN, 1)).toEqual([])
  })
  it('keeps dividers ordered, inside the range and a minute apart', () => {
    expect(normalizeBoundaries(0, 30 * MIN, [25 * MIN, 5 * MIN])).toEqual([5 * MIN, 25 * MIN])
    expect(normalizeBoundaries(0, 30 * MIN, [-5 * MIN])).toEqual([MIN])
    expect(normalizeBoundaries(0, 30 * MIN, [10 * MIN, 10 * MIN + 1000])).toEqual([10 * MIN, 11 * MIN])
    expect(normalizeBoundaries(0, 30 * MIN, [29.9 * MIN, 30 * MIN])).toEqual([28 * MIN, 29 * MIN])
  })
  it('finds the part of a moment and the ranges', () => {
    const b = [10 * MIN, 20 * MIN]
    expect(partIndexAt(5 * MIN, b)).toBe(0)
    expect(partIndexAt(10 * MIN, b)).toBe(1)
    expect(partIndexAt(25 * MIN, b)).toBe(2)
    expect(partRanges(0, 30 * MIN, b)).toEqual([
      { start: 0, end: 10 * MIN },
      { start: 10 * MIN, end: 20 * MIN },
      { start: 20 * MIN, end: 30 * MIN }
    ])
  })
})
