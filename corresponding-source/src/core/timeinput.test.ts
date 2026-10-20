import { describe, expect, it } from 'vitest'
import { formatTime, parseTime, stepTime, typeTime } from './timeinput'

describe('typeTime', () => {
  it('adds colons by itself as digits come', () => {
    expect(typeTime('12', 'hm')).toBe('12')
    expect(typeTime('123', 'hm')).toBe('12:3')
    expect(typeTime('1230', 'hm')).toBe('12:30')
    expect(typeTime('12:305', 'hm')).toBe('12:30')
    expect(typeTime('123456', 'hms')).toBe('12:34:56')
  })
  it('lets Backspace remove the colon cleanly', () => {
    // "12:3" with the 3 deleted is "12:", which shows as "12"; deleting again gives "1".
    expect(typeTime('12:', 'hm')).toBe('12')
    expect(typeTime('1', 'hm')).toBe('1')
  })
})

describe('parseTime', () => {
  it('reads digits from the right', () => {
    expect(parseTime('130', 'hm')).toBe(90)
    expect(parseTime('25', 'hm')).toBe(25)
    expect(parseTime('1230', 'hm')).toBe(12 * 60 + 30)
    expect(parseTime('13:0', 'hm')).toBe(90)
    expect(parseTime('405', 'hms')).toBe(245)
    expect(parseTime('10203', 'hms')).toBe(3600 + 2 * 60 + 3)
  })
  it('reads shown values back, and gives null for nothing', () => {
    expect(parseTime('1:05', 'hm')).toBe(65)
    expect(parseTime('1:02:03', 'hms')).toBe(3723)
    expect(parseTime('', 'hm')).toBeNull()
    expect(parseTime('ab', 'hm')).toBeNull()
  })
})

describe('formatTime and stepTime', () => {
  it('writes lengths, clock times and timestamps', () => {
    expect(formatTime(25, 'hm')).toBe('25')
    expect(formatTime(90, 'hm')).toBe('1:30')
    expect(formatTime(545, 'hm', true)).toBe('09:05')
    expect(formatTime(245, 'hms')).toBe('4:05')
    expect(formatTime(3723, 'hms')).toBe('1:02:03')
  })
  it('steps by a minute, five with Shift, within limits', () => {
    expect(stepTime(25, 1, false, 'hm')).toBe(26)
    expect(stepTime(25, -1, true, 'hm')).toBe(20)
    expect(stepTime(2, -1, true, 'hm', 1)).toBe(1)
    expect(stepTime(null, 1, false, 'hms')).toBe(60)
  })
})

describe('clock times', () => {
  it('pads hours, minutes and seconds when asked', async () => {
    const { formatTime } = await import('./timeinput')
    expect(formatTime(9 * 3600 + 5 * 60 + 3, 'hms', true)).toBe('09:05:03')
  })
  it('turns a typed clock time into the nearest moment', async () => {
    const { atClockTime, secondsOfDay } = await import('./timeinput')
    const near = new Date(2026, 9, 12, 23, 50, 0).getTime()
    expect(atClockTime(near, secondsOfDay(near) + 30)).toBe(near + 30_000)
    // Ten past midnight, typed in a session that started before midnight, is the next day.
    expect(atClockTime(near, 600)).toBe(new Date(2026, 9, 13, 0, 10, 0).getTime())
  })
})
