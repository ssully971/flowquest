import type { DayFocus } from '@/features/stats/compute-stats'
import { formatFocusDuration } from '@/features/stats/format'
import { strings } from '@/shared/i18n'

// Couleur de la carte « Temps de focus » (stat-card-palette.ts), en teinte pleine : un
// dégradé ne se lirait pas sur une case de 16px, mais la cohérence de palette tient.
const ACTIVE_COLOR = '#7C3AED'

export type CalendarMetric = 'hours' | 'sessions'

interface FocusCalendarProps {
  days: DayFocus[]
  dailyGoalMinutes: number
  metric?: CalendarMetric
}

type IntensityLevel = 0 | 1 | 2 | 3 | 4

const LEVEL_OPACITY: Record<IntensityLevel, number> = {
  0: 1,
  1: 0.3,
  2: 0.55,
  3: 0.78,
  4: 1,
}

// Cases de 16px (au lieu de 12px) : assez grandes pour être distinguées au doigt sur
// tablette/mobile, tout en gardant une année entière (53 semaines) lisible avec un
// défilement horizontal raisonnable.
const CELL_PX = 16
const CELL_GAP_PX = 3

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('fr-FR', { month: 'short' })

function toMondayFirstWeekIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

function groupIntoWeeks(days: DayFocus[]): (DayFocus | null)[][] {
  if (days.length === 0) return []
  const leadingGap = toMondayFirstWeekIndex(new Date(days[0].dayStart))
  const padded: (DayFocus | null)[] = [...Array<null>(leadingGap).fill(null), ...days]
  const weeks: (DayFocus | null)[][] = []
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7))
  }
  return weeks
}

/** Un nom de mois au-dessus de la première colonne (semaine) où ce mois apparaît —
 * jamais répété d'une semaine à l'autre, comme sur un calendrier GitHub. */
function monthLabelsForWeeks(weeks: (DayFocus | null)[][]): (string | null)[] {
  let lastMonth = -1
  return weeks.map((week) => {
    const firstDay = week.find((day): day is DayFocus => day !== null)
    if (!firstDay) return null
    const date = new Date(firstDay.dayStart)
    const month = date.getMonth()
    if (month === lastMonth) return null
    lastMonth = month
    // Majuscule initiale : Intl.DateTimeFormat rend "janv." en minuscule.
    const label = MONTH_LABEL_FORMATTER.format(date)
    return label.charAt(0).toUpperCase() + label.slice(1)
  })
}

function hoursIntensityLevel(day: DayFocus, goalSeconds: number): IntensityLevel {
  if (day.focusSeconds <= 0) return 0
  if (goalSeconds <= 0) return 4
  const ratio = day.focusSeconds / goalSeconds
  if (ratio >= 1) return 4
  if (ratio >= 0.5) return 3
  if (ratio >= 0.25) return 2
  return 1
}

/** Pas d'objectif « nombre de sessions par jour » dans les réglages : le niveau est
 * relatif au maximum observé dans la fenêtre affichée, comme un calendrier GitHub. */
function sessionsIntensityLevel(day: DayFocus, maxSessionsCount: number): IntensityLevel {
  if (day.sessionsCount <= 0) return 0
  if (maxSessionsCount <= 0) return 0
  const ratio = day.sessionsCount / maxSessionsCount
  if (ratio >= 1) return 4
  if (ratio >= 0.66) return 3
  if (ratio >= 0.33) return 2
  return 1
}

function dayLabel(day: DayFocus, metric: CalendarMetric): string {
  const s = strings.settings.stats
  if (metric === 'sessions') {
    const unit = day.sessionsCount === 1 ? s.session : s.sessions
    const value = day.sessionsCount > 0 ? `${day.sessionsCount} ${unit}` : s.calendarNoFocus
    return `${DAY_LABEL_FORMATTER.format(new Date(day.dayStart))} — ${value}`
  }
  const duration = day.focusSeconds > 0 ? formatFocusDuration(day.focusSeconds) : s.calendarNoFocus
  return `${DAY_LABEL_FORMATTER.format(new Date(day.dayStart))} — ${duration}`
}

function levelStyle(level: IntensityLevel): { background: string; opacity: number } {
  return { background: level === 0 ? 'var(--panel-line)' : ACTIVE_COLOR, opacity: LEVEL_OPACITY[level] }
}

function CalendarCell({
  day,
  metric,
  goalSeconds,
  maxSessionsCount,
}: {
  day: DayFocus
  metric: CalendarMetric
  goalSeconds: number
  maxSessionsCount: number
}) {
  const level =
    metric === 'sessions'
      ? sessionsIntensityLevel(day, maxSessionsCount)
      : hoursIntensityLevel(day, goalSeconds)
  const label = dayLabel(day, metric)
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className="shrink-0 rounded-sm"
      style={{ width: CELL_PX, height: CELL_PX, ...levelStyle(level) }}
    />
  )
}

export function FocusCalendar({ days, dailyGoalMinutes, metric = 'hours' }: FocusCalendarProps) {
  const s = strings.settings.stats
  const goalSeconds = dailyGoalMinutes * 60
  const maxSessionsCount = Math.max(0, ...days.map((day) => day.sessionsCount))
  const weeks = groupIntoWeeks(days)
  const monthLabels = monthLabelsForWeeks(weeks)
  const weekdayLabels = [
    s.calendarWeekdayMon,
    s.calendarWeekdayTue,
    s.calendarWeekdayWed,
    s.calendarWeekdayThu,
    s.calendarWeekdayFri,
    s.calendarWeekdaySat,
    s.calendarWeekdaySun,
  ]

  if (weeks.length === 0) return null

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[var(--panel-muted)]">{s.calendarTitle}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* Étiquettes des jours de la semaine (L M M J V S D), alignées sur les lignes. */}
        <div className="flex shrink-0 flex-col pt-[22px]" style={{ gap: CELL_GAP_PX }}>
          {weekdayLabels.map((label, index) => (
            <span
              key={index}
              className="flex items-center justify-center text-[10px] leading-none text-[var(--panel-muted)]"
              style={{ width: CELL_PX, height: CELL_PX }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="flex flex-col" style={{ gap: CELL_GAP_PX }}>
          {/* Noms des mois, un par colonne où un nouveau mois commence. */}
          <div className="flex" style={{ gap: CELL_GAP_PX, height: 18 }}>
            {weeks.map((_, weekIndex) => (
              <span
                key={weekIndex}
                className="shrink-0 whitespace-nowrap text-[10px] leading-none text-[var(--panel-muted)]"
                style={{ width: CELL_PX }}
              >
                {monthLabels[weekIndex]}
              </span>
            ))}
          </div>

          <div className="flex" style={{ gap: CELL_GAP_PX }}>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col" style={{ gap: CELL_GAP_PX }}>
                {week.map((day, dayIndex) =>
                  day ? (
                    <CalendarCell
                      key={day.dayStart}
                      day={day}
                      metric={metric}
                      goalSeconds={goalSeconds}
                      maxSessionsCount={maxSessionsCount}
                    />
                  ) : (
                    <div
                      key={`empty-${weekIndex}-${dayIndex}`}
                      className="shrink-0"
                      style={{ width: CELL_PX, height: CELL_PX }}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Légende : du niveau 0 (aucune activité) au niveau 4 (objectif atteint ou dépassé). */}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--panel-muted)]">
        <span>{s.calendarLess}</span>
        {([0, 1, 2, 3, 4] as IntensityLevel[]).map((level) => (
          <div
            key={level}
            className="shrink-0 rounded-sm"
            style={{ width: CELL_PX, height: CELL_PX, ...levelStyle(level) }}
          />
        ))}
        <span>{s.calendarMore}</span>
      </div>
    </div>
  )
}
