import { aggregateWeeklyFocus } from '@/features/stats/compute-stats'
import type { DayFocus } from '@/features/stats/compute-stats'
import { formatFocusDuration } from '@/features/stats/format'
import { strings } from '@/shared/i18n'

interface FocusTrendProps {
  days: DayFocus[]
  dailyGoalMinutes: number
}

const SHORT_DAY_FORMATTER = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

// Au-delà d'un mois, une barre par jour serait illisible (ex. un an = 365 barres) : on
// bascule alors sur une barre par semaine (lundi à dimanche, voir aggregateWeeklyFocus).
const WEEKLY_THRESHOLD_DAYS = 31

interface TrendPoint {
  key: number
  focusSeconds: number
  goalMet: boolean
  label: string
}

export function FocusTrend({ days, dailyGoalMinutes }: FocusTrendProps) {
  const s = strings.settings.stats
  const isWeekly = days.length > WEEKLY_THRESHOLD_DAYS

  const points: TrendPoint[] = isWeekly
    ? aggregateWeeklyFocus(days).map((week) => ({
        key: week.weekStart,
        focusSeconds: week.focusSeconds,
        // Pas de réglage « objectif hebdomadaire » dédié : on retient l'équivalent de
        // l'objectif quotidien sur 7 jours, cohérent avec le calendrier en heures.
        goalMet: week.focusSeconds >= dailyGoalMinutes * 60 * 7,
        label: SHORT_DATE_FORMATTER.format(new Date(week.weekStart)),
      }))
    : days.map((day) => ({
        key: day.dayStart,
        focusSeconds: day.focusSeconds,
        goalMet: day.goalMet,
        label: (days.length <= 7 ? SHORT_DAY_FORMATTER : SHORT_DATE_FORMATTER).format(
          new Date(day.dayStart),
        ),
      }))

  const maxSeconds = Math.max(1, ...points.map((point) => point.focusSeconds))
  const labelStride = Math.max(1, Math.ceil(points.length / 8))

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[var(--panel-muted)]">{s.trendTitle}</p>

      <div className="flex max-w-md items-end gap-[2px]">
        {points.map((point, index) => {
          const value =
            point.focusSeconds > 0 ? formatFocusDuration(point.focusSeconds) : s.calendarNoFocus
          const label = `${point.label} : ${value}`
          const heightPct = Math.max(4, (point.focusSeconds / maxSeconds) * 100)
          const showLabel =
            points.length <= 7 || index % labelStride === 0 || index === points.length - 1

          return (
            <div key={point.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-20 w-full items-end">
                <div
                  role="img"
                  aria-label={label}
                  title={label}
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${heightPct}%`,
                    background: 'var(--accent)',
                    opacity: point.goalMet ? 1 : 0.55,
                  }}
                />
              </div>
              {showLabel ? (
                <span className="text-[10px] text-[var(--panel-muted)]">{point.label}</span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
