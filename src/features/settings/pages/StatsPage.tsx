import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import type { StatsPeriod } from '@/features/stats/compute-stats'
import {
  DAILY_GOAL_STEP_MINUTES,
  MAX_DAILY_GOAL_MINUTES,
  MIN_DAILY_GOAL_MINUTES,
} from '@/features/stats/useDailyGoal'
import { useDailyFocusHistory } from '@/features/stats/useDailyFocusHistory'
import { useDashboardStats } from '@/features/stats/useDashboardStats'
import { usePeriodStats } from '@/features/stats/usePeriodStats'
import { formatFocusDuration } from '@/features/stats/format'
import { strings } from '@/shared/i18n'

import { CalendarSection } from './stats/CalendarSection'
import { FocusTrend } from './stats/FocusTrend'
import { PeriodStatCards } from './stats/PeriodStatCards'

const TREND_DAYS = 30

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
      <span className="text-xs text-[var(--panel-muted)]">{label}</span>
      <span className="text-2xl font-semibold text-[var(--panel-text)]">{value}</span>
    </div>
  )
}

interface StatsPageProps {
  dailyGoalMinutes: number
  onDailyGoalChange: (minutes: number) => void
}

export function StatsPage({ dailyGoalMinutes, onDailyGoalChange }: StatsPageProps) {
  const stats = useDashboardStats(dailyGoalMinutes)
  const trendDays = useDailyFocusHistory(TREND_DAYS, dailyGoalMinutes)
  const [period, setPeriod] = useState<StatsPeriod>('week')
  const periodStats = usePeriodStats(period)
  const s = strings.settings.stats

  const hasAnyData =
    stats &&
    (stats.todayFocusSeconds > 0 || stats.weekFocusSeconds > 0 || stats.currentStreakDays > 0)

  return (
    <div className="flex flex-col gap-6">
      <h2
        className="text-[40px] font-extrabold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.title}
      </h2>

      <div className="flex max-w-md flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
        <span className="text-xs text-[var(--panel-muted)]">{s.dailyGoal}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={s.decreaseGoal}
            disabled={dailyGoalMinutes <= MIN_DAILY_GOAL_MINUTES}
            onClick={() => onDailyGoalChange(dailyGoalMinutes - DAILY_GOAL_STEP_MINUTES)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--panel-line)] text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-line)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
              style={{
                width: `${Math.min(100, ((stats?.todayFocusSeconds ?? 0) / (dailyGoalMinutes * 60)) * 100)}%`,
              }}
            />
          </div>
          <button
            type="button"
            aria-label={s.increaseGoal}
            disabled={dailyGoalMinutes >= MAX_DAILY_GOAL_MINUTES}
            onClick={() => onDailyGoalChange(dailyGoalMinutes + DAILY_GOAL_STEP_MINUTES)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--panel-line)] text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <span className="shrink-0 text-sm text-[var(--panel-text)]">
            {formatFocusDuration(stats?.todayFocusSeconds ?? 0)} / {dailyGoalMinutes} min
          </span>
        </div>
        <p className="text-xs text-[var(--panel-muted)]">{s.dailyGoalHint}</p>
      </div>

      {!hasAnyData ? (
        <p className="max-w-sm text-sm text-[var(--panel-muted)]">{s.empty}</p>
      ) : (
        <>
          <div className="grid max-w-md grid-cols-2 gap-3">
            <StatCard
              label={s.currentStreak}
              value={`${stats.currentStreakDays} ${stats.currentStreakDays === 1 ? s.day : s.days}`}
            />
            <StatCard
              label={s.longestStreak}
              value={`${stats.longestStreakDays} ${stats.longestStreakDays === 1 ? s.day : s.days}`}
            />
          </div>

          <PeriodStatCards period={period} onPeriodChange={setPeriod} stats={periodStats} />
        </>
      )}

      <CalendarSection dailyGoalMinutes={dailyGoalMinutes} />

      {trendDays ? (
        <FocusTrend days7={trendDays.slice(-7)} days30={trendDays.slice(-30)} />
      ) : null}
    </div>
  )
}
