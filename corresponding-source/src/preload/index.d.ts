import type { A14PomodoroApi } from '../core/api'

declare global {
  interface Window {
    api: A14PomodoroApi
  }
}

export {}
