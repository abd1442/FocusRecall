import { ObservedClock } from '@core/timingIntegrity'
import { EventEmitter } from 'node:events'
import type { StartBlockInput } from '@core/api'
import {
  DISCARD_THRESHOLD_SECONDS,
  IDLE_STATE,
  pauseIntervals,
  runningFocusSeconds,
  sittingExpired,
  type AfterStep,
  type RestState,
  type FinishedBlock,
  type RecoveryPrompt,
  type SessionState
} from '@core/session'
import { adaptiveTarget, type AdaptiveSample } from '@core/modes'
import type { UnfinishedWorkflow } from '@core/session'
import { planRest } from '@core/rest'
import { normalizeBoundaries } from '@core/split'
import { isPaused, msUntilTarget, type TimerMode } from '@core/timer'
import type { LogEntry } from '@core/api'
import type { Id, IsoUtc } from '@core/types'
import { isLongAbsence, type MarkKind } from '@core/captures'
import { distractedSince } from '@core/session'
import type { CaptureRepo } from './repos/captures'
import type { DistractionRepo } from './repos/distractions'
import type { LogRepo } from './repos/logs'
import type { RunningRecord, SessionRepo } from './repos/sessions'
import type { SettingsRepo } from './repos/settings'

const HEARTBEAT_MS = 5_000
const SITTING_CHECK_MS = 60_000

export interface SessionEvents {
  changed: [SessionState]
  timingInterrupted: [{ at: number }]
  targetReached: [{ blockId: Id; itemName: string }]
  /** A part stopped (Finish, a switch, or recovery). Window runs up to `endedAt` belong to it. */
  partEnded: [{ blockId: Id; endedAt: number }]
  /** A Distracted spell ended (Back, the hotkey, or a switch while distracted): ask for the reason. */
  distractionEnded: [{ distractionId: Id }]
  /** Back after a long absence: ask whether to continue or end the session where it was left. */
  longAbsence: [{ minutes: number }]
  restStarted: [{ blockId: Id }]
  /** Rest time is up (not when it was ended by hand). */
  restOver: [{ blockId: Id }]
  restEnded: [{ blockId: Id; early: boolean }]
}

/**
 * Owns the study session: sittings, sessions and their parts (one per
 * subject), Distracted spells, the target alert, the heartbeat and crash
 * recovery. All clocks derive from timestamps stored in the database.
 */
export class SessionEngine extends EventEmitter<SessionEvents> {
  private state: SessionState = IDLE_STATE
  private running: RunningRecord | null = null
  private recovery: RunningRecord | null = null
  /** The finished session waiting for recall and the log. */
  private finishedSessionId: Id | null = null
  private step: AfterStep | null = null
  private rest: RestState | null = null
  private restTimer: NodeJS.Timeout | null = null
  private alertTimer: NodeJS.Timeout | null = null
  private observationTimer: NodeJS.Timeout
  private clock: ObservedClock
  private checkingTime = false
  private pendingCutoff: number | null = null
  private now = (): number => this.clock.at
  private sittingTimer: NodeJS.Timeout
  private unfinished: UnfinishedWorkflow[] = []
  private savedWorkflowJson = ''
  private transitionEvents: (() => void)[] | null = null

  /** Commit related records and workflow metadata before notifying observers. */
  private transition(change: () => void): SessionState {
    this.checkTiming()
    if (this.transitionEvents) { change(); return this.state }
    const previous = { running:this.running,recovery:this.recovery,finished:this.finishedSessionId,step:this.step,rest:this.rest,unfinished:this.unfinished,json:this.savedWorkflowJson }
    const events: (() => void)[] = []
    this.transitionEvents = events
    try { this.repo.transaction(() => { change(); this.persistWorkflow() }) }
    catch (error) {
      this.running=previous.running;this.recovery=previous.recovery;this.finishedSessionId=previous.finished;this.step=previous.step;this.rest=previous.rest;this.unfinished=previous.unfinished;this.savedWorkflowJson=previous.json
      throw error
    } finally { this.transitionEvents = null }
    for (const notify of events) notify()
    return this.refresh()
  }

  private notify<E extends keyof SessionEvents>(event:E,...args:SessionEvents[E]):void {
    const dispatch=():void=>{
      for(const listener of this.rawListeners(event)) {
        try { (listener as (...values:SessionEvents[E])=>void).apply(this,args) } catch { console.error('FocusRecall observer failed:',event) }
      }
    }
    if(this.transitionEvents)this.transitionEvents.push(dispatch)
    else dispatch()
  }

  constructor(
    private repo: SessionRepo,
    private logs: LogRepo,
    private distractions: DistractionRepo,
    private captures: CaptureRepo,
    private settings: SettingsRepo,
    private adaptiveSamples: () => AdaptiveSample[] = () => [],
    wallNow: () => number = Date.now,
    monotonicNow: () => number = () => performance.now()
  ) {
    super()
    this.recovery = repo.getRunning()
    this.clock = new ObservedClock(wallNow, monotonicNow, this.recovery ? Date.parse(this.recovery.lastHeartbeatAt ?? this.recovery.focusStartedAt) : 0)
    this.loadUnfinished()
    this.autoEndQuietSitting()
    this.refresh()
    this.observationTimer = setInterval(() => {
      this.checkTiming()
      if (this.running) this.repo.heartbeat(this.running.id, this.iso())
      if (this.rest?.phase === 'running') this.persistWorkflow(false)
    }, HEARTBEAT_MS)
    this.sittingTimer = setInterval(() => {
      this.checkTiming()
      if (this.autoEndQuietSitting()) this.refresh()
    }, SITTING_CHECK_MS)
  }

  get(): SessionState {
    this.checkTiming()
    return this.state
  }

  private loadUnfinished(): void {
    const pending = new Set(this.repo.pendingSessions())
    const stored = this.settings.readRaw('unfinishedWorkflows')
    if (Array.isArray(stored)) for (const value of stored) {
      if (!value || !Number.isSafeInteger(value.sessionId) || !['recall','log','rest'].includes(value.step)) continue
      const w = value as UnfinishedWorkflow
      if (w.step === 'rest') {
        if(pending.has(w.sessionId))continue
        const r = w.rest
        if (!r || !['plan','running','over'].includes(r.phase) || !Number.isFinite(r.plannedSeconds) || r.plannedSeconds < 0 || !Number.isFinite(w.elapsed) || w.elapsed < 0 || !this.repo.restUnrecorded(r.blockId)) continue
        if (!this.repo.sessionParts(w.sessionId).some((b) => b.id === r.blockId && b.itemId === r.itemId)) continue
      } else if (!pending.has(w.sessionId)) continue
      if (!this.unfinished.some((x) => x.sessionId === w.sessionId)) this.unfinished.push({...w, deferred:w.deferred === true, elapsed:Math.min(w.elapsed || 0,w.rest?.plannedSeconds ?? 0)})
    }
    for (const id of pending) if (!this.unfinished.some((w) => w.sessionId === id)) this.unfinished.push({sessionId:id,step:'recall',deferred:false,rest:null,elapsed:0})
  }

  leaveWorkflow(sessionId: number): SessionState {
    return this.transition(() => {
    this.unfinished = this.unfinished.map((w) => w.sessionId === sessionId ? {...w,deferred:true} : w)
    this.settings.writeRaw('unfinishedWorkflows',this.unfinished)
    })
  }

  resumeWorkflow(sessionId: number): SessionState {
    this.checkTiming()
    if (this.running || this.recovery || this.finishedSessionId !== null || this.rest) throw new Error('Finish the current study step first.')
    return this.transition(() => {
    this.unfinished = []; this.loadUnfinished()
    const w = this.unfinished.find((x) => x.sessionId === sessionId)
    if (!w) throw new Error('This study work is already completed or no longer available.')
    if (w.step === 'rest' && w.rest) {
      const elapsed = w.elapsed, at = this.now()
      this.rest = {...w.rest}
      if(this.rest.phase==='over')this.rest={...this.rest,actualSeconds:elapsed}
      if(this.rest.phase==='plan')this.rest={...this.rest,startedAt:null,endsAt:null,actualSeconds:null}
      if (this.rest.phase === 'running') this.rest = {...this.rest,phase:elapsed >= this.rest.plannedSeconds ? 'over' : 'running',startedAt:new Date(at - elapsed*1000).toISOString(),endsAt:new Date(at+(this.rest.plannedSeconds-elapsed)*1000).toISOString(),actualSeconds:elapsed >= this.rest.plannedSeconds ? elapsed : null}
    } else { this.finishedSessionId = sessionId; this.step = w.step as AfterStep }
    })
  }

  private persistWorkflow(validate = true): void {
    let active: UnfinishedWorkflow | null = null
    if (this.finishedSessionId !== null) active = {sessionId:this.finishedSessionId,step:this.step ?? 'recall',rest:null,elapsed:0,deferred:false}
    else if (this.rest) {
      const sessionId = this.repo.sessionIdForBlock(this.rest.blockId)
      if (sessionId !== null) active = {sessionId,step:'rest',rest:this.rest,elapsed:this.rest.actualSeconds ?? this.restElapsed(this.rest),deferred:false}
    }
    if (validate) {
      const pending = new Set(this.repo.pendingSessions())
      this.unfinished = this.unfinished.filter((w) => w.step === 'rest' ? !!w.rest && this.repo.restUnrecorded(w.rest.blockId) : pending.has(w.sessionId))
    }
    if (active) this.unfinished = [...this.unfinished.filter((w) => w.sessionId !== active!.sessionId),active]
    const json=JSON.stringify(this.unfinished)
    if(json!==this.savedWorkflowJson){this.settings.writeRaw('unfinishedWorkflows',this.unfinished);this.savedWorkflowJson=json}
  }

  getLogDraft(sessionId: number): unknown { return this.settings.readRaw(`logDraft:${sessionId}`) }
  getRecallDraft(sessionId:number):unknown {return this.settings.readRaw(`recallDraft:${sessionId}`)}
  saveRecallDraft(sessionId:number,draft:unknown):void {
    if(!this.repo.pendingSessions().includes(sessionId))throw new Error('This session is no longer waiting for recall.')
    if(!draft || typeof draft!=='object' || JSON.stringify(draft).length>16_000_000)throw new Error('The recall draft is too large or invalid.')
    this.settings.writeRaw(`recallDraft:${sessionId}`,draft)
  }
  saveLogDraft(sessionId: number, draft: unknown): void {
    if (!this.repo.pendingSessions().includes(sessionId)) throw new Error('This session is no longer waiting for a log.')
    if (!draft || typeof draft !== 'object' || JSON.stringify(draft).length > 1_000_000) throw new Error('Invalid log draft.')
    this.settings.writeRaw(`logDraft:${sessionId}`,draft)
  }

  start(input: StartBlockInput): SessionState {
    this.checkTiming()
    if (this.running || this.recovery) throw new Error('A session is already running.')
    if (this.finishedSessionId !== null) throw new Error('Finish the current recall first.')
    if (!this.repo.itemIsActive(input.itemId) || !['flow','fixed','adaptive'].includes(input.timerMode) || !Number.isFinite(input.targetSeconds) || input.targetSeconds <= 0 || input.targetSeconds > 86400) throw new Error('Choose an active subject and a valid timer target.')
    return this.transition(() => {
    if (this.rest) this.finishRest(null)
    this.autoEndQuietSitting()
    const at = this.iso()
    this.repo.transaction(() => {
      const sittingId = this.repo.openSitting()?.id ?? this.repo.createSitting(at)
      const sessionId = this.repo.createSession(sittingId, at)
      const { goal, ...block } = input
      if (goal?.trim() && this.settings.getAll().captures.goal) this.captures.setGoal(sessionId, goal)
      this.repo.insertBlock({ sittingId, sessionId, ...block, startedAt: at })
    })
    this.settings.set('lastItemId', input.itemId)
    this.settings.set('lastTimerMode', input.timerMode)
    this.settings.set('nextGoal', '')
    })
  }

  /** Start a session on the last subject with the last mode (the floating panel's Start). */
  startLast(): SessionState {
    const s = this.settings.getAll()
    if (s.lastItemId === null || !this.repo.itemIsActive(s.lastItemId)) {
      throw new Error('Pick a subject in FocusRecall first.')
    }
    const timerMode = s.lastTimerMode ?? s.defaultTimerMode
    return this.start({ itemId: s.lastItemId, timerMode, targetSeconds: this.targetFor(s.lastItemId, timerMode) })
  }

  /** The target a mode uses: Flow the default target, Fixed its countdown, Adaptive the suggestion. */
  targetFor(itemId: Id, mode: TimerMode): number {
    const s = this.settings.getAll()
    if (mode === 'fixed') return s.fixedMinutes * 60
    if (mode === 'adaptive') return adaptiveTarget(this.adaptiveSamples(), itemId, s.focusTargetMinutes * 60).targetSeconds
    return s.focusTargetMinutes * 60
  }

  /** "Distracted": the focus clock stops until Back. */
  distracted(): SessionState {
    const b = this.requireRunning()
    if (isPaused(pauseIntervals(b.pauses))) return this.state
    this.repo.openPause(b.id, this.iso())
    return this.refresh()
  }

  /**
   * "Back": the clock runs again and the spell is saved as a distraction
   * (reason asked next). After a long absence it first asks whether to go on
   * or end the session where it was left; `force` skips that question.
   */
  back(force = false): SessionState {
    const b = this.requireRunning()
    const s = this.settings.getAll()
    if (!force && s.captures.longAbsence && isLongAbsence(distractedSince(b), this.now(), s.longAbsenceMinutes)) {
      this.notify('longAbsence', { minutes: Math.round((this.now() - Date.parse(distractedSince(b)!)) / 60_000) })
      return this.state
    }
    return this.transition(()=>{this.closePauseAt(b, this.now())})
  }

  /** The answer to the long-absence question. "end" finishes the session at the moment Distracted was pressed. */
  resolveLongAbsence(choice: 'continue' | 'end'): SessionState {
    const b = this.requireRunning()
    const since = distractedSince(b)
    if (choice === 'continue' || since === null) return this.back(true)
    return this.transition(() => {
    const at = Date.parse(since)
    this.repo.deleteOpenPause(b.id)
    this.endPart({ ...b, pauses: b.pauses.filter((p) => p.endedAt !== null) }, at, 'finish')
    this.endSessionOf(b.sessionId, at)
    this.step = 'recall'
    if(this.settings.getAll().studyExperience==='quick')this.closeQuickWorkflow(b.sessionId)
    })
  }

  /**
   * A stuck or resisted marker at this moment, on the running part. A stuck
   * note typed afterwards (the note box opens after the tap) goes on the
   * marker just placed.
   */
  mark(kind: MarkKind, note: string | null): void {
    const b = this.requireRunning()
    if (kind === 'stuck' && note?.trim()) this.captures.noteLatestStuck(b.id, note)
    else this.captures.addMark(b.id, this.iso(), kind, note)
  }

  /** Park a thought: it does not stop the clock. Works between sessions too. */
  park(text: string): void {
    this.checkTiming()
    const b = this.running
    this.captures.park(text, this.iso(), b?.sessionId ?? null, b?.itemId ?? this.settings.getAll().lastItemId)
  }

  /** Pick up edits made on the timeline (parts and focus may have changed). */
  touch(): SessionState {
    return this.refresh()
  }

  /** The hotkey and the panel button: Distracted when focusing, Back when distracted. */
  toggleDistracted(): SessionState {
    const b = this.requireRunning()
    return isPaused(pauseIntervals(b.pauses)) ? this.back() : this.distracted()
  }

  /**
   * Switch subject in the middle of a session. The session goes on with the
   * same clock and target; the part on the old subject ends here and a new
   * part on the chosen subject starts.
   */
  switchTo(itemId: Id): SessionState {
    const b = this.requireRunning()
    if (itemId === b.itemId) return this.state
    if (!this.repo.itemIsActive(itemId)) throw new Error('That subject is archived.')
    return this.transition(() => {
    const now = this.now()
    this.repo.transaction(() => {
      const alertedAt = this.repo.targetAlertedAt(b.id)
      this.endPart(b, now, 'switch')
      this.repo.insertBlock({
        sittingId: b.sittingId,
        sessionId: b.sessionId,
        itemId,
        timerMode: b.timerMode,
        targetSeconds: b.targetSeconds,
        startedAt: new Date(now).toISOString(),
        origin: 'live_switch',
        targetAlertedAt: alertedAt
      })
    })
    this.settings.set('lastItemId', itemId)
    })
  }

  /**
   * "Finish this subject first": end the session now (recall, log and rest as
   * usual) and have the chosen subject ready for the next one. Nothing starts
   * by itself.
   */
  wrapUp(nextItemId: Id): SessionState {
    return this.transition(()=>{this.finish();this.settings.set('lastItemId', nextItemId)})
  }

  /** End the session now and move to recall. */
  finish(): SessionState {
    if(this.settings.getAll().studyExperience==='quick')return this.quickAction('finish')
    const b = this.requireRunning()
    const now = this.now()
    return this.transition(() => {
    this.endPart(b, now, 'finish')
    this.endSessionOf(b.sessionId, now)
    this.step = 'recall'
    })
  }

  /** One atomic user action; no auto-filled answers, recall, advice or mandatory break. */
  quickAction(destination:'next'|'break'|'finish',expectedBlockId?:Id):SessionState {
    if(this.settings.getAll().studyExperience!=='quick'||!['next','break','finish'].includes(destination))throw Error('Quick Mode is not active.')
    const b=this.requireRunning()
    if(expectedBlockId!==undefined&&expectedBlockId!==b.id)return this.state
    return this.transition(()=>{
      this.endPart(b,this.now(),'finish')
      this.endSessionOf(b.sessionId,this.now())
      this.closeQuickWorkflow(b.sessionId,destination)
      if(destination==='next'){
        this.running=null
        this.start({itemId:b.itemId,timerMode:b.timerMode,targetSeconds:b.targetSeconds})
      }
    })
  }

  private closeQuickWorkflow(sessionId:Id,destination:'next'|'finish'|'break'='finish'):void {
    this.repo.closeWithoutAnswers(sessionId)
    this.running=null
    this.finishedSessionId=null;this.step=null
    this.unfinished=this.unfinished.filter(w=>w.sessionId!==sessionId)
    if(destination==='break'){
      const parts=this.repo.sessionParts(sessionId),last=parts[parts.length-1],sitting=this.repo.openSitting()!
      const info=this.repo.restInfo(sitting.id),plan=planRest(info.focusSinceLastRest,info.restsTaken,this.settings.getAll().restRules)
      this.rest={blockId:last.id,itemId:last.itemId,phase:'plan',plannedSeconds:plan.seconds,long:plan.long,startedAt:null,endsAt:null,actualSeconds:null}
      this.startRest(plan.seconds)
    }else if(destination==='finish')this.endSitting()
  }

  /**
   * The forgotten switch, from the recall screen: split the session's last
   * part into one part per subject (the original subject first, then the
   * added ones), evenly for now; the log has dividers to set the real times.
   */
  splitLast(itemIds: Id[]): SessionState {
    const parts = this.requireFinished()
    const last = parts[parts.length - 1]
    const extra = itemIds.filter((id) => id !== last.itemId)
    if (!extra.length) return this.state
    this.repo.transaction(() => {
      const ids=this.repo.splitPart(last.id, extra)
      this.distractions.deriveAuto(ids)
      this.distractions.refreshSessionStats(last.sessionId)
    })
    return this.refresh()
  }

  /** Recall is written (it autosaves as you type); move to the log. */
  completeRecall(): SessionState {
    this.requireFinished()
    return this.transition(()=>{
      this.step='log'
      this.settings.writeRaw(`recallDraft:${this.finishedSessionId}`,null)
    })
  }

  /**
   * New times for parts split afterwards, from the dividers on the session
   * timeline. The parts must be consecutive parts of the finished session.
   */
  adjustSplit(blockIds: Id[], boundaries: IsoUtc[]): SessionState {
    const parts = this.requireFinished()
    const chosen = blockIds.map((id) => parts.find((p) => p.id === id))
    if (chosen.some((p) => !p) || boundaries.length !== blockIds.length - 1) throw new Error('Those parts cannot be adjusted.')
    const list = chosen as FinishedBlock[]
    const start = Date.parse(list[0].focusStartedAt)
    const end = Date.parse(list[list.length - 1].focusEndedAt)
    const cuts = normalizeBoundaries(start, end, boundaries.map((b) => Date.parse(b)))
    this.repo.transaction(() => {
      this.repo.retime(blockIds, start, end, cuts)
      this.distractions.deriveAuto(blockIds)
      this.distractions.refreshSessionStats(list[0].sessionId)
    })
    return this.refresh()
  }

  /** Save the log for every part of the session, then offer the rest. */
  submitLog(entries: LogEntry[]): SessionState {
    const parts = this.requireFinished()
    return this.transition(() => {
    const waiting = new Set(parts.map((f) => f.id))
    if (entries.length !== waiting.size || new Set(entries.map((e) => e.blockId)).size !== waiting.size) throw new Error('Save the log for every part of this session.')
    const allParts=this.repo.sessionParts(parts[0].sessionId)
    const last = allParts[allParts.length - 1]
    const sitting = this.repo.openSitting()
    let nextRest: RestState | null = null
    if (last && sitting && this.repo.restUnrecorded(last.id)) {
      const info=this.repo.restInfo(sitting.id),plan=planRest(info.focusSinceLastRest,info.restsTaken,this.settings.getAll().restRules)
      nextRest={blockId:last.id,itemId:last.itemId,phase:'plan',plannedSeconds:plan.seconds,long:plan.long,startedAt:null,endsAt:null,actualSeconds:null}
    }
    const nextWorkflows=this.unfinished.filter((w)=>w.sessionId!==parts[0].sessionId)
    if(nextRest)nextWorkflows.push({sessionId:parts[0].sessionId,step:'rest',rest:nextRest,elapsed:0,deferred:false})
    this.repo.transaction(() => {
      for (const e of entries) {
        if (!waiting.has(e.blockId)) throw new Error('That part is not waiting for its log.')
        this.logs.saveValues(e.blockId, e.values, e.notes, e.untouched)
      }
      this.distractions.refreshSessionStats(parts[0].sessionId)
      this.settings.writeRaw(`logDraft:${parts[0].sessionId}`,null)
    })
    this.finishedSessionId = null
    this.step = null
    this.rest=nextRest;this.unfinished=nextWorkflows
    })
  }

  /** Save once and choose the next destination in the same transaction. */
  finishWrapUp(entries:LogEntry[],destination:'finish'|'break'|'next'):SessionState {
    this.requireFinished()
    if(!['finish','break','next'].includes(destination))throw Error('Choose what to do next.')
    const recallDraft=this.getRecallDraft(this.finishedSessionId!) as {added?:unknown[]}|null
    if(this.step==='recall'&&recallDraft?.added?.length)throw Error('Finish your saved recall details first so added subjects and notes are preserved.')
    return this.transition(()=>{
      if(this.step==='recall')this.completeRecall()
      this.submitLog(entries)
      if(destination==='break'&&this.rest)this.startRest(this.rest.plannedSeconds)
      if(destination!=='break'&&this.rest)this.skipRest()
      if(destination==='finish')this.endSitting()
    })
  }

  /** Begin the rest with the chosen length. */
  startRest(seconds: number): SessionState {
    if(!Number.isFinite(seconds) || seconds<0)throw new Error('Choose a valid rest length.')
    const r = this.requireRest()
    return this.transition(() => {
    const now = this.now()
    const planned = Math.max(60, Math.round(seconds))
    this.rest = { ...r, phase: 'running', plannedSeconds: planned, startedAt: new Date(now).toISOString(), endsAt: new Date(now + planned * 1000).toISOString() }
    this.notify('restStarted', { blockId: r.blockId })
    })
  }

  updateRestPlan(seconds:number):SessionState {
    const r=this.requireRest()
    if(r.phase!=='plan' || !Number.isFinite(seconds) || seconds<60 || seconds>5400)throw new Error('Choose a rest length between 1 and 90 minutes.')
    return this.transition(()=>{this.rest={...r,plannedSeconds:Math.round(seconds)}})
  }

  /** End a running rest before its time. */
  endRestEarly(): SessionState {
    const r = this.requireRest()
    if (r.phase !== 'running') return this.state
    return this.transition(() => {
    this.rest = { ...r, phase: 'over', actualSeconds: this.restElapsed(r) }
    this.notify('restEnded', { blockId: r.blockId, early: true })
    })
  }

  /** No rest this time. It is recorded as skipped. */
  skipRest(): SessionState {
    const r = this.requireRest()
    return this.transition(() => {
    this.repo.recordRest(r.blockId, { planned: r.plannedSeconds, actual: r.phase === 'plan' ? 0 : this.restElapsed(r), activity: null, skipped: true })
    if (r.phase === 'running') this.notify('restEnded', { blockId: r.blockId, early: true })
    this.rest = null
    })
  }

  /** Record what the rest was and go back to the between-sessions step. */
  finishRest(activity: string | null): SessionState {
    const r = this.requireRest()
    return this.transition(() => {
    const actual = r.actualSeconds ?? this.restElapsed(r)
    if (r.phase === 'running') this.notify('restEnded', { blockId: r.blockId, early: true })
    this.repo.recordRest(r.blockId, { planned: r.plannedSeconds, actual, activity, skipped: actual === 0 })
    this.rest = null
    })
  }

  /** From the panel during rest: close the rest and start the next session. */
  startNextFromRest(): SessionState {
    return this.transition(()=>{if (this.rest) this.finishRest(null);this.startLast()})
  }

  private requireRest(): RestState {
    this.checkTiming()
    if (!this.rest) throw new Error('There is no rest right now.')
    return this.rest
  }

  private restElapsed(r: RestState): number {
    if (r.actualSeconds !== null) return r.actualSeconds
    if (!r.startedAt) return 0
    return Math.min(r.plannedSeconds, Math.max(0, Math.round((this.now() - Date.parse(r.startedAt)) / 1000)))
  }

  /** Delete the just-finished session (the "Discard this session?" prompt). */
  discardFinished(): SessionState {
    if (this.finishedSessionId === null || this.step !== 'recall') throw new Error('Only a session waiting for recall can be discarded.')
    if(this.repo.pendingParts(this.finishedSessionId).reduce((n,b)=>n+b.focusSeconds,0)>=DISCARD_THRESHOLD_SECONDS)throw new Error('Use History to review or remove a longer session explicitly.')
    const sessionId = this.finishedSessionId
    return this.transition(() => {
    const sittingId = this.state.sitting?.id
    this.repo.transaction(() => {
      this.repo.deleteSession(sessionId)
      if (sittingId) this.repo.deleteSittingIfEmpty(sittingId)
    })
    this.finishedSessionId = null
    this.step = null
    })
  }

  finishStudying():SessionState {
    if(this.running||this.finishedSessionId!==null)throw Error('Save the current session first.')
    return this.transition(()=>{if(this.rest)this.finishRest(null);this.endSitting()})
  }

  endSitting(): SessionState {
    if (this.running) throw new Error('Finish the running session first.')
    return this.transition(() => {
    const sitting = this.repo.openSitting()
    if (sitting) this.repo.endSitting(sitting.id, this.iso())
    this.finishedSessionId = null
    this.step = null
    this.rest = null
    })
  }

  /**
   * Crash recovery. "continue" resumes the session; the time the app was
   * closed is recorded as a Distracted spell, labelled "away" (excluded from
   * focus). "end" ends the session at the last moment the app saw it alive.
   */
  resolveRecovery(choice: 'continue' | 'end'): SessionState {
    this.checkTiming()
    const b = this.recovery
    if (!b) return this.state
    return this.transition(() => {
    this.recovery = null
    const lastKnown = Date.parse(b.lastHeartbeatAt ?? b.focusStartedAt)
    if (choice === 'continue') {
      if (!isPaused(pauseIntervals(b.pauses))) {
        this.repo.openPause(b.id, new Date(lastKnown).toISOString())
        const id = this.closePauseAt(b, this.now(), false)
        if (id !== null) this.distractions.setKind(id, 'away')
      }
    } else {
      this.endPart(b, lastKnown, 'finish')
      this.endSessionOf(b.sessionId, lastKnown)
      this.step = 'recall'
      if(this.settings.getAll().studyExperience==='quick')this.closeQuickWorkflow(b.sessionId)
    }
    })
  }

  dispose(): void {
    this.checkTiming()
    this.persistWorkflow()
    this.clearTimers()
    clearInterval(this.observationTimer)
    clearInterval(this.sittingTimer)
    if (this.running) this.repo.heartbeat(this.running.id, this.iso())
  }

  /** OS suspend/lock is observed now; resume without suspend excludes the last blind interval. */
  interruptTiming(resuming = false): SessionState {
    const previous = this.clock.at
    this.checkTiming()
    this.pendingCutoff ??= resuming ? previous : this.now()
    this.checkTiming()
    return this.state
  }

  private checkTiming(): void {
    if (this.checkingTime || this.transitionEvents) return
    this.checkingTime = true
    try {
      const sample = this.clock.sample()
      if (sample.interrupted) this.pendingCutoff ??= sample.previous
      if (this.pendingCutoff !== null) {
        this.interruptAt(this.pendingCutoff)
        this.pendingCutoff = null
      }
    } finally { this.checkingTime = false }
  }

  private interruptAt(at: number): void {
    if (!this.running && this.rest?.phase !== 'running') return
    this.transition(() => {
      this.notify('timingInterrupted', { at })
      if (this.running) {
        // Persist the cutoff before showing recovery. A crash here must not credit downtime.
        this.repo.heartbeat(this.running.id, new Date(at).toISOString())
        this.recovery = this.repo.getRunning()
        this.running = null
      }
      if (this.rest?.phase === 'running') {
        const r = this.rest
        const actualSeconds = Math.min(r.plannedSeconds, Math.max(0, (at - Date.parse(r.startedAt!)) / 1000))
        this.rest = { ...r, phase: 'over', actualSeconds }
        this.notify('restEnded', { blockId: r.blockId, early: true })
      }
    })
  }

  // --- internals -----------------------------------------------------------

  private endPart(b: RunningRecord, atMs: number, endedBy: 'finish' | 'switch'): void {
    this.repo.transaction(() => {
      this.closePauseAt(b, atMs)
      const pauses = this.repo.pauses(b.id)
      const focusSeconds = runningFocusSeconds({ focusStartedAt: b.focusStartedAt, pauses }, atMs)
      this.repo.finishBlock(b.id, new Date(atMs).toISOString(), focusSeconds, endedBy)
    })
    this.notify('partEnded', { blockId: b.id, endedAt: atMs })
  }

  private endSessionOf(sessionId: Id, atMs: number): void {
    this.repo.endSession(sessionId, new Date(atMs).toISOString())
    this.distractions.refreshSessionStats(sessionId)
    this.finishedSessionId = sessionId
  }

  /**
   * Close an open Distracted spell at `atMs` and save it as a distraction.
   * Returns its id, or null when nothing was open.
   */
  private closePauseAt(b: RunningRecord, atMs: number, askReason = true): Id | null {
    const open = this.repo.pauses(b.id).find((p) => p.endedAt === null)
    if (!open) return null
    const startedMs = Date.parse(open.startedAt)
    const endMs = Math.max(atMs, startedMs)
    this.repo.closePause(b.id, new Date(endMs).toISOString())
    const id = this.distractions.insertManual(b.id, startedMs, (endMs - startedMs) / 1000)
    if(this.settings.getAll().studyExperience==='quick')this.distractions.setKind(id,'timer-pause')
    if (askReason&&this.settings.getAll().studyExperience!=='quick') this.notify('distractionEnded', { distractionId: id })
    return id
  }

  /**
   * End the open sitting at its last activity if it has been quiet longer than
   * the setting allows. Never while a session runs or waits for recall.
   */
  private autoEndQuietSitting(): boolean {
    if (this.recovery || this.repo.getRunning() || this.finishedSessionId !== null) return false
    const sitting = this.repo.openSitting()
    if (!sitting) return false
    const last = this.repo.sittingLastActivity(sitting.id)
    if (!sittingExpired(last, this.now(), this.settings.getAll().sittingAutoEndHours)) return false
    this.repo.endSitting(sitting.id, new Date(last).toISOString())
    return true
  }

  private requireRunning(): RunningRecord {
    this.checkTiming()
    if (!this.running) throw new Error('No session is running.')
    return this.running
  }

  private requireFinished(): FinishedBlock[] {
    const parts = this.finishedSessionId !== null ? this.repo.pendingParts(this.finishedSessionId) : []
    if (!parts.length) throw new Error('No session is waiting for recall.')
    return parts
  }

  private iso(): string {
    return new Date(this.now()).toISOString()
  }

  private refresh(): SessionState {
    this.checkTiming()
    this.running = this.recovery ? null : this.repo.getRunning()
    const sitting = this.repo.openSitting()
    const b = this.running
    const finished = this.finishedSessionId !== null ? this.repo.pendingParts(this.finishedSessionId) : []
    if (this.finishedSessionId !== null && !finished.length) this.finishedSessionId = null
    this.persistWorkflow()
    this.state = {
      clockOffsetMs: this.clock.offsetMs,
      unfinished: this.unfinished.filter((w) => w.sessionId !== this.finishedSessionId && (this.rest === null || w.rest?.blockId !== this.rest.blockId)).map((w)=>{
        const parts=this.repo.sessionParts(w.sessionId)
        return {...w,itemName:[...new Set(parts.map((p)=>p.itemName))].join(' · '),endedAt:parts[parts.length-1]?.focusEndedAt}
      }),
      stage: b ? 'focus' : finished.length ? 'recall' : this.rest ? 'rest' : 'idle',
      sitting,
      running: b
        ? {
            id: b.id,
            sessionId: b.sessionId,
            sittingId: b.sittingId,
            itemId: b.itemId,
            itemName: b.itemName,
            itemColor: b.itemColor,
            timerMode: b.timerMode,
            targetSeconds: b.targetSeconds,
            focusStartedAt: b.focusStartedAt,
            pauses: b.pauses,
            targetAlerted: b.targetAlerted,
            parts: b.parts
          }
        : null,
      finished,
      step: finished.length ? this.step : null,
      rest: this.rest,
      recovery: this.recovery ? this.recoveryPrompt(this.recovery) : null
    }
    this.schedule()
    this.notify('changed', this.state)
    return this.state
  }

  private recoveryPrompt(b: RunningRecord): RecoveryPrompt {
    const lastKnownAt = b.lastHeartbeatAt ?? b.focusStartedAt
    return {
      blockId: b.id,
      itemName: b.itemName,
      itemColor: b.itemColor,
      focusStartedAt: b.focusStartedAt,
      lastKnownAt,
      focusSecondsAtLastKnown: runningFocusSeconds(b, Date.parse(lastKnownAt))
    }
  }

  private schedule(): void {
    this.clearTimers()
    const r = this.rest
    if (r && r.phase === 'running' && r.endsAt) {
      this.restTimer = setTimeout(() => {
        this.checkTiming()
        if (this.rest !== r || this.rest.phase !== 'running') return
        this.rest = { ...r, phase: 'over', actualSeconds: r.plannedSeconds }
        this.notify('restOver', { blockId: r.blockId })
        this.notify('restEnded', { blockId: r.blockId, early: false })
        this.refresh()
      }, Math.max(0, Date.parse(r.endsAt) - this.now()) + 50)
    }
    const b = this.running
    if (!b) return

    this.repo.heartbeat(b.id, this.iso())

    if (b.targetAlerted) return
    const removed = pauseIntervals(b.pauses)
    if (isPaused(removed)) return
    // The target applies to the whole session: earlier parts count toward it.
    const prior = b.parts.reduce((s, p) => s + p.focusSeconds, 0)
    const ms = msUntilTarget(Date.parse(b.focusStartedAt), this.now(), removed, b.targetSeconds - prior) ?? 0
    this.alertTimer = setTimeout(() => {
      this.checkTiming()
      if (this.running?.id !== b.id || this.recovery) return
      this.repo.markTargetAlerted(b.id, this.iso())
      this.notify('targetReached', { blockId: b.id, itemName: b.itemName })
      this.refresh()
    }, ms + 50)
  }

  private clearTimers(): void {
    if (this.restTimer) clearTimeout(this.restTimer)
    this.restTimer = null
    if (this.alertTimer) clearTimeout(this.alertTimer)
    this.alertTimer = null
  }
}
