import { useState } from 'react'

import { strings } from '@/shared/i18n'

export interface UseEditableNumberResult {
  draft: string
  error: string | null
  onDraftChange: (value: string) => void
  onCommit: () => void
}

/**
 * Logique de saisie clavier directe partagée entre tous les réglages de durée
 * (NumericStepper, objectif quotidien de StatsPage) : validation à la sortie du champ ou
 * à Entrée, bornes minimum/maximum appliquées par ajustement (jamais de rejet silencieux),
 * message explicite en cas de valeur invalide, jamais de champ qui reste bloqué (toute
 * nouvelle frappe efface le message précédent).
 */
export function useEditableNumber(
  value: number,
  min: number,
  max: number,
  onChange: (value: number) => void,
): UseEditableNumberResult {
  const s = strings.settings.timer
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState<string | null>(null)
  const [lastValue, setLastValue] = useState(value)
  // Valeur que ce hook vient lui-même de pousser via onChange (ajustement de bornes
  // compris) : distingue un changement de `value` provoqué par notre propre commit d'un
  // changement externe (boutons −/+, un autre appareil...), pour ne jamais effacer le
  // message d'ajustement qu'on vient tout juste d'afficher.
  const [lastCommitted, setLastCommitted] = useState<number | null>(null)

  // Resynchronise le brouillon quand la valeur change de l'extérieur. Ajustement pendant
  // le rendu plutôt que dans un effet (pattern recommandé par React pour « dériver un
  // état d'une prop qui change ») : évite un rendu supplémentaire inutile.
  if (value !== lastValue) {
    setLastValue(value)
    if (lastCommitted !== value) {
      setDraft(String(value))
      setError(null)
    }
    setLastCommitted(null)
  }

  const onCommit = () => {
    const trimmed = draft.trim()
    const parsed = Number(trimmed)
    if (trimmed === '' || !Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      setError(s.invalidValue)
      setDraft(String(value))
      return
    }
    const clamped = Math.min(max, Math.max(min, parsed))
    setError(
      clamped !== parsed
        ? `${s.outOfRangePrefix}${min}${s.outOfRangeJoin}${max}${s.outOfRangeSuffix}`
        : null,
    )
    setDraft(String(clamped))
    if (clamped !== value) {
      setLastCommitted(clamped)
      onChange(clamped)
    }
  }

  const onDraftChange = (next: string) => {
    setDraft(next)
    if (error) setError(null)
  }

  return { draft, error, onDraftChange, onCommit }
}
