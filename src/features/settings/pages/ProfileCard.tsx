import { UserRound } from 'lucide-react'

import { useAuth } from '@/features/auth/useAuth'
import { Avatar } from '@/features/avatar/components/Avatar'
import { strings } from '@/shared/i18n'

interface ProfileCardProps {
  onOpenSocial: () => void
}

/**
 * Carte profil en haut du panneau Réglages (LOT H2, §1) : point d'entrée UNIQUE vers le
 * panneau social (amis, salons, classement) — remplace les boutons Amis/Salons qui
 * vivaient avant en bas à droite de l'accueil. La pastille de notifications non lues est
 * sur l'icône d'engrenage elle-même (AppShell), pas ici : cette carte n'est visible
 * qu'une fois Réglages déjà ouvert.
 */
export function ProfileCard({ onOpenSocial }: ProfileCardProps) {
  const { user, profile } = useAuth()
  const s = strings.social
  const displayName = profile?.display_name || profile?.username || s.guestLabel

  return (
    <button
      type="button"
      onClick={onOpenSocial}
      className="flex items-center gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-4 py-3 text-left transition-colors duration-200 hover:bg-[var(--panel-line)]"
    >
      {profile && user ? (
        <Avatar
          userId={user.id}
          username={profile.username}
          displayName={profile.display_name}
          avatarUrl={profile.avatar_url}
          avatarVersion={profile.avatar_version}
          size="md"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--panel-line)] text-[var(--panel-muted)]">
          <UserRound size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-[var(--panel-text)]">{displayName}</span>
        <span className="truncate text-xs text-[var(--panel-muted)]">{s.entryLabel}</span>
      </span>
    </button>
  )
}
