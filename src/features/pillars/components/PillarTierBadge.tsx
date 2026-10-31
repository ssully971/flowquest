import { Crown, Flame, Gem, Leaf, Sparkles, Sprout, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { strings } from '@/shared/i18n'

import { tierForLevel } from '../pillar-tiers'
import type { PillarTierId } from '../pillar-tiers'

const TIER_ICONS: Record<PillarTierId, LucideIcon> = {
  novice: Sprout,
  initie: Leaf,
  apprenti: Flame,
  adepte: Star,
  expert: Gem,
  maitre: Crown,
  legende: Sparkles,
}

interface PillarTierBadgeProps {
  level: number
  /** Affiche le titre à côté de l'icône (sinon icône seule, titre dans l'info-bulle). */
  showTitle?: boolean
  /** Couleurs du fond clair du panneau (--panel-*) ou de l'interface (--text/--muted). */
  tone?: 'panel' | 'app'
}

/** Badge de palier de pilier : icône par palier + titre (Novice… Légende). */
export function PillarTierBadge({ level, showTitle = true, tone = 'app' }: PillarTierBadgeProps) {
  const tier = tierForLevel(level)
  const Icon = TIER_ICONS[tier.id]
  const title = strings.pillars.tiers[tier.id]
  const label = strings.pillars.tierBadgeLabel(title, level)

  return (
    <span
      title={label}
      aria-label={showTitle ? undefined : label}
      className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${
        tone === 'panel' ? 'text-[var(--panel-muted)]' : 'text-[var(--muted)]'
      }`}
    >
      <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
      {showTitle ? <span>{title}</span> : null}
    </span>
  )
}
