import { Loader2, UserPlus, Users, X } from 'lucide-react'
import { useState } from 'react'

import { useActiveGroupRoom } from '@/features/rooms/active-room-context'
import { strings } from '@/shared/i18n'

import type { FriendRequest } from '../types'

const MAX_VISIBLE = 3

interface SocialInvitesBannerProps {
  /** Demandes d'ami entrantes (absentes hors de l'application : pages légales, admin...). */
  friendRequests?: FriendRequest[]
  onAcceptFriend?: (friendshipId: string) => void
  onDeclineFriend?: (friendshipId: string) => void
  /** Après avoir rejoint un salon : va à l'horloge de groupe. */
  onJoinedRoom: () => void
  /** Masquée tant que le panneau social (qui liste déjà les mêmes demandes) est ouvert. */
  suppressed?: boolean
}

type Notice =
  | { kind: 'room'; id: string; label: string; detail: string; roomId: string }
  | { kind: 'friend'; id: string; label: string; detail: string; friendshipId: string }

/**
 * Notifications d'invitation sur tout le site (LOT M4) : une invitation à un salon de focus
 * ou une demande d'ami entrante apparaît en bannière, où que je sois, avec « Rejoindre » /
 * « Refuser » (« Accepter » / « Refuser » pour une demande d'ami) — sans ouvrir le mode amis.
 * Dérivée en direct des listes serveur (Realtime déjà branché sur `useRooms`/`useFriends`) :
 * une invitation donnée n'apparaît donc qu'UNE fois (clé = identifiant du salon ou de la
 * demande), disparaît dès qu'on y répond (ici ou depuis le panneau) et la pastille de
 * non-lu de l'engrenage reste cohérente puisqu'elle lit les mêmes listes. « Masquer » écarte
 * la bannière sans répondre (la pastille, elle, reste jusqu'à la réponse).
 */
export function SocialInvitesBanner({
  friendRequests = [],
  onAcceptFriend,
  onDeclineFriend,
  onJoinedRoom,
  suppressed = false,
}: SocialInvitesBannerProps) {
  const { roomsState } = useActiveGroupRoom()
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const s = strings.rooms.invite

  const notices: Notice[] = [
    ...roomsState.rooms
      .filter((room) => room.myStatus === 'invited')
      .map((room): Notice => ({
        kind: 'room',
        id: `room:${room.roomId}`,
        roomId: room.roomId,
        label: room.hostDisplayName ?? room.hostUsername,
        detail:
          strings.rooms.modes[room.mode] +
          (room.focusMinutes !== null ? ` · ${room.focusMinutes} min` : ''),
      })),
    ...friendRequests.map((request): Notice => ({
      kind: 'friend',
      id: `friend:${request.friendshipId}`,
      friendshipId: request.friendshipId,
      label: request.displayName ?? request.username,
      detail: '',
    })),
  ].filter((notice) => !dismissed.has(notice.id))

  if (suppressed || notices.length === 0) return null

  const visible = notices.slice(0, MAX_VISIBLE)
  const hidden = notices.length - visible.length

  const dismiss = (id: string) => setDismissed((current) => new Set(current).add(id))

  const isResponding = (roomId: string, accept: boolean) =>
    roomsState.responding?.roomId === roomId && roomsState.responding.accept === accept

  const joinRoom = (roomId: string) => {
    void roomsState.respond(roomId, true).then((ok) => {
      if (ok) onJoinedRoom()
    })
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[72] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      {visible.map((notice) => {
        const Icon = notice.kind === 'room' ? Users : UserPlus
        return (
          <div
            key={notice.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm flex-col gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] shadow-[0_10px_24px_var(--glow)]"
          >
            <div className="flex items-start gap-3">
              <Icon
                size={18}
                strokeWidth={1.75}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[var(--accent)]"
              />
              <p className="min-w-0 flex-1">
                <span className="font-semibold">{notice.label}</span>{' '}
                {notice.kind === 'room' ? s.roomText : s.friendText}
                {notice.detail ? (
                  <span className="block text-xs text-[var(--muted)]">{notice.detail}</span>
                ) : null}
              </p>
              <button
                type="button"
                aria-label={s.dismiss}
                onClick={() => dismiss(notice.id)}
                className="-m-1 shrink-0 rounded-full p-1 text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
              >
                <X size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  notice.kind === 'room'
                    ? joinRoom(notice.roomId)
                    : onAcceptFriend?.(notice.friendshipId)
                }
                disabled={notice.kind === 'room' && Boolean(roomsState.responding)}
                aria-busy={notice.kind === 'room' && isResponding(notice.roomId, true)}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] text-xs font-medium text-[var(--on-accent)] disabled:cursor-wait disabled:opacity-60"
              >
                {notice.kind === 'room' && isResponding(notice.roomId, true) ? (
                  <Loader2 size={13} strokeWidth={2} aria-hidden="true" className="animate-spin" />
                ) : null}
                {notice.kind === 'room'
                  ? isResponding(notice.roomId, true)
                    ? strings.rooms.accepting
                    : s.join
                  : s.accept}
              </button>
              <button
                type="button"
                onClick={() =>
                  notice.kind === 'room'
                    ? void roomsState.respond(notice.roomId, false)
                    : onDeclineFriend?.(notice.friendshipId)
                }
                disabled={notice.kind === 'room' && Boolean(roomsState.responding)}
                className="h-9 flex-1 rounded-xl border border-[var(--line)] text-xs font-medium text-[var(--text)] disabled:cursor-wait disabled:opacity-60"
              >
                {notice.kind === 'room' && isResponding(notice.roomId, false)
                  ? strings.rooms.declining
                  : s.decline}
              </button>
            </div>
          </div>
        )
      })}
      {hidden > 0 ? (
        <p className="pointer-events-auto rounded-full bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)]">
          +{hidden} {s.more}
        </p>
      ) : null}
    </div>
  )
}
