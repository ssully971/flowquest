import type { DayFocus } from '@/features/stats/compute-stats'
import { formatFocusDuration } from '@/features/stats/format'
import { strings } from '@/shared/i18n'

interface FocusCalendarProps {
  days: DayFocus[]
  dailyGoalMinutes: number
}

type IntensityLevel = 0 | 1 | 2 | 3 | 4

const LEVEL_OPACITY: Record<IntensityLevel, number> = {
  0: 1,
  1: 0.3,
  2: 0.55,
  3: 0.78,
  4: 1,
}

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

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

function intensityLevel(day: DayFocus, goalSeconds: number): IntensityLevel {
  if (day.focusSeconds <= 0) return 0
  if (goalSeconds <= 0) return 4
  const ratio = day.focusSeconds / goalSeconds
  if (ratio >= 1) return 4
  if (ratio >= 0.5) return 3
  if (ratio >= 0.25) return 2
  return 1
}

function dayLabel(day: DayFocus): string {
  const s = strings.settings.stats
  const duration = day.focusSeconds > 0 ? formatFocusDuration(day.focusSeconds) : s.calendarNoFocus
  return `${DAY_LABEL_FORMATTER.format(new Date(day.dayStart))} — ${duration}`
}

function CalendarCell({ day, goalSeconds }: { day: DayFocus; goalSeconds: number }) {
  const level = intensityLevel(day, goalSeconds)
  const label = dayLabel(day)
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className="h-3 w-3 shrink-0 rounded-sm"
      style={{
        background: level === 0 ? 'var(--panel-line)' : 'var(--accent)',
        opacity: LEVEL_OPACITY[level],
      }}
    />
  )
}

export function FocusCalendar({ days, dailyGoalMinutes }: FocusCalendarProps) {
  const s = strings.settings.stats
  const goalSeconds = dailyGoalMinutes * 60
  const weeks = groupIntoWeeks(days)

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[var(--panel-muted)]">{s.calendarTitle}</p>
      <div className="flex max-w-md gap-1 overflow-x-auto pb-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((day, dayIndex) =>
              day ? (
                <CalendarCell key={day.dayStart} day={day} goalSeconds={goalSeconds} />
              ) : (
                <div key={`empty-${weekIndex}-${dayIndex}`} className="h-3 w-3 shrink-0" />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
