import { useDashboardStats } from '@/features/stats/useDashboardStats'
import { formatFocusDuration } from '@/features/stats/format'
import { strings } from '@/shared/i18n'

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
      <span className="text-xs text-[var(--panel-muted)]">{label}</span>
      <span className="text-2xl font-semibold text-[var(--panel-text)]">{value}</span>
    </div>
  )
}

export function StatsPage() {
  const stats = useDashboardStats()
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

      {!hasAnyData ? (
        <p className="max-w-sm text-sm text-[var(--panel-muted)]">{s.empty}</p>
      ) : (
        <div className="grid max-w-md grid-cols-2 gap-3">
          <StatCard label={s.today} value={formatFocusDuration(stats.todayFocusSeconds)} />
          <StatCard label={s.thisWeek} value={formatFocusDuration(stats.weekFocusSeconds)} />
          <StatCard
            label={s.currentStreak}
            value={`${stats.currentStreakDays} ${stats.currentStreakDays === 1 ? s.day : s.days}`}
          />
          <StatCard
            label={s.longestStreak}
            value={`${stats.longestStreakDays} ${stats.longestStreakDays === 1 ? s.day : s.days}`}
          />
          <div className="col-span-2 flex flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
            <span className="text-xs text-[var(--panel-muted)]">{s.dailyGoal}</span>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-line)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
                  style={{
                    width: `${Math.min(100, (stats.todayFocusSeconds / (stats.dailyGoalMinutes * 60)) * 100)}%`,
                  }}
                />
              </div>
              <span className="shrink-0 text-sm text-[var(--panel-text)]">
                {formatFocusDuration(stats.todayFocusSeconds)} / {stats.dailyGoalMinutes} min
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
