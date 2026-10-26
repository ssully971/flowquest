import { useState } from 'react'
import type { KeyboardEvent } from 'react'

import { Avatar } from '@/features/avatar/components/Avatar'
import type { Friend } from '@/features/friends/types'
import { useEditableNumber } from '@/features/settings/pages/useEditableNumber'
import { strings } from '@/shared/i18n'

import { ROOM_MAX_INVITEES, ROOM_MAX_FOCUS_MINUTES, ROOM_MIN_FOCUS_MINUTES } from '../types'
import type { RoomMode } from '../types'

/** Réglages du salon choisis dans le formulaire (le pilier et les invités sont ajoutés par
 * l'appelant). Chrono : `focusMinutes` est ignoré. */
export interface RoomDraft {
  mode: RoomMode
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  sessionsBeforeLongBreak: number
}

interface CreateRoomFormProps {
  friends: Friend[]
  friendsLoading?: boolean
  /** Valeurs de départ des champs Pomodoro (réglages du minuteur personnel). */
  defaults?: Partial<RoomDraft>
  onCreate: (draft: RoomDraft, friendIds: string[]) => Promise<string | null>
  onCreated: (roomId: string) => void
}

const DURATION_PRESETS = [15, 25, 45, 60]
const MODES: RoomMode[] = ['pomodoro', 'countdown', 'stopwatch']

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function SmallNumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-[var(--text)]">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(clamp(Number(event.target.value) || min, min, max))}
        className="h-9 w-16 rounded-lg border border-[var(--line)] bg-transparent px-2 text-center text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </label>
  )
}

export function CreateRoomForm({ friends, friendsLoading, defaults, onCreate, onCreated }: CreateRoomFormProps) {
  const s = strings.rooms.create
  const [mode, setMode] = useState<RoomMode>(defaults?.mode ?? 'pomodoro')
  const [focusMinutes, setFocusMinutes] = useState(defaults?.focusMinutes ?? 25)
  const [shortBreakMinutes, setShortBreakMinutes] = useState(defaults?.shortBreakMinutes ?? 5)
  const [longBreakMinutes, setLongBreakMinutes] = useState(defaults?.longBreakMinutes ?? 15)
  const [sessionsBeforeLongBreak, setSessionsBeforeLongBreak] = useState(
    defaults?.sessionsBeforeLongBreak ?? 4,
  )
  const [selected, setSelected] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const { draft, error, onDraftChange, onCommit } = useEditableNumber(
    focusMinutes,
    ROOM_MIN_FOCUS_MINUTES,
    ROOM_MAX_FOCUS_MINUTES,
    setFocusMinutes,
  )

  const handleFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  const toggleFriend = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= ROOM_MAX_INVITEES) return prev
      return [...prev, id]
    })
  }

  const handleSubmit = async () => {
    setIsCreating(true)
    const roomId = await onCreate(
      { mode, focusMinutes, shortBreakMinutes, longBreakMinutes, sessionsBeforeLongBreak },
      selected,
    )
    setIsCreating(false)
    if (roomId) onCreated(roomId)
  }

  const atMax = selected.length >= ROOM_MAX_INVITEES

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-[var(--text)]">{s.modeLabel}</span>
        <div
          role="radiogroup"
          aria-label={s.modeLabel}
          className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--line)] p-1"
        >
          {MODES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                mode === value ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--muted)]'
              }`}
            >
              {strings.rooms.modes[value]}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]">{s.modeHints[mode]}</p>
      </div>

      {mode !== 'stopwatch' ? (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[var(--text)]">
            {mode === 'pomodoro' ? s.pomodoroFocusLabel : s.durationLabel}
          </span>
          <span aria-live="polite" className="text-sm font-semibold text-[var(--text)]">
            {focusMinutes} {s.minutesUnit}
          </span>
        </div>
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
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            aria-label={s.durationFieldLabel}
            aria-invalid={error ? 'true' : undefined}
            min={ROOM_MIN_FOCUS_MINUTES}
            max={ROOM_MAX_FOCUS_MINUTES}
            step={5}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onBlur={onCommit}
            onKeyDown={handleFieldKeyDown}
            className="h-9 w-16 rounded-lg border border-[var(--line)] bg-transparent px-2 text-center text-sm text-[var(--text)] outline-none transition-colors duration-200 [appearance:textfield] focus:border-[var(--accent)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-xs text-[var(--muted)]">{s.minutesUnit}</span>
        </div>
        {error ? (
          <p role="alert" className="text-xs text-[#E5484D]">
            {error}
          </p>
        ) : null}
      </div>
      ) : null}

      {mode === 'pomodoro' ? (
        <div className="flex flex-col gap-2">
          <SmallNumberField label={s.shortBreakLabel} value={shortBreakMinutes} min={1} max={30} onChange={setShortBreakMinutes} />
          <SmallNumberField label={s.longBreakLabel} value={longBreakMinutes} min={5} max={60} onChange={setLongBreakMinutes} />
          <SmallNumberField label={s.sessionsLabel} value={sessionsBeforeLongBreak} min={2} max={8} onChange={setSessionsBeforeLongBreak} />
        </div>
      ) : null}

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
