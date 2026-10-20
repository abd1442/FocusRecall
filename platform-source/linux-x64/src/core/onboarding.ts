import type { SessionState } from './session'
export type GuideStep='welcome'|'subject'|'mode'|'start'|'preparation'|'focus'|'keep'|'recall'|'log'|'rest-plan'|'rest-running'|'rest-over'|'next'|'history'|'stats'
/** Observe the real workflow. Never issue session commands or fabricate answers. */
export function followStudy(state:SessionState,current:GuideStep,preparing:boolean,shortPrompt:boolean):GuideStep {
  if(current==='welcome'||current==='history'||current==='stats'||state.recovery)return current
  if(state.running)return 'focus'
  if(state.stage==='recall')return state.step==='log'?'log':shortPrompt?'keep':'recall'
  if(state.rest)return state.rest.phase==='plan'?'rest-plan':state.rest.phase==='running'?'rest-running':'rest-over'
  if(preparing)return 'preparation'
  if(['focus','keep','recall','log','rest-plan','rest-running','rest-over'].includes(current))return 'next'
  if(current==='preparation')return 'start'
  return current
}
