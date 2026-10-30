import { Lock } from 'lucide-react'

/** Petit cadenas posé dans le coin d'un élément verrouillé : le parent doit être
 * `relative`. Décoratif — le libellé accessible est porté par le bouton lui-même. */
export function LockedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-testid="locked-badge"
      className={`pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--text)' }}
    >
      <Lock size={9} strokeWidth={2.25} />
    </span>
  )
}

/** Classe d'atténuation commune aux éléments verrouillés (aucune couleur nouvelle). */
export const LOCKED_DIM_CLASS = 'opacity-60'
