import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Avatar } from '@/features/avatar/components/Avatar'
import { strings } from '@/shared/i18n'

import type { FriendRequest } from '../types'

interface FriendRequestsListProps {
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
  onAccept: (friendshipId: string) => void
  onDecline: (friendshipId: string) => void
  onCancel: (friendshipId: string) => void
}

function RequestRow({
  request,
  children,
}: {
  request: FriendRequest
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
      <Avatar
        userId={request.id}
        username={request.username}
        displayName={request.displayName}
        avatarUrl={request.avatarUrl}
        avatarVersion={request.avatarVersion}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-[var(--text)]">
          {request.displayName || request.username}
        </span>
        <span className="truncate text-xs text-[var(--muted)]">@{request.username}</span>
      </div>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  )
}

export function FriendRequestsList({ incoming, outgoing, onAccept, onDecline, onCancel }: FriendRequestsListProps) {
  const s = strings.friends

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[var(--muted)]">{s.requestsTitle.incoming}</p>
        {incoming.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{s.empty.incoming}</p>
        ) : (
          incoming.map((request) => (
            <RequestRow key={request.friendshipId} request={request}>
              <button
                type="button"
                onClick={() => onAccept(request.friendshipId)}
                aria-label={s.actions.accept}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]"
              >
                <Check size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDecline(request.friendshipId)}
                aria-label={s.actions.decline}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text)]"
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </RequestRow>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[var(--muted)]">{s.requestsTitle.outgoing}</p>
        {outgoing.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{s.empty.outgoing}</p>
        ) : (
          outgoing.map((request) => (
            <RequestRow key={request.friendshipId} request={request}>
              <button
                type="button"
                onClick={() => onCancel(request.friendshipId)}
                className="h-9 rounded-full border border-[var(--line)] px-3 text-xs font-medium text-[var(--text)]"
              >
                {s.actions.cancel}
              </button>
            </RequestRow>
          ))
        )}
      </div>
    </div>
  )
}
