import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { BackgroundDisplaySettingsContext } from './background-display-settings-context'
import { DEFAULT_BACKGROUND_DISPLAY_SETTINGS } from './background-display-settings'
import type { BackgroundDisplaySettings } from './background-display-settings'

// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const STORAGE_KEY = 'flowquest.backgroundDisplaySettings'

function isBackgroundDisplaySettings(value: unknown): value is BackgroundDisplaySettings {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.blurPercent === 'number' && v.blurPercent >= 0 && v.blurPercent <= 100
}

function readStored(): BackgroundDisplaySettings {
  if (typeof window === 'undefined') return DEFAULT_BACKGROUND_DISPLAY_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_BACKGROUND_DISPLAY_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    return isBackgroundDisplaySettings(parsed)
      ? { ...DEFAULT_BACKGROUND_DISPLAY_SETTINGS, ...parsed }
      : DEFAULT_BACKGROUND_DISPLAY_SETTINGS
  } catch {
    return DEFAULT_BACKGROUND_DISPLAY_SETTINGS
  }
}

export function BackgroundDisplaySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<BackgroundDisplaySettings>(readStored)

  const setSettings = useCallback((next: BackgroundDisplaySettings) => {
    setSettingsState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage indisponible (navigation privée) : le choix ne survit pas au rechargement.
    }
  }, [])

  const value = useMemo(() => ({ settings, setSettings }), [settings, setSettings])

  return (
    <BackgroundDisplaySettingsContext.Provider value={value}>
      {children}
    </BackgroundDisplaySettingsContext.Provider>
  )
}
