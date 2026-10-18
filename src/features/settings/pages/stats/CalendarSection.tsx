import { useState } from 'react'

import { useDailyFocusHistory } from '@/features/stats/useDailyFocusHistory'
import { strings } from '@/shared/i18n'

import { CategoryChip } from '../CategoryChip'
import { FocusCalendar } from './FocusCalendar'
import type { CalendarMetric } from './FocusCalendar'

type CalendarRange = '6months' | 'year'

const RANGE_DAYS: Record<CalendarRange, number> = {
  '6months': 182,
  year: 365,
}

interface CalendarSectionProps {
  dailyGoalMinutes: number
}

export function CalendarSection({ dailyGoalMinutes }: CalendarSectionProps) {
  const s = strings.settings.stats
  const [range, setRange] = useState<CalendarRange>('6months')
  const [metric, setMetric] = useState<CalendarMetric>('hours')
  const days = useDailyFocusHistory(RANGE_DAYS[range], dailyGoalMinutes)

  if (!days) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <CategoryChip
            label={s.calendar6Months}
            active={range === '6months'}
            onClick={() => setRange('6months')}
          />
          <CategoryChip label={s.calendarYear} active={range === 'year'} onClick={() => setRange('year')} />
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
