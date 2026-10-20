import { describe, expect, it } from 'vitest'
import { LANGUAGES } from './localization'
import { localizedDate, localizedDateTime, localizedTime } from './localizedDate'
import { COUNT_UNITS, localizedCount } from './localizedCount'

const plain = (text: string): string => text.replace(/[\u2068\u2069\u200e\u200f]/g, '')

describe('localized display without changing stored values', () => {
  for (const { id } of LANGUAGES) {
    it(`formats unambiguous Gregorian dates and all count categories in ${id}`, () => {
      const key = '2026-10-19'
      expect(localizedDate(key, id)).toBe(new Intl.DateTimeFormat(id, { calendar:'gregory', timeZone:'UTC', year:'numeric', month:'short', day:'numeric' }).format(new Date('2026-10-19T12:00:00Z')))
      expect(key).toBe('2026-10-19')
      for (const unit of COUNT_UNITS) for (const n of [0, 1, 2, 3, 10, 11, 21, 100, 101, 102, 103, 1.5, 1000000]) {
        const phrase = localizedCount(n, unit, id)
        expect(phrase, `${id}/${unit}/${n}`).not.toMatch(/undefined|NaN|\{n\}|—/)
        expect(phrase.trim().length).toBeGreaterThan(1)
      }
    })
  }
  it('uses correct English singulars and locale-specific plurals rather than n===1 everywhere', () => {
    expect(localizedCount(0,'session','en')).toBe('0 sessions')
    expect(localizedCount(1,'session','en')).toBe('1 session')
    expect(localizedCount(2,'session','en')).toBe('2 sessions')
    expect(localizedCount(1,'session','es')).toBe('1 sesión')
    expect(localizedCount(2,'session','es')).toBe('2 sesiones')
    expect(localizedCount(0,'session','fr')).toBe('0 séance')
    expect(localizedCount(1,'session','pt-BR')).toBe('1 sessão')
    expect(localizedCount(2,'session','de')).toBe('2 Sitzungen')
    expect(localizedCount(1,'session','zh-Hans')).toBe('1次学习')
    expect(localizedCount(2,'session','zh-Hans')).toBe('2次学习')
    expect(localizedCount(1.5,'day','en')).toBe('1.5 days')
  })
  it('handles Arabic zero, singular, dual, few, many and other explicitly', () => {
    const n = (v:number):string => new Intl.NumberFormat('ar').format(v)
    expect(plain(localizedCount(0,'session','ar'))).toBe(`${n(0)} جلسات`)
    expect(localizedCount(1,'session','ar')).toBe('جلسة واحدة')
    expect(localizedCount(2,'session','ar')).toBe('جلستان')
    expect(plain(localizedCount(3,'session','ar'))).toBe(`${n(3)} جلسات`)
    expect(plain(localizedCount(11,'session','ar'))).toBe(`${n(11)} جلسةً`)
    expect(plain(localizedCount(100,'session','ar'))).toBe(`${n(100)} جلسة`)
    expect(plain(localizedCount(101,'session','ar'))).toBe(`${n(101)} جلسة`)
    expect(plain(localizedCount(103,'session','ar'))).toBe(`${n(103)} جلسات`)
  })
  it('never shifts date-only study keys when another timezone is requested', () => {
    for (const day of ['2026-01-01','2026-03-08','2026-11-01','2024-02-29','0099-01-01']) {
      const utc = localizedDate(day,'en')
      for (const timeZone of ['America/Los_Angeles','Pacific/Kiritimati','Africa/Cairo'])
        expect(localizedDate(day,'en',{year:'numeric',month:'short',day:'numeric',timeZone})).toBe(utc)
    }
  })
  it('converts timestamps in the requested display timezone, retaining the instant', () => {
    const instant = new Date('2026-01-01T00:30:00Z'), before = instant.toISOString()
    expect(localizedDate(instant,'en',{year:'numeric',month:'short',day:'numeric',timeZone:'America/Los_Angeles'})).toBe('Dec 31, 2025')
    expect(localizedDate(instant,'en',{year:'numeric',month:'short',day:'numeric',timeZone:'Asia/Tokyo'})).toBe('Jan 1, 2026')
    expect(localizedTime(instant,'en',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'})).toBe('00:30')
    expect(instant.toISOString()).toBe(before)
    expect(localizedDateTime(instant,'en')).not.toContain('Invalid')
  })
  it('shows a missing-value marker for unavailable or invalid values, never an invented date', () => {
    for (const value of [undefined,null,'','not a date','2026-02-30','2026-13-01',NaN,new Date(NaN)]) expect(localizedDate(value,'en')).toBe('—')
    for (const value of [NaN,Infinity,-1]) expect(localizedCount(value,'session','en')).toBe('—')
  })
})
