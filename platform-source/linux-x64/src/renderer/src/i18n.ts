import { useSyncExternalStore } from 'react'
import { normalizeLanguage, translate, type AppLanguage } from '@core/localization'
import { fieldDisplay, groupDisplayName, scaleDisplay, reasonDisplayName } from '@core/localizedFields'
import type { LogField, LogGroup, ScaleConfig } from '@core/logfields'
import type { ReasonOption } from '@core/distractions'
import { localizedDuration } from '@core/localizedDuration'
import { localizedThemeName } from '@core/localizedThemes'
import { localizedDate, localizedDateTime, localizedTime, type DateValue } from '@core/localizedDate'
import { localizedCount, localizedEvidenceCount, type CountUnit } from '@core/localizedCount'

let language: AppLanguage = 'en'
const listeners = new Set<() => void>()
const subscribe = (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export function applyLanguage(value: unknown): void {
  const next = normalizeLanguage(value)
  document.documentElement.lang = next
  document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
  if (next === language) return
  language = next
  for (const listener of listeners) listener()
}
/** A language change rerenders the existing tree; it never remounts or clears a draft. */
export function useLanguage(): AppLanguage { return useSyncExternalStore(subscribe, () => language, () => 'en') }
export function t(english: string, values?: Record<string, string | number | null | undefined>): string { return translate(language, english, values) }
export const currentLanguage = (): AppLanguage => language
export const formatDate = (value:DateValue, options?:Intl.DateTimeFormatOptions):string => localizedDate(value,language,options)
export const formatTime = (value:DateValue, options?:Intl.DateTimeFormatOptions):string => localizedTime(value,language,options)
export const formatDateTime = (value:DateValue):string => localizedDateTime(value,language)
export const count = (value:number, unit:CountUnit):string => localizedCount(value,unit,language)
export const countEvidence = (value:number, unit:string):string => localizedEvidenceCount(value,unit,language)
export const formatDuration = (seconds:number):string => localizedDuration(seconds,language)
export const themeName = (name:string):string => localizedThemeName(language,name)
export const displayField = (field: LogField): LogField => fieldDisplay(language, field)
export const displayGroup = (group: LogGroup): string => groupDisplayName(language, group)
export const displayScale = (scale: ScaleConfig): ScaleConfig => scaleDisplay(language, scale)
export const displayReason = (reason: ReasonOption): string => reasonDisplayName(language, reason)

// The existing settings event synchronizes every app and floating window.
let received = false
if (typeof window !== 'undefined' && window.api) {
  window.api.on('settings:changed', settings => { received = true; applyLanguage(settings.language) })
  void window.api.invoke('settings:getAll').then(settings => { if (!received) applyLanguage(settings.language) }).catch(() => {})
}
