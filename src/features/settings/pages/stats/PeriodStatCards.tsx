import { percentChange, STATS_PERIODS } from '@/features/stats/compute-stats'
import type { PeriodComparison, StatsPeriod } from '@/features/stats/compute-stats'
import { formatFocusDuration } from '@/features/stats/format'
import { strings } from '@/shared/i18n'

import { CategoryChip } from '../CategoryChip'

interface PeriodStatCardsProps {
  period: StatsPeriod
  onPeriodChange: (period: StatsPeriod) => void
  stats: PeriodComparison | null
}

function StatDelta({ percent }: { percent: number | null }) {
  const s = strings.settings.stats
  if (percent === null) return null
  const rounded = Math.round(percent)
  if (rounded === 0) {
    return <span className="text-[11px] text-[var(--panel-muted)]">{s.noChange}</span>
  }
  return (
    <span className="text-[11px] text-[var(--panel-muted)]">
      {rounded > 0 ? '↑' : '↓'} {Math.abs(rounded)} % {s.vsPreviousPeriod}
    </span>
  )
}

function PeriodStatCard({
  label,
  value,
  percent,
}: {
  label: string
  value: string
  percent: number | null
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
      <span className="text-xs text-[var(--panel-muted)]">{label}</span>
      <span className="text-2xl font-semibold text-[var(--panel-text)]">{value}</span>
      <StatDelta percent={percent} />
    </div>
  )
}

export function PeriodStatCards({ period, onPeriodChange, stats }: PeriodStatCardsProps) {
  const s = strings.settings.stats
  if (!stats) return null
  const { current, previous } = stats

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-2 text-xs font-medium text-[var(--panel-muted)]">{s.period}</p>
        <div className="flex flex-wrap gap-2">
          {STATS_PERIODS.map((value) => (
            <CategoryChip
              key={value}
              label={s.periods[value]}
              active={value === period}
              onClick={() => onPeriodChange(value)}
            />
          ))}
        </div>
      </div>

      <div className="grid max-w-md grid-cols-2 gap-3">
        <PeriodStatCard
          label={s.focusTime}
          value={formatFocusDuration(current.focusSeconds)}
          percent={previous ? percentChange(current.focusSeconds, previous.focusSeconds) : null}
        />
        <PeriodStatCard
          label={s.sessionsCount}
          value={`${current.sessionsCount} ${current.sessionsCount === 1 ? s.session : s.sessions}`}
          percent={previous ? percentChange(current.sessionsCount, previous.sessionsCount) : null}
        />
        <PeriodStatCard
          label={s.pauseTime}
          value={formatFocusDuration(current.pauseSeconds)}
          percent={previous ? percentChange(current.pauseSeconds, previous.pauseSeconds) : null}
        />
        <PeriodStatCard
          label={s.tasksCompleted}
          value={`${current.tasksCompleted} ${current.tasksCompleted === 1 ? s.task : s.tasks}`}
          percent={previous ? percentChange(current.tasksCompleted, previous.tasksCompleted) : null}
        />
      </div>
    </div>
  )
}
