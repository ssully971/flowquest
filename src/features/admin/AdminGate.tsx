import { useAuth } from '@/features/auth/useAuth'
import { strings } from '@/shared/i18n'

import { AdminPage } from './AdminPage'

/**
 * Garde de route côté interface : un simple confort de navigation, jamais la barrière
 * de sécurité réelle (voir docs/SECURITE.md). La vérification qui compte est côté base
 * (RLS + is_admin(), security definer), déjà en place pour toute future table de
 * contenu réservée aux admins. profile.role est lisible ici en toute confiance : la
 * politique RLS profiles_select_own ne renvoie jamais que la ligne de l'utilisateur
 * connecté lui-même.
 */
export function AdminGate() {
  const { status, profile } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] text-sm text-[var(--muted)]">
        {strings.admin.loading}
      </div>
    )
  }

  if (status !== 'authenticated' || profile?.role !== 'admin') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--bg)] p-6 text-center text-[var(--text)]">
        <p className="text-sm text-[var(--muted)]">{strings.admin.denied}</p>
        <a href="/" className="text-sm text-[var(--accent)] underline-offset-2 hover:underline">
          {strings.admin.backHome}
        </a>
      </div>
    )
  }

  return <AdminPage />
}
