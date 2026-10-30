import { Avatar } from '@/features/avatar/components/Avatar'
import type { Friend } from '@/features/friends/types'
import { strings } from '@/shared/i18n'

interface FriendPickerProps {
  friends: Friend[]
  loading?: boolean
  selected: string[]
  onToggle: (friendId: string) => void
  /** Nombre maximum d'amis sélectionnables (les autres cases se grisent). */
  max: number
  /** Amis qu'on ne peut pas (re)choisir, avec la raison affichée (ex. « Déjà dans le salon »). */
  unavailable?: Record<string, string>
  emptyText: string
  maxReachedText: string
}

/**
 * Sélecteur d'amis à cocher, partagé entre le formulaire de création d'un salon et l'invitation
 * après coup (InviteToRoomDialog) : même rendu, mêmes limites.
 */
export function FriendPicker({
  friends,
  loading,
  selected,
  onToggle,
  max,
  unavailable = {},
  emptyText,
  maxReachedText,
}: FriendPickerProps) {
  const atMax = selected.length >= max

  if (loading) return <p className="text-sm text-[var(--muted)]">{strings.rooms.loading}</p>
  if (friends.length === 0) return <p className="text-sm text-[var(--muted)]">{emptyText}</p>

  return (
    <>
      <ul className="flex flex-col gap-2">
        {friends.map((friend) => {
          const checked = selected.includes(friend.id)
          const blockedReason = unavailable[friend.id]
          const disabled = Boolean(blockedReason) || (!checked && atMax)
          return (
            <li key={friend.id}>
              <label
                className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition-opacity duration-200 ${
                  checked ? 'border-[var(--accent)]' : 'border-[var(--line)]'
                } ${disabled ? 'opacity-40' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(friend.id)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <Avatar
                  userId={friend.id}
                  username={friend.username}
                  displayName={friend.displayName}
                  avatarUrl={friend.avatarUrl}
                  avatarVersion={friend.avatarVersion}
                  size="sm"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">
                  {friend.displayName || friend.username}
                </span>
                {blockedReason ? (
                  <span className="shrink-0 text-xs text-[var(--muted)]">{blockedReason}</span>
                ) : null}
              </label>
            </li>
          )
        })}
      </ul>
      {atMax ? <p className="text-xs text-[var(--muted)]">{maxReachedText}</p> : null}
    </>
  )
}
