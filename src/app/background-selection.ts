import { BACKGROUND_IDS } from '@/shared/design-system'
import type { BackgroundId } from '@/shared/design-system'

import type { AppMode } from './useAppMode'

/**
 * Un fond par thème (lot 3 bis, §3) : chaque mode a désormais un fond pour le thème sombre
 * et un pour le thème clair, plus `linked` qui dit si les deux pointent volontairement vers
 * le même fond (« Utiliser le même fond pour les deux thèmes »). Quand `linked` est vrai,
 * `dark` et `light` sont tenus égaux par les setters de useBackgroundSettings — jamais ici.
 */
export interface BackgroundModeSelection {
  dark: BackgroundId
  light: BackgroundId
  linked: boolean
}

export type BackgroundSelections = Record<AppMode, BackgroundModeSelection>

function isBackgroundId(value: unknown): value is BackgroundId {
  return typeof value === 'string' && (BACKGROUND_IDS as string[]).includes(value)
}

/**
 * Accepte aussi bien l'ancien format (un seul BackgroundId par mode, avant ce lot) que le
 * nouveau : un compte qui synchronisait déjà ses fonds doit retrouver exactement le même
 * fond dans les deux thèmes au premier chargement après la mise à jour, pas un retour
 * silencieux aux valeurs par défaut.
 */
export function normalizeBackgroundModeSelection(
  value: unknown,
  fallback: BackgroundModeSelection,
): BackgroundModeSelection {
  if (isBackgroundId(value)) return { dark: value, light: value, linked: true }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    return {
      dark: isBackgroundId(record.dark) ? record.dark : fallback.dark,
      light: isBackgroundId(record.light) ? record.light : fallback.light,
      linked: typeof record.linked === 'boolean' ? record.linked : fallback.linked,
    }
  }
  return fallback
}
