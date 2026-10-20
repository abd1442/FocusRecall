import { create } from 'zustand'
import { StudyDayClock } from '@core/dayClock'
import { useSettings } from './session'

export const useStudyDay = create<{ day: string }>(() => ({ day: '' }))
const clock = new StudyDayClock(() => useSettings.getState().settings.dayStart, (day) => {
  if (useStudyDay.getState().day !== day) useStudyDay.setState({ day })
})
clock.recheck()
useSettings.subscribe((s, old) => { if (s.settings.dayStart !== old.settings.dayStart) clock.recheck() })
window.addEventListener('focus', clock.recheck)
document.addEventListener('visibilitychange', clock.recheck)
window.api.on('clock:changed', clock.recheck)
export function currentStudyDay(): string { clock.recheck(); return clock.current() }
