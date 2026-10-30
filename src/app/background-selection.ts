import {
  LEGACY_PHOTO_ID,
  photoIdFromBackgroundId,
  toCustomBackgroundId,
} from '@/features/settings/custom-photos'
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
  if (typeof value !== 'string') return false
  // Photo de la bibliothèque personnelle (`custom:<id>`) ; l'ancien identifiant `custom` (fond
  // unique d'avant la bibliothèque) est converti par canonicalBackgroundId. Son existence réelle
  // n'est vérifiée qu'à l'affichage (la bibliothèque est asynchrone) : une photo supprimée donne le
  // fond du thème.
  return (BACKGROUND_IDS as string[]).includes(value) || photoIdFromBackgroundId(value) !== null
}

/** `custom` (ancien fond personnel unique) devient `custom:legacy`, la photo reprise dans la bibliothèque. */
function canonicalBackgroundId(value: unknown): unknown {
  return value === 'custom' ? toCustomBackgroundId(LEGACY_PHOTO_ID) : value
}

/**
 * Accepte aussi bien l'ancien format (un seul BackgroundId par mode, avant ce lot) que le
 * nouveau : un compte qui synchronisait déjà ses fonds doit retrouver exactement le même
 * fond dans les deux thèmes au premier chargement après la mise à jour, pas un retour
 * silencieux aux valeurs par défaut.
 */
export function normalizeBackgroundModeSelection(
  rawValue: unknown,
  fallback: BackgroundModeSelection,
): BackgroundModeSelection {
  const value = canonicalBackgroundId(rawValue)
  if (isBackgroundId(value)) return { dark: value, light: value, linked: true }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    return {
      dark: isBackgroundId(canonicalBackgroundId(record.dark))
        ? (canonicalBackgroundId(record.dark) as BackgroundId)
        : fallback.dark,
      light: isBackgroundId(canonicalBackgroundId(record.light))
        ? (canonicalBackgroundId(record.light) as BackgroundId)
        : fallback.light,
      linked: typeof record.linked === 'boolean' ? record.linked : fallback.linked,
    }
  }
  return fallback
}
