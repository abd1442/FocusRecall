import type { FocusRecallApi } from '../core/api'

declare global {
  interface Window {
    api: FocusRecallApi
  }
}

export {}
