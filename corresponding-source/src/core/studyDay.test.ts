import { describe, expect, it } from 'vitest'
import { monthComparison, addDays, parseDayStart, studyDayKey, studyDayRange, weekStartKey } from './studyDay'

const at = (y: number, mo: number, d: number, h: number, mi = 0): Date => new Date(y, mo - 1, d, h, mi)
const four = { hour: 4, minute: 0 }

describe('parseDayStart', () => {
  it('parses HH:MM', () => {
    expect(parseDayStart('04:00')).toEqual({ hour: 4, minute: 0 })
    expect(parseDayStart('5:30')).toEqual({ hour: 5, minute: 30 })
  })
  it('falls back to 04:00 on bad input', () => {
    expect(parseDayStart('25:00')).toEqual(four)
    expect(parseDayStart('soon')).toEqual(four)
  })
})

describe('studyDayKey', () => {
  it('counts times after the boundary on the same calendar day', () => {
    expect(studyDayKey(at(2026, 10, 11, 4, 0), four)).toBe('2026-10-11')
    expect(studyDayKey(at(2026, 10, 11, 23, 59), four)).toBe('2026-10-11')
  })
  it('counts times before the boundary on the previous day', () => {
    expect(studyDayKey(at(2026, 10, 12, 1, 30), four)).toBe('2026-10-11')
    expect(studyDayKey(at(2026, 10, 12, 3, 59), four)).toBe('2026-10-11')
  })
  it('crosses month and year boundaries', () => {
    expect(studyDayKey(at(2026, 11, 1, 2), four)).toBe('2026-10-31')
    expect(studyDayKey(at(2027, 1, 1, 0, 15), four)).toBe('2026-12-31')
  })
  it('respects a midnight boundary', () => {
    expect(studyDayKey(at(2026, 10, 12, 0, 0), { hour: 0, minute: 0 })).toBe('2026-10-12')
  })
})

describe('weekStartKey', () => {
  // 2026-10-10 is a Saturday, 2026-10-11 a Sunday.
  it('starts weeks on Saturday', () => {
    expect(weekStartKey('2026-10-10', 6)).toBe('2026-10-10')
    expect(weekStartKey('2026-10-11', 6)).toBe('2026-10-10')
    expect(weekStartKey('2026-10-16', 6)).toBe('2026-10-10')
    expect(weekStartKey('2026-10-17', 6)).toBe('2026-10-17')
  })
  it('starts weeks on Monday', () => {
    expect(weekStartKey('2026-10-11', 1)).toBe('2026-10-05')
    expect(weekStartKey('2026-10-12', 1)).toBe('2026-10-12')
  })
  it('a late-night sitting on Friday 01:00 belongs to Thursday', () => {
    const day = studyDayKey(at(2026, 10, 17, 1), four) // Saturday 01:00 -> Friday
    expect(day).toBe('2026-10-16')
    expect(weekStartKey(day, 6)).toBe('2026-10-10')
  })
})

describe('studyDayRange', () => {
  it('runs from boundary to boundary', () => {
    const { start, end } = studyDayRange('2026-10-11', four)
    expect(start).toEqual(at(2026, 10, 11, 4))
    expect(end).toEqual(at(2026, 10, 12, 4))
  })
  it('addDays handles month ends', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

it('matches elapsed month dates, clamps February, and leaves completed months complete',()=>{
 expect(monthComparison('2026-10','2026-10-15')).toEqual({from:'2026-10-01',through:'2026-10-15',previousFrom:'2026-09-01',previousThrough:'2026-09-15'})
 expect(monthComparison('2024-03','2024-03-31').previousThrough).toBe('2024-02-29')
 expect(monthComparison('2026-03','2026-03-31').previousThrough).toBe('2026-02-28')
 expect(monthComparison('2026-09','2026-10-15')).toMatchObject({through:'2026-09-30',previousThrough:'2026-08-31'})
})
