import { useState } from 'react'

import { colorForIdentity, initialsForIdentity } from '../avatar-colors'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
}

const DOT_SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
  xl: 'h-3.5 w-3.5',
}

interface AvatarProps {
  userId: string
  username: string
  displayName?: string | null
  avatarUrl?: string | null
  avatarVersion?: number
  size?: AvatarSize
  /** Couleur CSS du point de statut (vert « en focus », etc. — branché en LOT F2) ; absent
   * par défaut, aucun point affiché. */
  statusDotColor?: string
  statusLabel?: string
  className?: string
}

function buildAvatarSrc(avatarUrl: string | null | undefined, avatarVersion: number | undefined): string | null {
  if (!avatarUrl) return null
  const version = avatarVersion ?? 0
  const separator = avatarUrl.includes('?') ? '&' : '?'
  return `${avatarUrl}${separator}v=${version}`
}

/**
 * Composant unique réutilisé partout où un avatar apparaît (LOT F1, §1 du Mode Amis) :
 * photo si disponible, sinon initiales sur une couleur déduite de l'identifiant — jamais
 * de case vide. `onError` retombe sur les initiales si l'image ne charge pas (fichier
 * supprimé côté admin, URL périmée...) plutôt que de laisser une image cassée.
 */
export function Avatar({
  userId,
  username,
  displayName = null,
  avatarUrl = null,
  avatarVersion = 0,
  size = 'md',
  statusDotColor,
  statusLabel,
  className = '',
}: AvatarProps) {
  // Suit l'URL qui a échoué plutôt qu'un simple booléen : dès que avatarUrl/avatarVersion
  // change (nouvelle photo), `src` change aussi et ne correspond plus à `failedSrc` — la
  // photo réapparaît automatiquement, sans effet dédié pour « réinitialiser » l'état.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const src = buildAvatarSrc(avatarUrl, avatarVersion)
  const showImage = src !== null && src !== failedSrc
  const background = colorForIdentity(userId || username)
  const initials = initialsForIdentity(displayName, username)

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      {showImage ? (
        <img
          src={src}
          alt=""
          onError={() => setFailedSrc(src)}
          className={`rounded-full object-cover ${SIZE_CLASSES[size]}`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`flex items-center justify-center rounded-full font-semibold text-white ${SIZE_CLASSES[size]}`}
          style={{ backgroundColor: background }}
        >
          {initials}
        </span>
      )}
      {statusDotColor ? (
        <span
          role={statusLabel ? 'status' : undefined}
          aria-label={statusLabel}
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-[var(--surface)] ${DOT_SIZE_CLASSES[size]}`}
          style={{ backgroundColor: statusDotColor }}
        />
      ) : null}
    </span>
  )
}
