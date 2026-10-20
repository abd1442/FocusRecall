import { app, powerMonitor } from 'electron'
import { distractedSince, type SessionState } from '@core/session'
import { classify, nextRun, NO_TITLE, type WindowRun } from '@core/tracking'
import type { Id } from '@core/types'
import type { ForegroundWatcher, WatcherSample } from './foreground'
import type { DistractionRepo } from './repos/distractions'

/** No keyboard or mouse input for this long counts as a possible "away". */
const IDLE_SECONDS = 5 * 60
const IDLE_CHECK_MS = 5_000
/** A distraction app in front this long during a rest gets one gentle nudge. */
const REST_NUDGE_MS = 20_000

interface Context {
  blockId: Id
  stage: 'focus' | 'rest'
}

/**
 * Automatic tracking. While a session or its rest is on, the watcher reports
 * the front window; this turns the reports into runs in window_activity,
 * records idle gaps during focus, derives detected distractions when a part
 * ends, and nudges once per app during a rest. Nothing is shown during focus.
 */
export class Tracker {
  private run: (WindowRun & Context) | null = null
  private idleStart: number | null = null
  private observingSince:number|null=null
  private observingKey:string|null=null
  private idleTimer: NodeJS.Timeout | null = null
  private nudged = new Set<string>()
  private nudgeRestKey: string | null = null
  private state: SessionState | null = null
  private enabled = false
  private titles = false
  private disposed = false

  constructor(
    private watcher: ForegroundWatcher,
    private repo: DistractionRepo,
    private onRestNudge: (app: string) => void,
    private observeTiming: () => void = () => {}
  ) {
    watcher.on('sample', (s) => this.onSample(s))
    watcher.on('status',s=>{
      if(s.state!=='running'){
        const cutoff=this.run?.endedAt??this.now()
        try{this.flush(cutoff)}catch{/* Optional activity cannot block shutdown. */}
        try{this.closeIdle(cutoff)}catch{/* closeIdle clears its pending marker before writing. */}
        this.observingSince=null;this.observingKey=null
        if(this.idleTimer)clearInterval(this.idleTimer);this.idleTimer=null
      }
    })
  }

  /** Collect only during active Focus and running Rest; never Recall, logging, pauses or recovery. */
  setEnabled(enabled: boolean,titles=false): void {
    // Revocation cannot depend on a successful activity/history write.
    this.enabled=false
    this.watcher.stop()
    try{this.flush(this.now())}catch{/* Optional activity may be incomplete if storage fails. */}
    try{this.closeIdle(this.now())}catch{/* Never carry an idle interval across opt-out. */}
    if(this.idleTimer)clearInterval(this.idleTimer)
    this.idleTimer=null;this.observingSince=null;this.observingKey=null
    this.titles=titles===true
    this.watcher.setTitlesEnabled?.(this.titles)
    this.enabled=enabled===true
    if(!this.enabled)this.nudged.clear()
    if(this.state)this.sync(this.state)
  }

  sync(state: SessionState): void {
    this.state = state
    const active = !!this.context(state) && !this.disposed
    if (active && this.enabled) this.watcher.start()
    else {this.watcher.stop();this.observingSince=null;this.observingKey=null}

    const ctx = this.context(state)
    if (this.run && (!ctx || ctx.blockId !== this.run.blockId || ctx.stage !== this.run.stage)) this.flush(this.now())

    const restKey = state.rest?.phase === 'running' ? `${state.rest.blockId}:${state.rest.startedAt}` : null
    if (restKey !== this.nudgeRestKey) {
      this.nudgeRestKey = restKey
      this.nudged.clear()
    }

    const focusing = this.observingSince!==null && this.enabled && !this.disposed && this.watcher.status().state==='running' && !!state.running && distractedSince(state.running) === null
    if (focusing && !this.idleTimer) this.idleTimer = setInterval(() => this.checkIdle(), IDLE_CHECK_MS)
    if (!focusing) {
      // Distracted or no longer focusing: an open idle gap ends here.
      this.closeIdle(this.now())
      if (this.idleTimer) clearInterval(this.idleTimer)
      this.idleTimer = null
    }
  }

  /** A part ended: close its window run and idle gap at the end, then detect its distractions. */
  partEnded(blockId: Id, endedAt: number): void {
    try{
      if(this.run?.blockId===blockId)this.flush(endedAt)
      this.closeIdle(endedAt,blockId)
      this.repo.deriveAuto([blockId])
    }catch{
      this.setEnabled(false,false)
      this.watcher.fail?.() // Optional monitoring must not veto a committed session transition.
    }
  }

  /** End observed activity at the safe cutoff before recovery clears the context. */
  interrupt(at: number): void {
    this.watcher.stop()
    try{this.flush(at)}catch{/* Optional activity cannot veto timing recovery. */}
    try{this.closeIdle(at)}catch{/* Clear the interval even if persistence fails. */}
    if(this.idleTimer)clearInterval(this.idleTimer)
    this.idleTimer=null;this.observingSince=null;this.observingKey=null
  }

  dispose(): void {
    this.disposed=true
    this.setEnabled(false,false)
    this.state=null
  }

  private now():number{return Date.now()+(this.state?.clockOffsetMs??0)}

  private context(state: SessionState): Context | null {
    if(state.recovery)return null
    if (state.running && distractedSince(state.running)===null) return { blockId: state.running.id, stage: 'focus' }
    if (state.rest?.phase === 'running') return { blockId: state.rest.blockId, stage: 'rest' }
    return null
  }

  private onSample(s: WatcherSample): void {
    if(this.disposed||!this.enabled)return
    this.observeTiming()
    s = { ...s, at: s.at + (this.state?.clockOffsetMs ?? 0) }
    if (!this.enabled||this.disposed||!Number.isFinite(s.at)||!Number.isInteger(s.pid)||s.pid<0||typeof s.process!=='string'||!s.process.trim()||typeof s.title!=='string') return // Reject late/invalid samples.
    const ctx = this.state ? this.context(this.state) : null
    if (!ctx) {
      this.flush(s.at)
      return
    }
    const key=`${ctx.blockId}:${ctx.stage}`
    if(key!==this.observingKey){this.observingKey=key;this.observingSince=s.at}
    if(ctx.stage==='focus'&&!this.idleTimer)this.idleTimer=setInterval(()=>this.checkIdle(),IDLE_CHECK_MS)
    const own = isOwnProcess(s.pid)
    if(own){this.flush(s.at);return} // App-owned windows need no activity record.
    const sample = { at: s.at, process: own ? 'FocusRecall' : s.process, title: !this.titles||own ? NO_TITLE : s.title.trim() ? s.title.slice(0,1023) : NO_TITLE }
    if(this.run&&s.at<this.run.endedAt)return
    if(this.run&&s.at-this.run.endedAt>4000){const cutoff=this.run.endedAt;this.flush(cutoff);this.closeIdle(cutoff);this.observingSince=s.at}
    if (this.run && (this.run.blockId !== ctx.blockId || this.run.stage !== ctx.stage)) this.flush(s.at)
    const { current, closed } = nextRun(this.run, sample)
    if (closed && this.run) this.repo.addWindowRun(this.run.blockId, this.run.stage, closed)
    this.run = { ...current, ...ctx }
    if (ctx.stage === 'rest') this.checkRestNudge(this.run)
  }

  private flush(at: number): void {
    const r = this.run
    this.run = null
    if (!r) return
    const end = Math.max(r.endedAt, Math.min(at, r.endedAt + 4_000))
    if (end > r.startedAt) this.repo.addWindowRun(r.blockId, r.stage, { ...r, endedAt: end })
  }

  private checkRestNudge(r: WindowRun & Context): void {
    if (r.endedAt - r.startedAt < REST_NUDGE_MS) return
    if (classify(r.process, r.title, this.repo.rules(), this.state?.rest?.itemId ?? null) !== 'distraction') return
    const key = r.process.toLowerCase()
    if (this.nudged.has(key)) return
    this.nudged.add(key)
    this.repo.flagRestScreen(r.blockId)
    this.onRestNudge(r.process)
  }

  private checkIdle(): void {
    this.observeTiming()
    if (!this.enabled||this.observingSince===null) return
    const b = this.state?.running
    if (!b || distractedSince(b) !== null) return
    let idle:number
    try{idle=powerMonitor.getSystemIdleTime()}catch{return}
    if(!Number.isFinite(idle)||idle<0)return
    const now = Date.now() + (this.state?.clockOffsetMs ?? 0)
    if (idle >= IDLE_SECONDS) {
      if (this.idleStart === null) this.idleStart = Math.max(this.observingSince,Date.parse(b.focusStartedAt), now - idle * 1000)
    } else if (this.idleStart !== null) {
      // Input came back `idle` seconds ago: the gap ends there.
      this.closeIdle(now - idle * 1000)
    }
  }

  private closeIdle(at: number, blockId?: Id): void {
    if (this.idleStart === null) return
    const start = this.idleStart
    this.idleStart = null
    const id = blockId ?? this.state?.running?.id
    if (id !== undefined && at - start >= IDLE_SECONDS * 1000 * 0.9) this.repo.insertIdle(id, start, (at - start) / 1000)
  }
}

function isOwnProcess(pid: number): boolean {
  if (!pid) return false
  if (pid === process.pid) return true
  try {
    return app.getAppMetrics().some((m) => m.pid === pid)
  } catch {
    return false
  }
}
