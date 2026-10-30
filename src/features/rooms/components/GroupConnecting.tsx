import { Loader2 } from 'lucide-react'

import { strings } from '@/shared/i18n'

import type { MyRoom } from '../types'

interface GroupConnectingProps {
  /** Ce que `list_my_rooms` sait déjà du salon : de quoi afficher quelque chose tout de suite. */
  room: MyRoom
  /** Message d'échec du chargement (réseau, délai…), `null` pendant le chargement normal. */
  error: string | null
  onRetry: () => void
}

/**
 * Écran du salon pendant le chargement de son état complet : affiché aussitôt (au lieu de
 * l'horloge solo ou d'un écran vide), avec le mode, le statut et le nombre de participants
 * déjà connus de la liste, un squelette d'horloge — jamais une heure estimée, pour qu'elle
 * ne saute pas à l'arrivée de la vraie — et « Connexion au salon… ».
 */
export function GroupConnecting({ room, error, onRetry }: GroupConnectingProps) {
  const s = strings.rooms.group
  const phaseLabel =
    room.mode === 'pomodoro' && room.status !== 'lobby'
      ? ` · ${strings.rooms.phase[room.phase]}`
      : ''

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center"
      aria-busy={error === null}
    >
      <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
        {s.badge} · {strings.rooms.modes[room.mode]}
      </span>
      <span className="text-sm font-semibold text-[var(--text)]">
        {strings.rooms.status[room.status]}
        {phaseLabel} · {room.participantCount} {strings.rooms.participants}
      </span>

      <div
        aria-hidden="true"
        data-testid="group-clock-skeleton"
        className="flex animate-pulse items-center gap-3 font-mono text-[72px] font-bold leading-none tabular-nums text-[var(--muted)] opacity-40 sm:text-[96px]"
      >
        <span>--</span>
        <span>:</span>
        <span>--</span>
      </div>

      {error === null ? (
        <p role="status" className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" />
          {s.connecting}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p role="alert" className="max-w-xs text-sm text-[var(--text)]">
            {s.connectingError} {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="h-10 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--on-accent)] transition-opacity duration-200 hover:opacity-90"
          >
            {strings.rooms.retry}
          </button>
        </div>
      )}
    </div>
  )
}
