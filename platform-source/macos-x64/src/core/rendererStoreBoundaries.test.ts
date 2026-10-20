import { afterEach, expect, it, vi } from 'vitest'

// Runtime imports keep renderer-only types outside the Node build project.
const blocksPath = '../renderer/src/store/blocks'
const schemaPath = '../renderer/src/store/logSchema'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
it.each(['#panel', '#reasons', '#capture'])('%s does not load or subscribe to main-window history and log schema', async hash => {
  vi.resetModules()
  const invoke = vi.fn(), on = vi.fn()
  vi.stubGlobal('window', { location: { hash }, api: { invoke, on } })
  const blocks = await import(blocksPath)
  await import(schemaPath)
  await blocks.useBlocks.getState().refresh()
  expect(invoke).not.toHaveBeenCalled()
  expect(on).not.toHaveBeenCalled()
})
it('the main window still loads and refreshes history and log schema', async () => {
  vi.resetModules()
  const callbacks = new Map<string, (v: unknown) => void>()
  const schema = { groups: [], fields: [] }
  const invoke = vi.fn(async (channel: string) => channel === 'log:schema' ? schema : [])
  const on = vi.fn((channel: string, callback: (v: unknown) => void) => callbacks.set(channel, callback))
  vi.stubGlobal('window', { location: { hash: '' }, api: { invoke, on } })
  const blocks = await import(blocksPath)
  const log = await import(schemaPath)
  await Promise.resolve()
  expect(invoke.mock.calls.map(c => c[0])).toEqual(['blocks:summaries', 'log:schema'])
  expect(log.useLogSchema.getState().loaded).toBe(true)
  callbacks.get('session:changed')?.({ stage: 'idle' })
  callbacks.get('study:changed')?.(null)
  await Promise.resolve()
  expect(invoke.mock.calls.filter(c => c[0] === 'blocks:summaries')).toHaveLength(3)
  expect(blocks.useBlocks.getState().loaded).toBe(true)
})
