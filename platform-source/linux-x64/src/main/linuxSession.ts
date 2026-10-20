import { execFile } from 'node:child_process'
import { LinuxLockWatch } from './linuxLock'

export type DesktopObservation = 'active' | 'locked' | 'unknown'
export function parseLoginSession(text: string,uid=process.getuid?.()): DesktopObservation {
  const fields = new Map(text.trim().split(/\r?\n/).map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]
  }))
  if(!['x11','wayland'].includes(fields.get('Type')??'')||!['user','user-early'].includes(fields.get('Class')??''))return 'unknown'
  if(uid===undefined||fields.get('User')!==String(uid))return 'unknown'
  if (fields.get('LockedHint') === 'yes' || fields.get('Active') === 'no') return 'locked'
  if (fields.get('LockedHint') === 'no' && fields.get('Active') === 'yes' && fields.get('State') === 'active') return 'active'
  return 'unknown'
}
export function readLinuxSession(): Promise<DesktopObservation> {
  const id = process.env.XDG_SESSION_ID||'auto'
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return Promise.resolve('unknown')
  // Fixed system tool, no shell, titles, user command, privilege escalation or
  // screen scraping. Missing logind/tools/session permission fails closed.
  return new Promise(resolve => execFile('/usr/bin/loginctl', ['show-session', id, '--no-pager','--no-ask-password', '--property=LockedHint', '--property=Active', '--property=State','--property=Type','--property=Class','--property=User'],
    { timeout: 1500, maxBuffer: 4096, encoding: 'utf8' }, (error, stdout) => resolve(error ? 'unknown' : parseLoginSession(stdout))))
}
export class LinuxSessionObserver {
  private last = 0
  private state: DesktopObservation = 'unknown'
  private timer: NodeJS.Timeout | null = null
  private pending = false
  private disposed = false
  private lock:LinuxLockWatch|null
  constructor(private interrupt: () => void, private read = readLinuxSession, private now = Date.now,lock?:LinuxLockWatch) {
    this.lock=lock??(read===readLinuxSession?new LinuxLockWatch(state=>{if(state!=='active'){this.state='unknown';this.interrupt()}}):null)
  }
  canObserve = (): boolean => !this.disposed && this.state === 'active' && (!this.lock||this.lock.state==='active') && this.now() - this.last < 3000
  async start(): Promise<void> { await this.poll(); if (!this.disposed) this.timer = setInterval(() => { void this.poll() }, 1000) }
  private async poll(): Promise<void> {
    if (this.pending || this.disposed) return
    this.pending = true
    try {
      await this.lock?.start()
      // No need to fork loginctl while an absent/locked provider already makes
      // timing ineligible. Reconcile the owning seat only while unlocked.
      const observed = this.lock&&this.lock.state!=='active'?'unknown':await this.read().catch(() => 'unknown' as const)
      const state=observed==='active'&&this.lock&&this.lock.state!=='active'?'unknown':observed
      if (this.disposed) return
      // A stale probe is not fresh evidence, including event-loop stalls.
      const stale = this.last > 0 && this.now() - this.last >= 3000
      const wasActive=this.state==='active'
      this.state = state; this.last = this.now()
      if (state !== 'active'&&wasActive || stale) this.interrupt()
    } finally { this.pending = false }
  }
  dispose(): void { this.disposed = true; this.state = 'unknown'; this.lock?.dispose(); if (this.timer) clearInterval(this.timer); this.timer = null }
}
