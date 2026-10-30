import { Music } from 'lucide-react'
import { useState } from 'react'

import { LOCKED_DIM_CLASS, LockedBadge } from '@/features/access/LockedBadge'
import { useFeatureAccess } from '@/features/access/useFeatureAccess'
import { strings } from '@/shared/i18n'

import type { UseAmbientSoundsResult } from '../useAmbientSounds'
import { AmbientSoundsPanel } from './AmbientSoundsPanel'

interface AmbientSoundsControlProps {
  sounds: UseAmbientSoundsResult
  /** Alignement du panneau par rapport au bouton : au bord (écran Ambiant, bouton en haut à droite)
   * ou centré (écran Focus, bouton au milieu de l'écran). */
  placement?: 'end' | 'center'
  /** `up` : le panneau s'ouvre au-dessus du bouton (bouton fixe en bas de l'écran Ambiant). */
  direction?: 'down' | 'up'
}

/**
 * Bouton « Sons d'ambiance » et son panneau, partagés par l'écran Ambiant et (si le réglage est
 * activé) l'écran Focus. Verrouillé pour un invité : cadenas, un clic ouvre la modale d'upsell et
 * jamais le mixeur.
 */
export function AmbientSoundsControl({
  sounds,
  placement = 'end',
  direction = 'down',
}: AmbientSoundsControlProps) {
  const { isLocked, requireAccount } = useFeatureAccess()
  const [isOpen, setIsOpen] = useState(false)
  const locked = isLocked('ambientSounds')

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={
          locked
            ? `${strings.ambient.soundsButton}${strings.access.lockedSuffix}`
            : strings.ambient.soundsButton
        }
        aria-expanded={locked ? undefined : isOpen}
        onClick={() => {
          if (requireAccount('ambientSounds')) setIsOpen((previous) => !previous)
        }}
        className={
          (sounds.activeIds.length > 0
            ? 'inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] transition-transform duration-200 hover:scale-105'
            : 'glass-pill inline-flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105') +
          (locked ? ` ${LOCKED_DIM_CLASS}` : '')
        }
      >
        <Music
          size={18}
          strokeWidth={1.75}
          aria-hidden="true"
          className={sounds.activeIds.length === 0 ? 'glass-pill-icon' : undefined}
        />
      </button>
      {locked ? <LockedBadge /> : null}
      {locked ? null : (
        <AmbientSoundsPanel
          open={isOpen}
          onClose={() => setIsOpen(false)}
          placement={placement}
          direction={direction}
          {...sounds}
        />
      )}
    </div>
  )
}
