import { strings } from '@/shared/i18n'

import type { MyRoom } from '../types'

interface RoomCardProps {
  room: MyRoom
  onAccept: (roomId: string) => void
  onDecline: (roomId: string) => void
  onJoin: (roomId: string) => void
}

export function RoomCard({ room, onAccept, onDecline, onJoin }: RoomCardProps) {
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
            {room.focusMinutes} min · {room.participantCount} {s.participants} · {s.status[room.status]}
          </span>
        </div>
      </div>

      {room.myStatus === 'invited' ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAccept(room.roomId)}
            className="h-9 flex-1 rounded-xl bg-[var(--accent)] text-xs font-medium text-[var(--on-accent)] transition-opacity duration-200"
          >
            {s.accept}
          </button>
          <button
            type="button"
            onClick={() => onDecline(room.roomId)}
            className="h-9 flex-1 rounded-xl border border-[var(--line)] text-xs font-medium text-[var(--text)] transition-opacity duration-200"
          >
            {s.decline}
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
