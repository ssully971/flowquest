import { createContext, useContext } from 'react'

export type Appearance = 'dark' | 'light' | 'system'

export interface ThemeContextValue {
  appearance: Appearance
  setAppearance: (appearance: Appearance) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme doit être utilisé à l’intérieur de ThemeProvider')
  }
  return ctx
}
