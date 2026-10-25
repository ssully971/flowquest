import { Lock } from 'lucide-react'

import { strings } from '@/shared/i18n'

/** Indicateur discret (LOT G2) : apparaît seulement pendant qu'une session de focus
 * tourne avec Deep Focus actif — jamais de bouton, purement informatif (pas de onClick).
 * Mêmes conditions que useDeepFocus côté logique, calculées par l'appelant. */
export function DeepFocusIndicator() {
  return (
    <span
      role="status"
      aria-label={strings.focus.deepFocus.indicatorLabel}
      title={strings.focus.deepFocus.indicatorLabel}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]"
    >
      <Lock size={12} strokeWidth={1.75} aria-hidden="true" />
      {strings.focus.deepFocus.indicatorLabel}
    </span>
  )
}
