import { normalizeAppearance, type Appearance } from '@core/appearance'
import { DEFAULT_SETTINGS, type AppSettings, type SettingKey } from '@core/settings'
import type { Db } from '../db/database'
import { isLanguage, normalizeLanguage } from '@core/localization'
import { validateIpcArgs } from '@core/ipcValidation'

/** Key/value settings, stored as JSON. Unknown or missing keys fall back to defaults. */
export class SettingsRepo {
  constructor(private db: Db) {
    // Establish fresh-profile defaults once. Never enable collection as a
    // side effect of upgrading an existing profile or reading legacy settings.
    db.transaction(()=>{
      const rows=db.prepare('SELECT key FROM settings').all() as {key:string}[]
      const fresh=rows.length===0 && !db.prepare('SELECT 1 FROM blocks LIMIT 1').get() && !db.prepare('SELECT 1 FROM items LIMIT 1').get()
      if(!rows.some(r=>r.key==='foregroundTrackingEnabled'))this.write('foregroundTrackingEnabled',false)
      if(!rows.some(r=>r.key==='starterGuideCompleted'))this.write('starterGuideCompleted',!fresh)
    })()
  }

  getAll(): AppSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const out: AppSettings = structuredClone(DEFAULT_SETTINGS)
    // Invalid/missing collection consent is never a reason to enable tracking.
    out.foregroundTrackingEnabled = false
    for (const { key, value } of rows) {
      if (!Object.hasOwn(DEFAULT_SETTINGS, key)) continue
      try {
        const parsed: unknown = JSON.parse(value)
        validateIpcArgs('settings:set', [key, parsed])
        ;(out as unknown as Record<string, unknown>)[key] = parsed
      } catch {
        // Preserve the original for recovery; one damaged preference must not
        // prevent access to history or backups. Reads never repair stored data.
      }
    }
    out.language = normalizeLanguage(out.language)
    return out
  }

  set<K extends SettingKey>(key: K, value: AppSettings[K]): void {
    if (key === 'language' && !isLanguage(value)) throw new Error('Choose a supported language.')
    this.db.transaction(()=>{
      this.write(key, value)
      // Only a new explicit enable action accepts the current disclosure. A
      // legacy true alone cannot distinguish opt-in from the former default.
      if(key==='foregroundTrackingEnabled'&&value===true)this.write('foregroundTrackingConsentVersion',1)
    })()
  }

  getAppearance(): Appearance {
    return normalizeAppearance(this.readRaw('appearance') as Partial<Appearance> | null)
  }

  setAppearance(a: Appearance): Appearance {
    const n = normalizeAppearance(a)
    this.write('appearance', n)
    return n
  }

  /** Values that are not user settings (window bounds and such). */
  readRaw(key: string): unknown {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    if (!row) return null
    try { return JSON.parse(row.value) } catch { return null }
  }

  writeRaw(key: string, value: unknown): void {
    this.write(key, value)
  }

  private write(key: string, value: unknown): void {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, JSON.stringify(value))
  }
}
