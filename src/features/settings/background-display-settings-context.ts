import { createContext, useContext } from 'react'

import type { BackgroundDisplaySettings } from './background-display-settings'

export interface BackgroundDisplaySettingsContextValue {
  settings: BackgroundDisplaySettings
  setSettings: (settings: BackgroundDisplaySettings) => void
}

export const BackgroundDisplaySettingsContext =
  createContext<BackgroundDisplaySettingsContextValue | null>(null)

export function useBackgroundDisplaySettings(): BackgroundDisplaySettingsContextValue {
  const context = useContext(BackgroundDisplaySettingsContext)
  if (!context) {
    throw new Error(
      'useBackgroundDisplaySettings doit être utilisé à l’intérieur de BackgroundDisplaySettingsProvider',
    )
  }
  return context
}
