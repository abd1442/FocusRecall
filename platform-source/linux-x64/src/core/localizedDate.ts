import type { AppLanguage } from './localization'

const DEFAULT_DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
const cache = new Map<string, Intl.DateTimeFormat>()
export type DateValue = string | number | Date | null | undefined

/** Display only. Calendar keys are Gregorian dates, not UTC instants; timestamps
 * remain in the computer's local timezone. Stored keys and export IDs stay ISO. */
export function localizedDate(value: DateValue, language: AppLanguage, options: Intl.DateTimeFormatOptions = DEFAULT_DATE): string {
  if (value === null || value === undefined || value === '') return '—'
  let date: Date
  let calendarDay = false
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    date = new Date(0)
    date.setUTCFullYear(year, month - 1, day)
    date.setUTCHours(12, 0, 0, 0)
    if (date.toISOString().slice(0, 10) !== value) return '—'
    calendarDay = true
  } else date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  const opts = { ...options, calendar: 'gregory', ...(calendarDay ? { timeZone: 'UTC' } : {}) }
  const key = language + JSON.stringify(opts)
  let formatter = cache.get(key)
  if (!formatter) { formatter = new Intl.DateTimeFormat(language, opts); cache.set(key, formatter) }
  return formatter.format(date)
}

export function localizedTime(value: DateValue, language: AppLanguage, options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }): string {
  return localizedDate(value, language, options)
}

export function localizedDateTime(value: DateValue, language: AppLanguage): string {
  return localizedDate(value, language, { ...DEFAULT_DATE, hour: '2-digit', minute: '2-digit' })
}
