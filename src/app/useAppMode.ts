import { useCallback, useState } from 'react'

export type AppMode = 'home' | 'focus' | 'ambient'

const STORAGE_KEY = 'flowquest.mode'

function readStoredMode(): AppMode {
  if (typeof window === 'undefined') return 'home'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'home' || stored === 'focus' || stored === 'ambient' ? stored : 'home'
}

export function useAppMode(): [AppMode, (mode: AppMode) => void] {
  const [mode, setModeState] = useState<AppMode>(readStoredMode)

  const setMode = useCallback((next: AppMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Stockage indisponible (navigation privée) : le mode ne survit pas au rechargement.
    }
  }, [])

  return [mode, setMode]
}
