import { createContext, useContext } from 'react'

import type { ClockSettings } from './clock-settings'

export interface ClockSettingsContextValue {
  settings: ClockSettings
  setSettings: (settings: ClockSettings) => void
}

export const ClockSettingsContext = createContext<ClockSettingsContextValue | null>(null)

export function useClockSettings(): ClockSettingsContextValue {
  const context = useContext(ClockSettingsContext)
  if (!context) {
    throw new Error('useClockSettings doit être utilisé à l’intérieur de ClockSettingsProvider')
  }
  return context
}
