import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { ClockSettingsContext } from './clock-settings-context'
import { CLOCK_STYLES, DEFAULT_CLOCK_SETTINGS } from './clock-settings'
import type { ClockSettings } from './clock-settings'

const STORAGE_KEY = 'flowquest.clockSettings'

function isClockSettings(value: unknown): value is ClockSettings {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.format === '12h' || v.format === '24h') &&
    (v.size === 'small' || v.size === 'normal' || v.size === 'huge') &&
    typeof v.showSeconds === 'boolean' &&
    typeof v.showGreeting === 'boolean' &&
    typeof v.flipClock === 'boolean' &&
    typeof v.style === 'string' &&
    (CLOCK_STYLES as readonly string[]).includes(v.style)
  )
}

function readStored(): ClockSettings {
  if (typeof window === 'undefined') return DEFAULT_CLOCK_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CLOCK_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    return isClockSettings(parsed)
      ? { ...DEFAULT_CLOCK_SETTINGS, ...parsed }
      : DEFAULT_CLOCK_SETTINGS
  } catch {
    return DEFAULT_CLOCK_SETTINGS
  }
}

export function ClockSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<ClockSettings>(readStored)

  const setSettings = useCallback((next: ClockSettings) => {
    setSettingsState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage indisponible (navigation privée) : le choix ne survit pas au rechargement.
    }
  }, [])

  const value = useMemo(() => ({ settings, setSettings }), [settings, setSettings])

  return <ClockSettingsContext.Provider value={value}>{children}</ClockSettingsContext.Provider>
}
