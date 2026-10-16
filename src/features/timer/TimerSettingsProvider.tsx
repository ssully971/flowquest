import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { DEFAULT_TIMER_SETTINGS } from './timer-settings'
import type { TimerSettings } from './timer-settings'
import { TimerSettingsContext } from './timer-settings-context'

const STORAGE_KEY = 'flowquest.timerSettings'

function isTimerSettings(value: unknown): value is TimerSettings {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.focusMinutes === 'number' &&
    typeof v.shortBreakMinutes === 'number' &&
    typeof v.longBreakMinutes === 'number' &&
    typeof v.sessionsBeforeLongBreak === 'number' &&
    typeof v.autoStartNext === 'boolean'
  )
}

function readStored(): TimerSettings {
  if (typeof window === 'undefined') return DEFAULT_TIMER_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TIMER_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    return isTimerSettings(parsed)
      ? { ...DEFAULT_TIMER_SETTINGS, ...parsed }
      : DEFAULT_TIMER_SETTINGS
  } catch {
    return DEFAULT_TIMER_SETTINGS
  }
}

export function TimerSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<TimerSettings>(readStored)

  const setSettings = useCallback((next: TimerSettings) => {
    setSettingsState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage indisponible (navigation privée) : le choix ne survit pas au rechargement.
    }
  }, [])

  const value = useMemo(() => ({ settings, setSettings }), [settings, setSettings])

  return <TimerSettingsContext.Provider value={value}>{children}</TimerSettingsContext.Provider>
}
