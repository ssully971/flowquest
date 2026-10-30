import { Loader2 } from 'lucide-react'

import { strings } from '@/shared/i18n'

import type { MyRoom } from '../types'

interface RoomCardProps {
  room: MyRoom
  onAccept: (roomId: string) => void
  onDecline: (roomId: string) => void
  onJoin: (roomId: string) => void
  /** Réponse en cours pour CE salon (bouton désactivé + spinner + libellé). */
  busy?: 'accept' | 'decline' | null
  /** Une réponse est en cours pour un salon quelconque : tous les boutons sont verrouillés. */
  locked?: boolean
}

export function RoomCard({
  room,
  onAccept,
  onDecline,
  onJoin,
  busy = null,
  locked = false,
}: RoomCardProps) {
  const s = strings.rooms
  const hostLabel = room.hostDisplayName || room.hostUsername

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-[var(--text)]">
            {hostLabel} {s.invitedBy}
          </span>
          <span className="text-xs text-[var(--muted)]">
            {s.modes[room.mode]}
            {room.focusMinutes !== null ? ` · ${room.focusMinutes} min` : ''} ·{' '}
            {room.participantCount} {s.participants} · {s.status[room.status]}
          </span>
        </div>
      </div>

      {room.myStatus === 'invited' ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAccept(room.roomId)}
            disabled={locked || busy !== null}
            aria-busy={busy === 'accept'}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] text-xs font-medium text-[var(--on-accent)] transition-opacity duration-200 disabled:cursor-wait disabled:opacity-60"
          >
            {busy === 'accept' ? (
              <Loader2 size={13} strokeWidth={2} aria-hidden="true" className="animate-spin" />
            ) : null}
            {busy === 'accept' ? s.accepting : s.accept}
          </button>
          <button
            type="button"
            onClick={() => onDecline(room.roomId)}
            disabled={locked || busy !== null}
            aria-busy={busy === 'decline'}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] text-xs font-medium text-[var(--text)] transition-opacity duration-200 disabled:cursor-wait disabled:opacity-60"
          >
            {busy === 'decline' ? (
              <Loader2 size={13} strokeWidth={2} aria-hidden="true" className="animate-spin" />
            ) : null}
            {busy === 'decline' ? s.declining : s.decline}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onJoin(room.roomId)}
          className="h-9 rounded-xl border border-[var(--line)] text-xs font-medium text-[var(--text)] transition-opacity duration-200"
        >
          {s.join}
        </button>
      )}
    </div>
  )
}
