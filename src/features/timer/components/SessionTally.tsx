import { Coffee, Flame, Heart, Leaf, Pill, Star, Stethoscope } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { TallyIconSet } from '../tally-icon-set'
import { CycleDots } from './CycleDots'

interface SessionTallyProps {
  total: number
  completed: number
  currentIsFocus: boolean
  iconSet: TallyIconSet
}

const ICONS: Record<Exclude<TallyIconSet, 'dots'>, LucideIcon> = {
  stars: Star,
  flames: Flame,
  leaves: Leaf,
  coffee: Coffee,
  stethoscope: Stethoscope,
  hearts: Heart,
  pills: Pill,
}

export function SessionTally({ total, completed, currentIsFocus, iconSet }: SessionTallyProps) {
  if (iconSet === 'dots') {
    return <CycleDots total={total} completed={completed} currentIsFocus={currentIsFocus} />
  }

  const Icon = ICONS[iconSet]

  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => {
        const isDone = index < completed
        const isCurrent = index === completed && currentIsFocus
        return (
          <Icon
            key={index}
            size={20}
            strokeWidth={1.75}
            fill={isDone ? 'currentColor' : 'none'}
            className={isDone || isCurrent ? 'text-[var(--accent)]' : 'text-[var(--line)]'}
          />
        )
      })}
    </div>
  )
}
