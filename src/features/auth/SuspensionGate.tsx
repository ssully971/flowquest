import type { ReactNode } from 'react'

import { strings } from '@/shared/i18n'

import { useAuth } from './useAuth'

interface SuspensionGateProps {
  children: ReactNode
}

function formatUntil(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Écran « compte suspendu » (LOT I3, §2) : remplace entièrement l'app tant que
 * profile.suspended_until est dans le futur — is_banned() (0042_admin_users.sql) bloque
 * déjà toutes les RPC/politiques sociales côté serveur, cet écran évite seulement de
 * laisser l'utilisateur face à une interface qui semble fonctionner mais échoue
 * silencieusement partout. Une suspension expirée (date passée) ne bloque plus rien, sans
 * action manuelle requise : la comparaison se refait à chaque rendu.
 */
export function SuspensionGate({ children }: SuspensionGateProps) {
  const { status, profile } = useAuth()
  const suspendedUntil = profile?.suspended_until
  const isSuspended =
    status === 'authenticated' &&
    suspendedUntil !== null &&
    suspendedUntil !== undefined &&
    new Date(suspendedUntil) > new Date()

  if (!isSuspended) return <>{children}</>

  const s = strings.auth.suspended
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--bg)] p-6 text-center text-[var(--text)]">
      <p className="text-lg font-semibold">{s.title}</p>
      <p className="max-w-sm text-sm text-[var(--muted)]">{s.body}</p>
      <p className="text-sm text-[var(--muted)]">
        {s.until} {formatUntil(suspendedUntil as string)}
      </p>
      <a href="/" className="mt-2 text-sm text-[var(--accent)] underline-offset-2 hover:underline">
        {s.backHome}
      </a>
    </div>
  )
}
