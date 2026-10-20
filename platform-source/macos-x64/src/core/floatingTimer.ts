import { clockDisplay, type ClockDisplay } from './modes'
import { sessionFocusSeconds, type RunningBlock } from './session'
import type { Appearance } from './appearance'

/** A view of the same observed session time; no independent clock or saved elapsed time. */
export function floatingFocusClock(block: RunningBlock, now: number, display: Appearance['panelTimerDisplay']): ClockDisplay {
  return clockDisplay(display === 'circular' ? 'fixed' : block.timerMode, block.targetSeconds, sessionFocusSeconds(block, now))
}

/** Base CSS dimensions, before the existing independent panel scale. */
export function floatingPanelSize(expanded: boolean, display: Appearance['panelTimerDisplay'], quick=false): { width: number; height: number } {
  if(quick){
    if(display==='circular')return expanded?{width:282,height:376}:{width:222,height:268}
    return expanded?{width:320,height:188}:{width:264,height:110}
  }
  if (display === 'circular') return expanded ? { width: 300, height: 364 } : { width: 232, height: 246 }
  return expanded ? { width: 360, height: 188 } : { width: 296, height: 98 }
}
