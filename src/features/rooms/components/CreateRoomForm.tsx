import { useState } from 'react'

import { Avatar } from '@/features/avatar/components/Avatar'
import type { Friend } from '@/features/friends/types'
import { strings } from '@/shared/i18n'

import { ROOM_MAX_INVITEES, ROOM_MAX_FOCUS_MINUTES, ROOM_MIN_FOCUS_MINUTES } from '../types'

interface CreateRoomFormProps {
  friends: Friend[]
  friendsLoading?: boolean
  onCreate: (focusMinutes: number, friendIds: string[]) => Promise<string | null>
  onCreated: (roomId: string) => void
}

const DURATION_PRESETS = [15, 25, 45, 60]

export function CreateRoomForm({ friends, friendsLoading, onCreate, onCreated }: CreateRoomFormProps) {
  const s = strings.rooms.create
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [selected, setSelected] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)

  const toggleFriend = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= ROOM_MAX_INVITEES) return prev
      return [...prev, id]
    })
  }

  const handleSubmit = async () => {
    setIsCreating(true)
    const roomId = await onCreate(focusMinutes, selected)
    setIsCreating(false)
    if (roomId) onCreated(roomId)
  }

  const atMax = selected.length >= ROOM_MAX_INVITEES

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-[var(--text)]">{s.durationLabel}</span>
        <div className="inline-flex w-fit flex-wrap items-center gap-1 rounded-full border border-[var(--line)] p-1">
          {DURATION_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => setFocusMinutes(minutes)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                focusMinutes === minutes ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--muted)]'
              }`}
            >
              {minutes} min
            </button>
          ))}
        </div>
        <input
          type="range"
          min={ROOM_MIN_FOCUS_MINUTES}
          max={ROOM_MAX_FOCUS_MINUTES}
          step={5}
          value={focusMinutes}
          aria-label={s.durationLabel}
          onChange={(event) => setFocusMinutes(Number(event.target.value))}
          className="w-full accent-[var(--accent)]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-[var(--text)]">{s.friendsLabel}</span>
        {friendsLoading ? (
          <p className="text-sm text-[var(--muted)]">{strings.rooms.loading}</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{s.noFriends}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((friend) => {
              const checked = selected.includes(friend.id)
              return (
                <li key={friend.id}>
                  <label
                    className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition-opacity duration-200 ${
                      checked ? 'border-[var(--accent)]' : 'border-[var(--line)]'
                    } ${!checked && atMax ? 'opacity-40' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && atMax}
                      onChange={() => toggleFriend(friend.id)}
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
                    <span className="truncate text-sm text-[var(--text)]">{friend.displayName || friend.username}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        {atMax ? <p className="text-xs text-[var(--muted)]">{s.maxReached}</p> : null}
      </div>

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={isCreating || selected.length === 0}
        className="h-11 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-40"
      >
        {isCreating ? s.creating : s.submit}
      </button>
    </div>
  )
}
