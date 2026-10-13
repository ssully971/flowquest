import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { ThemeContext } from './theme-context'
import type { Appearance } from './theme-context'

const STORAGE_KEY = 'flowquest.appearance'

function readStoredAppearance(): Appearance {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>(readStoredAppearance)

  useEffect(() => {
    const root = document.documentElement
    if (appearance === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', appearance)
    }
  }, [appearance])

  const setAppearance = useCallback((next: Appearance) => {
    setAppearanceState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Stockage indisponible (navigation privée) : la préférence ne survit pas au rechargement.
    }
  }, [])

  const value = useMemo(() => ({ appearance, setAppearance }), [appearance, setAppearance])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
