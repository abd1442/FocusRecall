import { expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './settings'
import { IPC_CHANNELS, IPC_EVENTS, validateIpcArgs } from './ipcValidation'
import { roleCanInvoke } from './desktopSecurity'

it('removes parked-thought commands, events, preferences and helper privileges', () => {
  for (const channel of ['capture:park', 'parked:list', 'parked:setDone']) {
    expect(IPC_CHANNELS).not.toContain(channel)
    expect(() => validateIpcArgs(channel, [])).toThrow('Unknown IPC channel')
    expect(roleCanInvoke('capture', channel, [])).toBe(false)
  }
  expect(IPC_EVENTS).not.toContain('parked:changed')
  expect(DEFAULT_SETTINGS).not.toHaveProperty('hotkeyPark')
  expect(DEFAULT_SETTINGS.captures).not.toHaveProperty('park')
  expect(() => validateIpcArgs('settings:set', ['hotkeyPark', 'F7'])).toThrow()
  expect(() => validateIpcArgs('capture:open', ['park'])).toThrow()
})

it('retains stuck notes and accepts old capture preferences without requiring data repair', () => {
  expect(() => validateIpcArgs('capture:open', ['stuck'])).not.toThrow()
  expect(() => validateIpcArgs('capture:mark', ['stuck', 'Review this paragraph'])).not.toThrow()
  expect(() => validateIpcArgs('settings:set', ['captures', {
    ...DEFAULT_SETTINGS.captures, park: true, stuck: false
  }])).not.toThrow()
})
