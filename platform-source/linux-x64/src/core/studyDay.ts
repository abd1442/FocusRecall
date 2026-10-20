// Study day and week boundaries. A study day starts at a configurable local
// time (default 04:00), so a sitting at 01:30 counts on the previous day.
// All functions take local-time Date objects; storage stays UTC.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday ... 6 = Saturday

export interface DayBoundary {
  hour: number
  minute: number
}

/** Parse "HH:MM" into a boundary. Falls back to 04:00 for invalid input. */
export function parseDayStart(value: string): DayBoundary {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return { hour: 4, minute: 0 }
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour > 23 || minute > 59) return { hour: 4, minute: 0 }
  return { hour, minute }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The study day ("YYYY-MM-DD") that a local moment belongs to. */
export function studyDayKey(moment: Date, boundary: DayBoundary): string {
  const minutesIntoDay = moment.getHours() * 60 + moment.getMinutes()
  const boundaryMinutes = boundary.hour * 60 + boundary.minute
  const d = new Date(moment.getFullYear(), moment.getMonth(), moment.getDate())
  if (minutesIntoDay < boundaryMinutes) d.setDate(d.getDate() - 1)
  return dateKeyOf(d)
}

/** Parse a "YYYY-MM-DD" key into a local midnight Date. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + days)
  return dateKeyOf(d)
}

/** The first study day of the week containing the given study day. */
export function weekStartKey(dayKey: string, weekStartsOn: Weekday): string {
  const weekday = parseDateKey(dayKey).getDay()
  const back = (weekday - weekStartsOn + 7) % 7
  return addDays(dayKey, -back)
}

/** Local start and end moments of a study day, as Dates. End is exclusive. */
export function studyDayRange(dayKey: string, boundary: DayBoundary): { start: Date; end: Date } {
  const start = parseDateKey(dayKey)
  start.setHours(boundary.hour, boundary.minute, 0, 0)
  const end = parseDateKey(addDays(dayKey, 1))
  end.setHours(boundary.hour, boundary.minute, 0, 0)
  return { start, end }
}

/** Equal elapsed day-of-month windows, clamped for shorter previous months. */
export function monthComparison(month:string,today:string):{from:string;through:string;previousFrom:string;previousThrough:string} {
  const [y,m]=month.split('-').map(Number)
  const last=dateKeyOf(new Date(y,m,0)),previousLast=dateKeyOf(new Date(y,m-1,0)),previousFrom=previousLast.slice(0,7)+'-01'
  const through=month===today.slice(0,7)?today:last
  const elapsed=Number(through.slice(8)),previousThrough=addDays(previousFrom,Math.min(elapsed,Number(previousLast.slice(8)))-1)
  return {from:month+'-01',through,previousFrom,previousThrough:month===today.slice(0,7)?previousThrough:previousLast}
}
