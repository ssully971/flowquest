import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { DEFAULT_QUOTES_SETTINGS } from './quotes-settings'
import type { QuotesSettings } from './quotes-settings'
import { QuotesSettingsContext } from './quotes-settings-context'

const STORAGE_KEY = 'flowquest.quotesSettings'

function isQuotesSettings(value: unknown): value is QuotesSettings {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.showOnHome === 'boolean' &&
    typeof v.showOnFocus === 'boolean' &&
    (v.rotation === 'daily' || v.rotation === 'everyLoad') &&
    (v.category === 'all' || v.category === 'medicine' || v.category === 'focus')
  )
}

function readStored(): QuotesSettings {
  if (typeof window === 'undefined') return DEFAULT_QUOTES_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_QUOTES_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    return isQuotesSettings(parsed)
      ? { ...DEFAULT_QUOTES_SETTINGS, ...parsed }
      : DEFAULT_QUOTES_SETTINGS
  } catch {
    return DEFAULT_QUOTES_SETTINGS
  }
}

export function QuotesSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<QuotesSettings>(readStored)

  const setSettings = useCallback((next: QuotesSettings) => {
    setSettingsState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage indisponible (navigation privée) : le choix ne survit pas au rechargement.
    }
  }, [])

  const value = useMemo(() => ({ settings, setSettings }), [settings, setSettings])

  return <QuotesSettingsContext.Provider value={value}>{children}</QuotesSettingsContext.Provider>
}
