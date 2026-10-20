import type { TallyIconSet } from '../tally-icon-set'
import { TALLY_EMOJI } from '../tally-icon-set'
import { CycleDots } from './CycleDots'

interface SessionTallyProps {
  total: number
  completed: number
  currentIsFocus: boolean
  iconSet: TallyIconSet
}

/**
 * Émojis couleur natifs (pas des icônes vectorielles monochromes) : une session non
 * faite est désaturée et assombrie (grayscale + luminosité réduite + opacité), une
 * session terminée retrouve sa couleur d'origine avec une petite transition.
 */
export function SessionTally({ total, completed, currentIsFocus, iconSet }: SessionTallyProps) {
  if (iconSet === 'dots') {
    return <CycleDots total={total} completed={completed} currentIsFocus={currentIsFocus} />
  }

  const emoji = TALLY_EMOJI[iconSet]

  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => {
        const isDone = index < completed
        const isCurrent = index === completed && currentIsFocus
        const active = isDone || isCurrent
        return (
          <span
            key={index}
            className="text-xl leading-none transition-[filter,opacity] duration-300 ease-out"
            style={{
              filter: active ? 'grayscale(0) brightness(1)' : 'grayscale(1) brightness(0.55)',
              opacity: active ? 1 : 0.45,
            }}
          >
            {emoji[index % emoji.length]}
          </span>
        )
      })}
    </div>
  )
}
