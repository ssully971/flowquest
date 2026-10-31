import { Avatar } from '@/features/avatar/components/Avatar'
import { PillarTierBadge } from '@/features/pillars/components/PillarTierBadge'
import { formatPlanDuration } from '@/features/timer/session-goal'
import { strings } from '@/shared/i18n'

import type { Leaderboard, LeaderboardEntry } from '../types'

interface LeaderboardTabProps {
  leaderboard: Leaderboard | null
  isLoading: boolean
  loadError: string | null
  weekOffset: 0 | 1
  onWeekOffsetChange: (offset: 0 | 1) => void
  onRetry: () => void
  /** Meilleur niveau de pilier par utilisateur (titre et badge) ; absent = pas de badge. */
  pillarLevels?: ReadonlyMap<string, number>
}

function encouragementMessage(self: LeaderboardEntry | undefined): string {
  const s = strings.friends.leaderboard.messages
  if (!self) return s.encourage
  if (self.rank === 1) return s.first
  if (self.rank <= 3) return s.top3
  if (self.score >= 50) return s.good
  return s.encourage
}

export function LeaderboardTab({
  leaderboard,
  isLoading,
  loadError,
  weekOffset,
  onWeekOffsetChange,
  onRetry,
  pillarLevels,
}: LeaderboardTabProps) {
  const s = strings.friends.leaderboard

  const entries = leaderboard?.entries ?? []
  const topScore = Math.max(1, ...entries.map((entry) => entry.score))
  const self = entries.find((entry) => entry.isSelf)

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--line)] p-1">
        <button
          type="button"
          onClick={() => onWeekOffsetChange(0)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
            weekOffset === 0 ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--muted)]'
          }`}
        >
          {s.thisWeek}
        </button>
        <button
          type="button"
          onClick={() => onWeekOffsetChange(1)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
            weekOffset === 1 ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--muted)]'
          }`}
        >
          {s.lastWeek}
        </button>
      </div>

      {isLoading && !leaderboard ? (
        <p className="text-sm text-[var(--muted)]">{s.loading}</p>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-[var(--muted)]">
            {s.loadError}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="h-9 rounded-xl border border-[var(--line)] px-3.5 text-xs font-medium text-[var(--text)]"
          >
            {s.retry}
          </button>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{s.empty}</p>
      ) : (
        <>
          {self ? (
            <div className="rounded-2xl border border-[var(--accent)] bg-[var(--surface)] px-4 py-3">
              <p className="text-xs font-medium text-[var(--muted)]">{s.myPosition}</p>
              <p className="text-sm text-[var(--text)]">{encouragementMessage(self)}</p>
            </div>
          ) : null}

          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
                  entry.isSelf
                    ? 'border-[var(--accent)] bg-[var(--surface)]'
                    : 'border-[var(--line)] bg-[var(--surface)]'
                }`}
              >
                <span className="w-5 shrink-0 text-center text-sm font-semibold text-[var(--muted)]">
                  {entry.rank}
                </span>
                <Avatar
                  userId={entry.id}
                  username={entry.username}
                  displayName={entry.displayName}
                  avatarUrl={entry.avatarUrl}
                  avatarVersion={entry.avatarVersion}
                  size="sm"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium text-[var(--text)]">
                    <span className="truncate">
                      {entry.isSelf ? s.you : entry.displayName || entry.username}
                    </span>
                    {pillarLevels?.get(entry.id) ? (
                      <PillarTierBadge level={pillarLevels.get(entry.id) ?? 1} />
                    ) : null}
                  </span>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${Math.max(2, (entry.score / topScore) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end text-xs text-[var(--muted)]">
                  <span className="font-semibold text-[var(--text)]">{entry.score}</span>
                  <span>{formatPlanDuration(entry.focusSeconds * 1000)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
