import { percentChange, STATS_PERIODS } from '@/features/stats/compute-stats'
import type { FocusScoreComparison, PeriodComparison, StatsPeriod } from '@/features/stats/compute-stats'
import { formatFocusDuration } from '@/features/stats/format'
import { strings } from '@/shared/i18n'

import { CategoryChip } from '../CategoryChip'
import { StatCard } from './StatCard'
import type { StatCardToneKey } from './stat-card-palette'

interface PeriodStatCardsProps {
  period: StatsPeriod
  onPeriodChange: (period: StatsPeriod) => void
  stats: PeriodComparison | null
  focusScore: FocusScoreComparison | null
}

function StatDelta({ percent }: { percent: number | null }) {
  const s = strings.settings.stats
  if (percent === null) return null
  const rounded = Math.round(percent)
  if (rounded === 0) {
    return <span className="text-[11px] text-white/75">{s.noChange}</span>
  }
  return (
    <span className="text-[11px] text-white/75">
      {rounded > 0 ? '↑' : '↓'} {Math.abs(rounded)} % {s.vsPreviousPeriod}
    </span>
  )
}

function PeriodStatCard({
  label,
  value,
  percent,
  tone,
  hint,
}: {
  label: string
  value: string
  percent: number | null
  tone: StatCardToneKey
  hint?: string
}) {
  return <StatCard label={label} value={value} tone={tone} delta={<StatDelta percent={percent} />} hint={hint} />
}

export function PeriodStatCards({ period, onPeriodChange, stats, focusScore }: PeriodStatCardsProps) {
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
          tone="focusTime"
        />
        <PeriodStatCard
          label={s.sessionsCount}
          value={`${current.sessionsCount} ${current.sessionsCount === 1 ? s.session : s.sessions}`}
          percent={previous ? percentChange(current.sessionsCount, previous.sessionsCount) : null}
          tone="sessionsCount"
        />
        <PeriodStatCard
          label={s.pauseTime}
          value={formatFocusDuration(current.pauseSeconds)}
          percent={previous ? percentChange(current.pauseSeconds, previous.pauseSeconds) : null}
          tone="pauseTime"
        />
        <PeriodStatCard
          label={s.tasksCompleted}
          value={`${current.tasksCompleted} ${current.tasksCompleted === 1 ? s.task : s.tasks}`}
          percent={previous ? percentChange(current.tasksCompleted, previous.tasksCompleted) : null}
          tone="tasksCompleted"
        />
        {focusScore ? (
          <PeriodStatCard
            label={s.focusScore}
            value={`${focusScore.current.score} %`}
            percent={
              focusScore.previous
                ? percentChange(focusScore.current.score, focusScore.previous.score)
                : null
            }
            tone="focusScore"
            hint={s.focusScoreHint}
          />
        ) : null}
      </div>
    </div>
  )
}
