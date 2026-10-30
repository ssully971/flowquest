import { Lock } from 'lucide-react'

import { strings } from '@/shared/i18n'

import type { LockableFeature } from './feature-access'
import { useFeatureAccess } from './useFeatureAccess'

/** Encart cadenas qui remplace une section entière verrouillée (ex. Galaxie, Équilibre) :
 * le contenu n'est jamais monté, un clic ouvre la modale d'upsell. */
export function LockedBlock({ feature, title }: { feature: LockableFeature; title: string }) {
  const { requireAccount } = useFeatureAccess()
  return (
    <button
      type="button"
      onClick={() => requireAccount(feature)}
      aria-label={`${title}${strings.access.lockedSuffix}`}
      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4 text-left opacity-70 transition-opacity duration-200 hover:opacity-100"
    >
      <Lock size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--panel-text)]">{title}</span>
        <span className="text-xs text-[var(--panel-muted)]">{strings.access.lockedBlockHint}</span>
      </span>
    </button>
  )
}
