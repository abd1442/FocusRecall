import { describe, expect, it } from 'vitest'
import { generateDemo } from './demo'
import { SEED_GROUPS, seedOptions } from './logfields'

const NOW = new Date(2026, 9, 12, 15, 0).getTime()

describe('generateDemo', () => {
  const data = generateDemo(NOW)

  it('is deterministic for a seed', () => {
    expect(generateDemo(NOW)).toEqual(data)
    expect(generateDemo(NOW, 7)).not.toEqual(data)
  })

  it('makes about four months of sittings, all before today', () => {
    const blocks = data.sittings.flatMap((s) => s.blocks)
    expect(data.sittings.length).toBeGreaterThan(60)
    expect(blocks.length).toBeGreaterThan(150)
    const today = new Date(NOW)
    today.setHours(0, 0, 0, 0)
    expect(blocks.every((b) => b.end < today.getTime() + 24 * 3600_000)).toBe(true)
    expect(Math.min(...blocks.map((b) => b.start))).toBeGreaterThan(NOW - 19 * 7 * 24 * 3600_000)
  })

  it('never overlaps blocks inside a sitting and keeps focus within the block', () => {
    for (const s of data.sittings) {
      for (let i = 1; i < s.blocks.length; i++) expect(s.blocks[i].start).toBeGreaterThanOrEqual(s.blocks[i - 1].end)
      for (const b of s.blocks) {
        expect(b.focusSeconds * 1000).toBeLessThanOrEqual(b.end - b.start)
        for (const p of b.pauses) expect(p.start >= b.start && p.end <= b.end).toBe(true)
      }
    }
  })

  it('uses only subjects, categories and option ids that exist', () => {
    const itemKeys = new Set(data.items.map((i) => i.key))
    const catKeys = new Set(data.categories.map((c) => c.key))
    expect(data.items.every((i) => catKeys.has(i.categoryKey))).toBe(true)
    const options = new Map(SEED_GROUPS.flatMap((g) => g.fields).map((f) => [f.key, new Set(seedOptions(f.options).map((o) => o.id))]))
    for (const b of data.sittings.flatMap((s) => s.blocks)) {
      expect(itemKeys.has(b.itemKey)).toBe(true)
      for (const key of ['activity', 'place', 'phone-location', 'sound', 'device', 'drinks']) {
        if (b.answers[key] !== undefined) expect(options.get(key)!.has(b.answers[key] as string)).toBe(true)
      }
    }
  })

  it('has a session record for every session number, check-ins on most days, and learning-stage details', () => {
    const numbers = new Set(data.sittings.flatMap((s) => s.blocks.map((b) => b.session)))
    expect(new Set(data.sessions.map((s) => s.number))).toEqual(numbers)
    expect(data.days.length).toBeGreaterThan(40)
    expect(data.items.some((i) => i.buildsOn.length)).toBe(true)
    expect(data.sessions.some((s) => s.goalResult === 'done')).toBe(true)
    expect(data.sittings.flatMap((s) => s.blocks).some((b) => b.untouched.length)).toBe(true)
  })
})

describe('demo progress', () => {
  it('never logs more than a subject total', () => {
    const data = generateDemo(new Date(2026, 9, 12, 15, 0).getTime())
    for (const it of data.items.filter((i) => i.total)) {
      const sum = data.sittings
        .flatMap((s) => s.blocks)
        .filter((b) => b.itemKey === it.key)
        .reduce((n, b) => n + ((b.answers.progress as { amount: number } | undefined)?.amount ?? 0), 0)
      expect(sum).toBeLessThanOrEqual(it.total!)
    }
  })
})
