import { useCallback, useState } from 'react'

import { BACKGROUND_IDS, useResolvedTheme } from '@/shared/design-system'
import type { BackgroundId } from '@/shared/design-system'

import type { AppMode } from './useAppMode'

const STORAGE_KEY = 'flowquest.backgrounds'

/**
 * Défauts pour un nouveau visiteur (aucune entrée dans flowquest.backgrounds) : Aurore en
 * thème sombre, Lueur en thème clair (dégradé photo proche du violet de marque existant,
 * cohérent avec --bg en thème clair). Ambiant garde son propre défaut (lot 3, paysage),
 * inchangé par ce choix. Un choix déjà fait (même égal à l'ancien défaut « Horizon ») n'est
 * jamais modifié : readStored() ne retombe sur ces valeurs que si la clé est absente.
 */
function getThemeDefaults(resolvedTheme: 'dark' | 'light'): Record<AppMode, BackgroundId> {
  const base: BackgroundId = resolvedTheme === 'dark' ? 'photo-aurore' : 'photo-lueur'
  return { home: base, focus: base, ambient: 'photo-fjord' }
}

function isBackgroundId(value: unknown): value is BackgroundId {
  return typeof value === 'string' && (BACKGROUND_IDS as string[]).includes(value)
}

function readStored(defaults: Record<AppMode, BackgroundId>): Record<AppMode, BackgroundId> {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return defaults
    const record = parsed as Record<string, unknown>
    return {
      home: isBackgroundId(record.home) ? record.home : defaults.home,
      focus: isBackgroundId(record.focus) ? record.focus : defaults.focus,
      ambient: isBackgroundId(record.ambient) ? record.ambient : defaults.ambient,
    }
  } catch {
    return defaults
  }
}

export interface UseBackgroundSettingsResult {
  selection: Record<AppMode, BackgroundId>
  setBackground: (mode: AppMode, id: BackgroundId) => void
}

export function useBackgroundSettings(): UseBackgroundSettingsResult {
  const resolvedTheme = useResolvedTheme()
  const [selection, setSelection] = useState<Record<AppMode, BackgroundId>>(() =>
    readStored(getThemeDefaults(resolvedTheme)),
  )

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
