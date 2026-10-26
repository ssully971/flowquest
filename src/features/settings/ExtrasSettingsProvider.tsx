import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { DEFAULT_EXTRAS_SETTINGS } from './extras-settings'
import type { ExtrasSettings } from './extras-settings'
import { ExtrasSettingsContext } from './extras-settings-context'
import { SETTINGS_PAGE_IDS } from './page-id'
import { setPillarsEnabledRef } from './pillars-enabled-ref'

// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const STORAGE_KEY = 'flowquest.extrasSettings'

function isExtrasSettings(value: unknown): value is ExtrasSettings {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.displayName === 'string' &&
    typeof v.disableAnimatedThemes === 'boolean' &&
    typeof v.cleanMode === 'boolean' &&
    typeof v.preventSleep === 'boolean' &&
    typeof v.themeRandomizer === 'boolean' &&
    typeof v.defaultSettingsTab === 'string' &&
    (SETTINGS_PAGE_IDS as string[]).includes(v.defaultSettingsTab)
  )
}

function readStored(): ExtrasSettings {
  if (typeof window === 'undefined') return DEFAULT_EXTRAS_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_EXTRAS_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    return isExtrasSettings(parsed)
      ? { ...DEFAULT_EXTRAS_SETTINGS, ...parsed }
      : DEFAULT_EXTRAS_SETTINGS
  } catch {
    return DEFAULT_EXTRAS_SETTINGS
  }
}

export function ExtrasSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<ExtrasSettings>(readStored)

  useEffect(() => {
    setPillarsEnabledRef(settings.pillarsEnabled)
  }, [settings.pillarsEnabled])

  const setSettings = useCallback((next: ExtrasSettings) => {
    setSettingsState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage indisponible (navigation privée) : le choix ne survit pas au rechargement.
    }
  }, [])

  const value = useMemo(() => ({ settings, setSettings }), [settings, setSettings])

  return <ExtrasSettingsContext.Provider value={value}>{children}</ExtrasSettingsContext.Provider>
}
