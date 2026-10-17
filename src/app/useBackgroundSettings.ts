import { useCallback, useState } from 'react'

import { BACKGROUND_IDS } from '@/shared/design-system'
import type { BackgroundId } from '@/shared/design-system'

import type { AppMode } from './useAppMode'

const STORAGE_KEY = 'flowquest.backgrounds'
const DEFAULTS: Record<AppMode, BackgroundId> = {
  home: 'horizon',
  focus: 'horizon',
  ambient: 'horizon',
}

function isBackgroundId(value: unknown): value is BackgroundId {
  return typeof value === 'string' && (BACKGROUND_IDS as string[]).includes(value)
}

function readStored(): Record<AppMode, BackgroundId> {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS
    const record = parsed as Record<string, unknown>
    return {
      home: isBackgroundId(record.home) ? record.home : DEFAULTS.home,
      focus: isBackgroundId(record.focus) ? record.focus : DEFAULTS.focus,
      ambient: isBackgroundId(record.ambient) ? record.ambient : DEFAULTS.ambient,
    }
  } catch {
    return DEFAULTS
  }
}

export interface UseBackgroundSettingsResult {
  selection: Record<AppMode, BackgroundId>
  setBackground: (mode: AppMode, id: BackgroundId) => void
}

export function useBackgroundSettings(): UseBackgroundSettingsResult {
  const [selection, setSelection] = useState<Record<AppMode, BackgroundId>>(readStored)

  const setBackground = useCallback((mode: AppMode, id: BackgroundId) => {
    setSelection((prev) => {
      const next = { ...prev, [mode]: id }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Stockage indisponible (navigation privée) : le choix ne survit pas au rechargement.
      }
      return next
    })
  }, [])

  return { selection, setBackground }
}
