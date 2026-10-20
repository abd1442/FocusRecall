import { showMessage } from '../components/appDialogs'
import { create } from 'zustand'
import { IDLE_STATE, type SessionState } from '@core/session'
import { DEFAULT_SETTINGS, type AppSettings, type SettingKey } from '@core/settings'

const api = window.api

/** Mirror of the session state owned by the main process. */
export const useSession = create<{ state: SessionState; loaded: boolean }>(() => ({
  state: IDLE_STATE,
  loaded: false
}))

api.on('session:changed', (state) => useSession.setState({ state, loaded: true }))
void api.invoke('session:get').then((state) => useSession.setState({ state, loaded: true }))

/** Run a session command and surface errors without crashing the UI. */
export async function sessionCommand<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn()
  } catch (err) {
    console.error(err)
    await showMessage(err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err))
    return undefined
  }
}

interface SettingsState {
  settings: AppSettings
  set: <K extends SettingKey>(key: K, value: AppSettings[K]) => Promise<void>
}

export const useSettings = create<SettingsState>(() => ({
  settings: DEFAULT_SETTINGS,
  set: async (key, value) => {
    try {
      const settings = await api.invoke('settings:set', key, value)
      useSettings.setState({ settings })
    } catch (err) {
      // Settings shows this beside the setting that was changed.
      window.dispatchEvent(new CustomEvent('tf-save-error', { detail: `Not saved: ${err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err)}` }))
    }
  }
}))

api.on('settings:changed', (settings) => useSettings.setState({ settings }))
void api.invoke('settings:getAll').then((settings) => useSettings.setState({ settings }))
