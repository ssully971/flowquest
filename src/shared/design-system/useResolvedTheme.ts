import { useEffect, useState } from 'react'

import { useTheme } from './theme-context'

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Le réglage « Système » suit prefers-color-scheme, que ThemeProvider ne traduit qu'en
 * CSS (retrait de data-theme). Pour tout ce qui doit choisir entre deux images selon le
 * thème (voir Logo.tsx), il faut aussi ce résultat côté JS.
 */
export function useResolvedTheme(): 'dark' | 'light' {
  const { appearance } = useTheme()
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark)

  useEffect(() => {
    if (appearance !== 'system' || typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [appearance])

  if (appearance === 'system') return systemPrefersDark ? 'dark' : 'light'
  return appearance
}
