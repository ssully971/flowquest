import { Crown } from 'lucide-react'

import { Avatar } from '@/features/avatar/components/Avatar'
import { strings } from '@/shared/i18n'

import { participantLiveStatus } from '../group-status'
import type { ParticipantLiveStatus } from '../group-status'
import type { RoomClockView } from '../room-timer'
import type { RoomParticipant } from '../types'

const STATUS_COLOR: Record<ParticipantLiveStatus, string | undefined> = {
  focused: '#22C55E',
  paused: '#F59E0B',
  ready: '#22C55E',
  away: '#9CA3AF',
  invited: undefined,
  declined: undefined,
}

interface GroupParticipantsProps {
  participants: RoomParticipant[]
  view: RoomClockView | null
  currentUserId: string | null
  isHost: boolean
  onTransferHost: (userId: string) => void
  /** Une action du salon est en cours : « Nommer hôte » est désactivé le temps qu'elle aboutisse. */
  disabled?: boolean
}

/** Liste des participants avec leur statut en direct (concentré, en pause, parti...), mise
 * à jour par Realtime — remplace l’ancien écran de salon (RoomScreen, supprimé). */
export function GroupParticipants({
  participants,
  view,
  currentUserId,
  isHost,
  onTransferHost,
  disabled = false,
}: GroupParticipantsProps) {
  const s = strings.rooms.group
  return (
    <div className="flex w-full max-w-md flex-col gap-2 text-left">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {s.participants} · {participants.filter((p) => p.status === 'joined').length}
      </h3>
      <ul className="flex flex-col gap-2">
        {participants.map((participant) => {
          const live = participantLiveStatus(participant, view)
          const label = s.status[live]
          return (
            <li
              key={participant.userId}
              className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5"
            >
              <Avatar
                userId={participant.userId}
                username={participant.username}
                displayName={participant.displayName}
                avatarUrl={participant.avatarUrl}
                avatarVersion={participant.avatarVersion}
                size="sm"
                statusDotColor={STATUS_COLOR[live]}
                statusLabel={label}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1 truncate text-sm font-medium text-[var(--text)]">
                  {participant.displayName || participant.username}
                  {participant.userId === currentUserId ? (
                    <span className="text-xs font-normal text-[var(--muted)]">({s.you})</span>
                  ) : null}
                  {participant.role === 'host' ? (
                    <Crown
                      size={13}
                      strokeWidth={1.75}
                      className="shrink-0 text-[var(--accent)]"
                      aria-label={strings.rooms.screen.host}
                    />
                  ) : null}
                </span>
                <span className="truncate text-xs text-[var(--muted)]">{label}</span>
              </div>
              {isHost && participant.role !== 'host' && participant.status === 'joined' ? (
                <button
                  type="button"
                  onClick={() => onTransferHost(participant.userId)}
                  disabled={disabled}
                  className="shrink-0 disabled:cursor-wait disabled:opacity-60 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--text)]"
                >
                  {s.makeHost}
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
