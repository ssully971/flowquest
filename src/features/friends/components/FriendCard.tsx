import { Flag, Flame, MoreVertical, UserMinus, UserX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Avatar } from '@/features/avatar/components/Avatar'
import { strings } from '@/shared/i18n'
import type { CheerEmoji } from '@/shared/supabase/database.types'

import { formatElapsedMinutes, liveStateColor } from '../live-status-format'
import type { DuoStreak, Friend } from '../types'
import { CheerPicker } from './CheerPicker'

interface FriendCardProps {
  friend: Friend
  streak?: DuoStreak | null
  onRemove: (otherUserId: string) => void
  onBlock: (otherUserId: string) => void
  onReport: (friend: Friend) => void
  onCheer: (otherUserId: string, emoji: CheerEmoji) => void
}

export function FriendCard({ friend, streak, onRemove, onBlock, onReport, onCheer }: FriendCardProps) {
  const s = strings.friends
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const handleRemove = () => {
    setMenuOpen(false)
    if (window.confirm(s.confirmRemove)) onRemove(friend.id)
  }
  const handleBlock = () => {
    setMenuOpen(false)
    if (window.confirm(s.confirmBlock)) onBlock(friend.id)
  }
  const handleReport = () => {
    setMenuOpen(false)
    onReport(friend)
  }

  const live = friend.live
  const statusLabel =
    live.isOnline && live.state && live.state !== 'inactive'
      ? `${live.state === 'focus' ? s.live.focusSince : s.live.pauseSince}${
          live.startedAt ? ` ${formatElapsedMinutes(live.startedAt)} ${s.live.minutes}` : ''
        }`
      : undefined

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
      <Avatar
        userId={friend.id}
        username={friend.username}
        displayName={friend.displayName}
        avatarUrl={friend.avatarUrl}
        avatarVersion={friend.avatarVersion}
        statusDotColor={live.isOnline && live.state ? liveStateColor(live.state) : undefined}
        statusLabel={statusLabel}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1 truncate text-sm font-medium text-[var(--text)]">
          <span className="truncate">{friend.displayName || friend.username}</span>
          {streak && streak.currentStreak > 0 ? (
            <span
              className={`inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold ${
                streak.activeToday ? 'text-[#F59E0B]' : 'text-[var(--muted)]'
              }`}
              title={`${s.duoStreak.title} : ${streak.currentStreak} — ${
                streak.activeToday ? s.duoStreak.doneToday : s.duoStreak.pendingToday
              }`}
            >
              <Flame size={12} strokeWidth={2} aria-hidden="true" />
              {streak.currentStreak}
            </span>
          ) : null}
        </span>
        {statusLabel ? (
          <span className="truncate text-xs text-[var(--muted)]">{statusLabel}</span>
        ) : (
          <span className="truncate text-xs text-[var(--muted)]">@{friend.username}</span>
        )}
      </div>

      <CheerPicker onSend={(emoji) => onCheer(friend.id, emoji)} />

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={s.actions.more}
          aria-expanded={menuOpen}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition-colors duration-200 hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          <MoreVertical size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-10 mt-1 flex w-44 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleRemove}
              className="flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              <UserMinus size={15} strokeWidth={1.75} aria-hidden="true" />
              {s.actions.remove}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleBlock}
              className="flex items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              <UserX size={15} strokeWidth={1.75} aria-hidden="true" />
              {s.actions.block}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleReport}
              className="flex items-center gap-2 px-3 py-2 text-left text-sm text-[#E5484D] hover:bg-[var(--surface-2)]"
            >
              <Flag size={15} strokeWidth={1.75} aria-hidden="true" />
              {s.actions.report}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
