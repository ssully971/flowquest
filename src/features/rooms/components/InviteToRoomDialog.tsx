import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { useFriends } from '@/features/friends/useFriends'
import { GlassCard, ModalOverlay } from '@/shared/design-system'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import type { RoomState } from '../types'
import { FriendPicker } from './FriendPicker'

/** Un salon réunit au plus 6 personnes (hôte compris), comme à la création. */
export const ROOM_MAX_PARTICIPANTS = 6

interface InviteToRoomDialogProps {
  room: RoomState
  /** `true` pendant l'envoi (verrou anti-double-clic du salon). */
  busy: boolean
  /** Envoie les invitations ; renvoie `true` si elles sont parties. */
  onInvite: (friendIds: string[]) => Promise<boolean>
  onClose: () => void
}

/**
 * Inviter des amis dans un salon déjà ouvert (hôte seulement), sans le quitter ni le recréer. Même
 * sélecteur d'amis que la création ; les amis déjà dans le salon ou déjà invités sont grisés. L'envoi
 * donne un retour immédiat (bouton occupé, toast), avec message clair et Réessayer en cas d'échec
 * (géré par l'action du salon, voir useActiveRoom).
 */
export function InviteToRoomDialog({ room, busy, onInvite, onClose }: InviteToRoomDialogProps) {
  const s = strings.rooms.group
  const { friends, isLoading } = useFriends()
  const { showToast } = useToast()
  const [selected, setSelected] = useState<string[]>([])

  const occupied = room.participants.filter(
    (participant) => participant.status === 'joined' || participant.status === 'invited',
  )
  const freeSlots = Math.max(0, ROOM_MAX_PARTICIPANTS - occupied.length)
  const unavailable: Record<string, string> = {}
  for (const participant of occupied) {
    unavailable[participant.userId] =
      participant.status === 'joined' ? s.alreadyInRoom : s.alreadyInvited
  }
  const everyoneIsIn = friends.length > 0 && friends.every((friend) => unavailable[friend.id])

  const toggle = (friendId: string) =>
    setSelected((previous) =>
      previous.includes(friendId)
        ? previous.filter((id) => id !== friendId)
        : previous.length >= freeSlots
          ? previous
          : [...previous, friendId],
    )

  const handleSubmit = async () => {
    const ok = await onInvite(selected)
    if (!ok) return // l'échec est signalé (toast + Réessayer) par l'action du salon
    showToast({
      type: 'success',
      message: selected.length > 1 ? s.inviteSentMany : s.inviteSentOne,
    })
    onClose()
  }

  return (
    <ModalOverlay className="z-[76]" blur onBackdropClick={busy ? undefined : onClose}>
      <GlassCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-room-title"
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-[28px] p-6"
      >
        <h2 id="invite-room-title" className="text-sm font-semibold text-[var(--text)]">
          {s.inviteTitle}
        </h2>

        {freeSlots === 0 ? (
          <p role="status" className="text-sm text-[var(--muted)]">
            {s.roomFull}
          </p>
        ) : everyoneIsIn ? (
          <p role="status" className="text-sm text-[var(--muted)]">
            {s.everyoneAlreadyIn}
          </p>
        ) : (
          <FriendPicker
            friends={friends}
            loading={isLoading}
            selected={selected}
            onToggle={toggle}
            max={freeSlots}
            unavailable={unavailable}
            emptyText={strings.rooms.create.noFriends}
            maxReachedText={strings.rooms.create.maxReached}
          />
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-10 rounded-xl border border-[var(--line)] px-4 text-sm font-medium text-[var(--text)] disabled:opacity-50"
          >
            {s.inviteCancel}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || selected.length === 0}
            aria-busy={busy}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={14} strokeWidth={2} aria-hidden="true" className="animate-spin" />
                {s.pending.invite}
              </>
            ) : (
              s.inviteSubmit
            )}
          </button>
        </div>
      </GlassCard>
    </ModalOverlay>
  )
}
