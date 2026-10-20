// Typing times and durations: colons appear by themselves, "130" becomes
// "1:30" on leaving the field, and the arrow keys step the value.

/**
 * hm: hours and minutes (a length like 25 or 1:30, or a clock time 09:05),
 * counted in minutes. hms: hours, minutes and seconds (a video timestamp),
 * counted in seconds.
 */
export type TimeShape = 'hm' | 'hms'

const maxDigits = (shape: TimeShape): number => (shape === 'hm' ? 4 : 6)

/**
 * The text while typing: only digits, with a colon after every two digits
 * once a third one comes ("1230" shows "12:30"). Deleting a colon never gets
 * stuck: the colon only exists while digits follow it.
 */
export function typeTime(text: string, shape: TimeShape): string {
  const d = text.replace(/\D/g, '').slice(0, maxDigits(shape))
  if (d.length <= 2) return d
  return (d.match(/.{1,2}/g) ?? []).join(':')
}

/**
 * The value of what was typed, in minutes (hm) or seconds (hms). Only the
 * digits count and they are read from the right, so "130" (shown "13:0"
 * while typing) is 1:30, "1:05" is 1:05 and "5" is 5 minutes (or seconds for
 * hms). Null for nothing typed.
 */
export function parseTime(text: string, shape: TimeShape): number | null {
  const d = text.replace(/\D/g, '').slice(-maxDigits(shape))
  if (!d) return null
  const groups: number[] = []
  for (let end = d.length; end > 0; end -= 2) groups.unshift(Number(d.slice(Math.max(0, end - 2), end)))
  const units = shape === 'hm' ? [60, 1] : [3600, 60, 1]
  const used = units.slice(units.length - groups.length)
  return groups.reduce((sum, g, i) => sum + g * used[i], 0)
}

/** The text for a value: hm as "25" or "1:30" (or "09:05" with `pad`), hms as "4:05" or "1:02:05". */
export function formatTime(value: number, shape: TimeShape, pad = false): string {
  const v = Math.max(0, Math.round(value))
  if (shape === 'hm') {
    const h = Math.floor(v / 60)
    const m = v % 60
    if (pad) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    return h ? `${h}:${String(m).padStart(2, '0')}` : String(m)
  }
  const h = Math.floor(v / 3600)
  const m = Math.floor((v % 3600) / 60)
  const s = v % 60
  if (pad) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/** Seconds since local midnight of a moment (for typing a clock time). */
export function secondsOfDay(ms: number): number {
  const d = new Date(ms)
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
}

/**
 * A typed clock time (seconds since midnight) as a moment near `near`: on the
 * same date, or the day before or after when that is closer (a session that
 * runs past midnight).
 */
export function atClockTime(near: number, seconds: number): number {
  const d = new Date(near)
  d.setHours(0, 0, 0, 0)
  const same = d.getTime() + seconds * 1000
  const options = [same - 86_400_000, same, same + 86_400_000]
  return options.reduce((best, t) => (Math.abs(t - near) < Math.abs(best - near) ? t : best))
}

/** Up and Down arrows: one minute (Shift: five), kept between `min` and `max`. Units follow the shape. */
export function stepTime(value: number | null, direction: 1 | -1, shift: boolean, shape: TimeShape, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const minute = shape === 'hm' ? 1 : 60
  const step = minute * (shift ? 5 : 1) * direction
  return Math.min(max, Math.max(min, (value ?? 0) + step))
}
