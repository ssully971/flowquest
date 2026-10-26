import { useCallback, useState } from 'react'

import { useResolvedTheme } from '@/shared/design-system'
import type { BackgroundId } from '@/shared/design-system'

import { normalizeBackgroundModeSelection } from './background-selection'
import type { BackgroundModeSelection, BackgroundSelections } from './background-selection'
import type { AppMode } from './useAppMode'

// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const STORAGE_KEY = 'flowquest.backgrounds'

/**
 * Défauts pour un nouveau visiteur (aucune entrée dans flowquest.backgrounds) : Aurore pour
 * le thème sombre, Lueur pour le thème clair (lot 3 bis, §3). Ambiant garde un seul fond
 * pour les deux thèmes (`linked: true`), inchangé par ce choix. Un choix déjà fait n'est
 * jamais modifié : readStored() ne retombe sur ces valeurs que si la clé est absente.
 */
const DEFAULTS: BackgroundSelections = {
  home: { dark: 'photo-aurore', light: 'photo-lueur', linked: false },
  focus: { dark: 'photo-aurore', light: 'photo-lueur', linked: false },
  ambient: { dark: 'photo-fjord', light: 'photo-fjord', linked: true },
}

function readStored(): BackgroundSelections {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS
    const record = parsed as Record<string, unknown>
    return {
      home: normalizeBackgroundModeSelection(record.home, DEFAULTS.home),
      focus: normalizeBackgroundModeSelection(record.focus, DEFAULTS.focus),
      ambient: normalizeBackgroundModeSelection(record.ambient, DEFAULTS.ambient),
    }
  } catch {
    return DEFAULTS
  }
}

function persist(selections: BackgroundSelections) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selections))
  } catch {
    // Stockage indisponible (navigation privée) : le choix ne survit pas au rechargement.
  }
}

export interface UseBackgroundSettingsResult {
  selections: BackgroundSelections
  resolvedTheme: 'dark' | 'light'
  /** Fond effectivement affiché pour ce mode, selon le thème actif. */
  resolve: (mode: AppMode) => BackgroundId
  setBackground: (mode: AppMode, theme: 'dark' | 'light', id: BackgroundId) => void
  setLinked: (mode: AppMode, linked: boolean) => void
  /** Même fond pour les deux thèmes d'un coup (ex. bouton « thème au hasard »). */
  setBackgroundBoth: (mode: AppMode, id: BackgroundId) => void
  /** Remplace tout le choix d'un mode d'un coup (ex. réception d'un réglage synchronisé). */
  replaceSelection: (mode: AppMode, selection: BackgroundModeSelection) => void
}

export function useBackgroundSettings(): UseBackgroundSettingsResult {
  const resolvedTheme = useResolvedTheme()
  const [selections, setSelections] = useState<BackgroundSelections>(readStored)

  const update = useCallback(
    (updater: (prev: BackgroundSelections) => BackgroundSelections) => {
      setSelections((prev) => {
        const next = updater(prev)
        persist(next)
        return next
      })
    },
    [],
  )

  const setBackground = useCallback(
    (mode: AppMode, theme: 'dark' | 'light', id: BackgroundId) => {
      update((prev) => {
        const current = prev[mode]
        const next: BackgroundModeSelection = current.linked
          ? { ...current, dark: id, light: id }
          : { ...current, [theme]: id }
        return { ...prev, [mode]: next }
      })
    },
    [update],
  )

  const setLinked = useCallback(
    (mode: AppMode, linked: boolean) => {
      update((prev) => {
        const current = prev[mode]
        // En activant le lien, le fond du thème actif gagne : l'autre s'aligne dessus
        // plutôt que de garder une valeur désormais invisible mais toujours « réglée ».
        const aligned = linked
          ? { dark: current[resolvedTheme], light: current[resolvedTheme] }
          : {}
        return { ...prev, [mode]: { ...current, ...aligned, linked } }
      })
    },
    [update, resolvedTheme],
  )

  const setBackgroundBoth = useCallback(
    (mode: AppMode, id: BackgroundId) => {
      update((prev) => ({ ...prev, [mode]: { dark: id, light: id, linked: true } }))
    },
    [update],
  )

  const replaceSelection = useCallback(
    (mode: AppMode, selection: BackgroundModeSelection) => {
      update((prev) => ({ ...prev, [mode]: selection }))
    },
    [update],
  )

  const resolve = useCallback(
    (mode: AppMode) => selections[mode][resolvedTheme],
    [selections, resolvedTheme],
  )

  return {
    selections,
    resolvedTheme,
    resolve,
    setBackground,
    setLinked,
    setBackgroundBoth,
    replaceSelection,
  }
}
