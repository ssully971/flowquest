import { useEffect, useState } from 'react'

import { strings } from '@/shared/i18n'

import { useAuth } from '../useAuth'

/** Au-delà, on propose « Réessayer » sans attendre la fin des tentatives automatiques. */
const SLOW_AFTER_MS = 8_000

/**
 * Chargement du profil (Réglages > Compte) : squelette plutôt qu'un simple texte, et, si le
 * serveur tarde (plus de 8 s), un message honnête avec « Réessayer » — jamais un chargement
 * infini sans issue.
 */
export function ProfileLoading() {
  const { retryLoadProfile } = useAuth()
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="flex max-w-sm flex-col gap-3" aria-busy="true">
      <div aria-hidden="true" className="flex animate-pulse items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-[var(--panel-line)]" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-3 w-2/3 rounded bg-[var(--panel-line)]" />
          <div className="h-3 w-1/3 rounded bg-[var(--panel-line)]" />
        </div>
      </div>
      <p role="status" className="text-sm text-[var(--panel-muted)]">
        {slow ? strings.auth.profile.stillLoading : strings.auth.profile.loading}
      </p>
      {slow ? (
        <button
          type="button"
          onClick={() => {
            setSlow(false)
            retryLoadProfile()
          }}
          className="h-10 w-fit rounded-xl border border-[var(--panel-line)] px-4 text-sm font-medium text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)]"
        >
          {strings.auth.profile.retry}
        </button>
      ) : null}
    </div>
  )
}
