import { createContext, useContext } from 'react'

import type { QuotesSettings } from './quotes-settings'

export interface QuotesSettingsContextValue {
  settings: QuotesSettings
  setSettings: (settings: QuotesSettings) => void
}

export const QuotesSettingsContext = createContext<QuotesSettingsContextValue | null>(null)

export function useQuotesSettings(): QuotesSettingsContextValue {
  const context = useContext(QuotesSettingsContext)
  if (!context) {
    throw new Error('useQuotesSettings doit être utilisé à l’intérieur de QuotesSettingsProvider')
  }
  return context
}
