import { createContext, useContext } from 'react'

import type { ExtrasSettings } from './extras-settings'

export interface ExtrasSettingsContextValue {
  settings: ExtrasSettings
  setSettings: (settings: ExtrasSettings) => void
}

export const ExtrasSettingsContext = createContext<ExtrasSettingsContextValue | null>(null)

export function useExtrasSettings(): ExtrasSettingsContextValue {
  const context = useContext(ExtrasSettingsContext)
  if (!context) {
    throw new Error('useExtrasSettings doit être utilisé à l’intérieur de ExtrasSettingsProvider')
  }
  return context
}
