import type { AppSettings } from './settings'

export function trackingConsented(s:Pick<AppSettings,'foregroundTrackingEnabled'|'foregroundTrackingConsentVersion'>):boolean {
  return s.foregroundTrackingEnabled===true && s.foregroundTrackingConsentVersion===1
}

export const TRACKING_DISCLOSURE='Off by default. If enabled, samples app names every two seconds during active Focus and running Rest only. Does not capture keystrokes or screenshots, or read page content or the browser address bar. Records stay local and unencrypted, including in backups; synced folders may share them. Turning it off stops collection, not deletion of history.'
export const TITLE_DISCLOSURE='Also record window titles (optional). Titles may reveal document names, messages, addresses or private browsing. Off means titles are not read; browser sites and title-based rules are unavailable for new records.'
export const TRACKING_RECONFIRM='Your earlier enabled preference is preserved. Confirm tracking again to accept the current privacy controls; no collection runs until then.'

export const TRACKING_COVERAGE_NOTE='Window activity is sampled, not a complete attention record. With titles off, only app changes are distinguishable; missing tracking does not mean no distraction.'

export const TRACKING_SAVE_FAILURE='Tracking is stopped for this run, but the privacy preference could not be saved. Your previous saved choice may return after restarting. Retry saving before you close the app.'

/** Stop collection before storage work; a failed write must never veto opt-out. */
export function persistTrackingPreference(key:string,save:()=>void,read:()=>AppSettings,apply:(enabled:boolean,titles:boolean)=>void):void {
  const privacy=key.startsWith('foregroundTracking')
  if(privacy)apply(false,false)
  try{
    save()
    if(privacy){const s=read();apply(trackingConsented(s),s.foregroundTrackingTitlesEnabled)}
  }catch(error){
    if(privacy){apply(false,false);throw Error(TRACKING_SAVE_FAILURE)}
    throw error
  }
}
