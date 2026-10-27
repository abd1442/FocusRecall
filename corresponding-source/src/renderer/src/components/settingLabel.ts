import { createContext, useContext } from 'react'
import { t } from '../i18n'

/** A Settings row supplies a translated fallback name to its reusable controls. */
export const SettingLabelContext = createContext<string | undefined>(undefined)

export function useSettingLabel(label?: string): string | undefined {
  const rowLabel = useContext(SettingLabelContext)
  return label ? t(label) : rowLabel
}
