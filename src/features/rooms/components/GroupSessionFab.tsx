import { Users } from 'lucide-react'

import { strings } from '@/shared/i18n'

import { useActiveGroupRoom } from '../active-room-context'
import { formatCountdown, formatElapsed } from '@/features/timer/format'

interface GroupSessionFabProps {
  /** Ramène à l'horloge de groupe (écran Focus). */
  onReturn: () => void
}

/**
 * Petit bouton flottant « Session en cours » (LOT M3) : visible sur toutes les pages tant
 * qu'une session de groupe est active et que son horloge n'est pas à l'écran. Affiche le
 * temps restant (ou écoulé en Chrono) et le nombre de participants ; un seul toucher ramène
 * à l'horloge. En haut à droite, sous la zone de sécurité des iPad/iPhone : aucun autre
 * élément flottant n'y est posé (bandeaux centrés en haut, toasts et installation en bas).
 */
export function GroupSessionFab({ onReturn }: GroupSessionFabProps) {
  const { room, view } = useActiveGroupRoom()
  if (!room || !view) return null

  const s = strings.rooms.group
  const time =
    view.status === 'lobby'
      ? s.waiting
      : view.remainingMs !== null
        ? formatCountdown(view.remainingMs)
        : formatElapsed(view.elapsedMs)
  const joined = room.participants.filter((participant) => participant.status === 'joined').length

  return (
    <button
      type="button"
      onClick={onReturn}
      aria-label={`${s.fabAria} — ${time}, ${joined} ${s.fabParticipants}`}
      className="glass-pill fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[55] inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-xs font-medium"
      style={{ right: 'max(0.75rem, env(safe-area-inset-right))' }}
    >
      <Users size={14} strokeWidth={1.75} aria-hidden="true" className="glass-pill-icon" />
      <span className="font-mono tabular-nums">{time}</span>
      <span className="hidden sm:inline">
        · {joined} {s.fabParticipants}
      </span>
    </button>
  )
}
