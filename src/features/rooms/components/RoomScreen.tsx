import { Crown, X } from 'lucide-react'
import { useState } from 'react'

import { Avatar } from '@/features/avatar/components/Avatar'
import { formatCountdown } from '@/features/timer/format'
import { formatPlanDuration } from '@/features/timer/session-goal'
import { GlassCard } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { computeRoomRemainingMs } from '../room-timer'
import { useActiveRoom } from '../useActiveRoom'

interface RoomScreenProps {
  roomId: string
  onClose: () => void
}

const PRESENCE_COLOR = { present: '#22C55E', away: '#9CA3AF' } as const

export function RoomScreen({ roomId, onClose }: RoomScreenProps) {
  const s = strings.rooms.screen
  const { room, isLoading, loadError, nowMs, isHost, start, pause, resume, end, leave, transfer } =
    useActiveRoom(roomId)
  const [isActing, setIsActing] = useState(false)

  const runAction = async (action: () => Promise<boolean>) => {
    setIsActing(true)
    await action()
    setIsActing(false)
  }

  const handleLeave = async () => {
    if (!window.confirm(s.confirmLeave)) return
    await runAction(leave)
    onClose()
  }

  const handleEnd = async () => {
    if (!window.confirm(s.confirmEnd)) return
    await runAction(end)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'var(--scrim)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      />
      <GlassCard
        role="dialog"
        aria-label={strings.rooms.panelTitle}
        className="relative z-10 flex w-full max-w-md flex-col gap-5 rounded-[28px] p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--text)]">{strings.rooms.panelTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.closeLabel}
            className="-m-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
          >
            <X size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {isLoading && !room ? (
          <p className="text-sm text-[var(--muted)]">{strings.rooms.loading}</p>
        ) : loadError && !room ? (
          <p role="alert" className="text-sm text-[var(--muted)]">
            {loadError}
          </p>
        ) : room ? (
          <>
            <div className="flex flex-col items-center gap-1 py-4">
              {room.status === 'lobby' ? (
                <>
                  <p className="text-4xl font-semibold text-[var(--text)]">{formatPlanDuration(room.focusMinutes * 60_000)}</p>
                  <p className="text-sm text-[var(--muted)]">{isHost ? s.lobbyHintHost : s.lobbyHint}</p>
                </>
              ) : room.status === 'ended' ? (
                <p className="text-2xl font-semibold text-[var(--text)]">{s.ended}</p>
              ) : (
                <p className="font-mono text-5xl font-semibold tabular-nums text-[var(--text)]">
                  {formatCountdown(computeRoomRemainingMs(room, nowMs))}
                </p>
              )}
            </div>

            {isHost && room.status !== 'ended' ? (
              <div className="flex items-center justify-center gap-2">
                {room.status === 'lobby' ? (
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => void runAction(start)}
                    className="h-11 rounded-xl bg-[var(--accent)] px-5 text-sm font-medium text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-40"
                  >
                    {s.start}
                  </button>
                ) : room.status === 'running' ? (
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => void runAction(pause)}
                    className="h-11 rounded-xl border border-[var(--line)] px-5 text-sm font-medium text-[var(--text)] transition-opacity duration-200 disabled:opacity-40"
                  >
                    {s.pause}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => void runAction(resume)}
                    className="h-11 rounded-xl bg-[var(--accent)] px-5 text-sm font-medium text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-40"
                  >
                    {s.resume}
                  </button>
                )}
                {room.status !== 'lobby' ? (
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => void handleEnd()}
                    className="h-11 rounded-xl border border-[var(--line)] px-5 text-sm font-medium text-[var(--text)] transition-opacity duration-200 disabled:opacity-40"
                  >
                    {s.end}
                  </button>
                ) : null}
              </div>
            ) : null}

            <ul className="flex flex-col gap-2">
              {room.participants.map((participant) => {
                const presence =
                  participant.status === 'joined' ? (participant.isPresent ? 'present' : 'away') : null
                const statusLabel =
                  participant.status === 'invited'
                    ? s.invited
                    : participant.status === 'declined'
                      ? s.declined
                      : presence === 'away'
                        ? s.away
                        : null
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
                      statusDotColor={presence ? PRESENCE_COLOR[presence] : undefined}
                      statusLabel={statusLabel ?? undefined}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-1 truncate text-sm font-medium text-[var(--text)]">
                        {participant.displayName || participant.username}
                        {participant.role === 'host' ? (
                          <Crown size={13} strokeWidth={1.75} className="shrink-0 text-[var(--accent)]" aria-label={s.host} />
                        ) : null}
                      </span>
                      {statusLabel ? <span className="truncate text-xs text-[var(--muted)]">{statusLabel}</span> : null}
                    </div>
                    {isHost && participant.role !== 'host' && participant.status === 'joined' ? (
                      <button
                        type="button"
                        onClick={() => void runAction(() => transfer(participant.userId))}
                        className="shrink-0 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--text)] transition-opacity duration-200"
                      >
                        {s.makeHost}
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>

            <button
              type="button"
              onClick={() => void handleLeave()}
              disabled={isActing}
              className="h-10 rounded-xl border border-[var(--line)] text-sm font-medium text-[var(--text)] transition-opacity duration-200 disabled:opacity-40"
            >
              {s.leave}
            </button>
          </>
        ) : null}
      </GlassCard>
    </div>
  )
}
