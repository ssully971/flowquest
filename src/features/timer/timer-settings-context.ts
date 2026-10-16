import { createContext, useContext } from 'react'

import type { TimerSettings } from './timer-settings'

export interface TimerSettingsContextValue {
  settings: TimerSettings
  setSettings: (settings: TimerSettings) => void
}

export const TimerSettingsContext = createContext<TimerSettingsContextValue | null>(null)

export function useTimerSettings(): TimerSettingsContextValue {
  const context = useContext(TimerSettingsContext)
  if (!context) {
    throw new Error('useTimerSettings doit être utilisé à l’intérieur de TimerSettingsProvider')
  }
  return context
}
