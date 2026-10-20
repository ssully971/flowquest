import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { useDailyFocusHistory } from '@/features/stats/useDailyFocusHistory'
import { strings } from '@/shared/i18n'

import { CategoryChip } from '../CategoryChip'
import { getYearRange } from './calendar-year'
import { FocusCalendar } from './FocusCalendar'
import type { CalendarMetric } from './FocusCalendar'

interface CalendarSectionProps {
  dailyGoalMinutes: number
}

/** §9 : calendrier de régularité façon GitHub, navigable par année civile complète
 * (l'année en cours s'arrête au jour présent, jamais de jours futurs). */
export function CalendarSection({ dailyGoalMinutes }: CalendarSectionProps) {
  const s = strings.settings.stats
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [metric, setMetric] = useState<CalendarMetric>('hours')
  const { anchor, days: windowDays } = getYearRange(year)
  const days = useDailyFocusHistory(windowDays, dailyGoalMinutes, anchor)

  if (!days) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={s.calendarPreviousYear}
            onClick={() => setYear((current) => current - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--panel-line)] text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)]"
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <span className="w-12 text-center text-sm font-medium text-[var(--panel-text)]">{year}</span>
          <button
            type="button"
            aria-label={s.calendarNextYear}
            disabled={year >= currentYear}
            onClick={() => setYear((current) => current + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--panel-line)] text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="flex gap-2">
          <CategoryChip
            label={s.unitHours}
            active={metric === 'hours'}
            onClick={() => setMetric('hours')}
          />
          <CategoryChip
            label={s.unitSessions}
            active={metric === 'sessions'}
            onClick={() => setMetric('sessions')}
          />
        </div>
      </div>

      <FocusCalendar days={days} dailyGoalMinutes={dailyGoalMinutes} metric={metric} />
    </div>
  )
}
