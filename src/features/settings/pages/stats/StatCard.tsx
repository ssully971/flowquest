import type { ReactNode } from 'react'

import type { StatCardToneKey } from './stat-card-palette'
import { STAT_CARD_TONES } from './stat-card-palette'

interface StatCardProps {
  label: string
  value: string
  tone: StatCardToneKey
  delta?: ReactNode
  hint?: string
}

/** Carte de stat colorée (dégradé vif + icône en haut à droite), voir stat-card-palette.ts.
 * Texte toujours blanc : chaque dégradé est choisi assez sombre à son point le plus clair
 * pour un contraste AA en blanc. */
export function StatCard({ label, value, tone, delta, hint }: StatCardProps) {
  const { icon: Icon, gradient } = STAT_CARD_TONES[tone]
  return (
    <div
      className="flex flex-col gap-1 overflow-hidden rounded-2xl px-5 py-4 text-white"
      style={{ background: gradient }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-white/85">{label}</span>
        <Icon size={18} strokeWidth={2} className="shrink-0 text-white/85" aria-hidden="true" />
      </div>
      <span className="text-2xl font-semibold">{value}</span>
      {delta}
      {hint ? <span className="text-[11px] text-white/75">{hint}</span> : null}
    </div>
  )
}
