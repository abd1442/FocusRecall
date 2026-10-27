import { expect, it } from 'vitest'
import { openDatabase } from '../main/db/database'
import { SettingsRepo } from '../main/repos/settings'

it('defaults preparation off for fresh and older profiles without a saved choice', () => {
  const db = openDatabase(':memory:')
  try {
    const settings = new SettingsRepo(db)
    expect(settings.getAll().preparationEnabled).toBe(false)
    settings.writeRaw('language', 'ar')
    expect(new SettingsRepo(db).getAll().preparationEnabled).toBe(false)
    expect(settings.readRaw('preparationEnabled')).toBeNull()
  } finally { db.close() }
})

it.each([true, false])('preserves explicitly saved preparation choice %s across repository recreation', choice => {
  const db = openDatabase(':memory:')
  try {
    const settings = new SettingsRepo(db)
    settings.set('preparationEnabled', choice)
    expect(new SettingsRepo(db).getAll().preparationEnabled).toBe(choice)
  } finally { db.close() }
})
