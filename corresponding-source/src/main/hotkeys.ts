import { globalShortcut } from 'electron'
import type { HotkeyStatus } from '@core/api'

export type HotkeyName = 'distracted' | 'switch' | 'stuck' | 'resisted'
const NAMES: HotkeyName[] = ['distracted', 'switch', 'stuck', 'resisted']

/**
 * The global hotkeys. They are registered only while a session runs, so the
 * keys stay free for other programs the rest of the time. Outside a session
 * each key is test-registered once, so Settings can say whether Windows lets
 * FocusRecall have it. (A program with a keyboard hook, such as a screenshot
 * tool, can still take a key without Windows saying so.)
 */
export class Hotkeys {
  private keys: Record<HotkeyName, string> = { distracted: '', switch: '', stuck: '', resisted: '' }
  private ok: Record<HotkeyName, boolean> = { distracted: true, switch: true, stuck: true, resisted: true }
  private active = false

  constructor(private actions: Record<HotkeyName, () => void>) {}

  /** New keys from Settings. An empty key is off. */
  configure(keys: Record<HotkeyName, string>): void {
    const next = Object.fromEntries(NAMES.map((n) => [n, keys[n].trim()])) as Record<HotkeyName, string>
    if (NAMES.every((n) => next[n] === this.keys[n])) return
    const wasActive = this.active
    this.deactivate()
    this.keys = next
    if (wasActive) this.activate()
    else this.probe()
  }

  /** A session started: take the keys. */
  activate(): void {
    if (this.active) return
    this.active = true
    for (const name of NAMES) this.ok[name] = this.register(name)
  }

  /** The session is over: give the keys back. */
  deactivate(): void {
    if (!this.active) return
    this.active = false
    for (const name of NAMES) {
      const key = this.keys[name]
      if (key && this.ok[name] && globalShortcut.isRegistered(key)) globalShortcut.unregister(key)
    }
  }

  status(): HotkeyStatus {
    const one = (n: HotkeyName): { key: string; ok: boolean } => ({ key: this.keys[n], ok: !this.keys[n] || this.ok[n] })
    return { distracted: one('distracted'), switch: one('switch'), stuck: one('stuck'), resisted: one('resisted') }
  }

  private probe(): void {
    for (const name of NAMES) {
      const key = this.keys[name]
      this.ok[name] = this.register(name)
      if (key && this.ok[name] && globalShortcut.isRegistered(key)) globalShortcut.unregister(key)
    }
  }

  private register(name: HotkeyName): boolean {
    const key = this.keys[name]
    if (!key) return true
    // The same key twice cannot work: the earlier name keeps it.
    if (NAMES.slice(0, NAMES.indexOf(name)).some((n) => this.keys[n] === key)) return false
    try {
      return globalShortcut.register(key, this.actions[name])
    } catch {
      return false
    }
  }
}
