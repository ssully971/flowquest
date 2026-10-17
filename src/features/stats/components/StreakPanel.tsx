import { Flame, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { strings } from '@/shared/i18n'

import { getNextStreakMilestone } from '../compute-stats'
import type { DashboardStats } from '../compute-stats'
import { useDailyFocusHistory } from '../useDailyFocusHistory'

interface StreakPanelProps {
  open: boolean
  onClose: () => void
  stats: DashboardStats | null
}

export function StreakPanel({ open, onClose, stats }: StreakPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const week = useDailyFocusHistory(7, stats?.dailyGoalMinutes)

  useEffect(() => {
    if (!open) return

    const onPointerDownOutside = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDownOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDownOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const s = strings.streak
  const currentStreakDays = stats?.currentStreakDays ?? 0
  const longestStreakDays = stats?.longestStreakDays ?? 0
  const nextMilestone = getNextStreakMilestone(currentStreakDays)
  const daysToMilestone = nextMilestone - currentStreakDays
  const hasHistory = currentStreakDays > 0 || longestStreakDays > 0

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={s.title}
      className="absolute bottom-full left-0 z-40 mb-3 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_10px_24px_var(--glow)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">{s.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={s.close}
          className="rounded-full p-1 text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {!hasHistory ? (
        <p className="text-sm text-[var(--muted)]">{s.empty}</p>
      ) : (
        <>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-[var(--surface-2)] py-3">
              <Flame size={20} strokeWidth={1.75} className="text-[var(--accent)]" aria-hidden="true" />
              <span className="text-xl font-bold text-[var(--text)]">{currentStreakDays}</span>
              <span className="text-xs text-[var(--muted)]">{s.current}</span>
            </div>
            <div className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-[var(--surface-2)] py-3">
              <span className="text-xl font-bold text-[var(--text)]">{longestStreakDays}</span>
              <span className="text-xs text-[var(--muted)]">{s.record}</span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-[var(--muted)]">{s.thisWeek}</p>
            <div className="flex justify-between gap-1">
              {(week ?? []).map((day) => {
                const weekday = new Date(day.dayStart).getDay()
                return (
                  <span
                    key={day.dayStart}
                    title={new Date(day.dayStart).toLocaleDateString('fr-FR')}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                      day.goalMet
                        ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                        : 'bg-[var(--surface-2)] text-[var(--muted)]'
                    }`}
                  >
                    {s.weekdayLetters[weekday]}
                  </span>
                )
              })}
            </div>
          </div>

          <p className="text-xs text-[var(--muted)]">
            {s.nextMilestone} : {nextMilestone} {nextMilestone === 1 ? s.day : s.days}
            {daysToMilestone > 0
              ? ` (${s.nextMilestoneIn} ${daysToMilestone} ${daysToMilestone === 1 ? s.day : s.days})`
              : ''}
          </p>
        </>
      )}
    </div>
  )
}
