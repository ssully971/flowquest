import { useState } from 'react'

import type { DayFocus } from '@/features/stats/compute-stats'
import { formatFocusDuration } from '@/features/stats/format'
import { strings } from '@/shared/i18n'

import { CategoryChip } from '../CategoryChip'

interface FocusTrendProps {
  days7: DayFocus[]
  days30: DayFocus[]
}

type TrendRange = '7' | '30'

const SHORT_DAY_FORMATTER = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

function barLabel(day: DayFocus, range: TrendRange): string {
  const formatter = range === '7' ? SHORT_DAY_FORMATTER : SHORT_DATE_FORMATTER
  return formatter.format(new Date(day.dayStart))
}

export function FocusTrend({ days7, days30 }: FocusTrendProps) {
  const s = strings.settings.stats
  const [range, setRange] = useState<TrendRange>('7')
  const days = range === '7' ? days7 : days30
  const maxSeconds = Math.max(1, ...days.map((day) => day.focusSeconds))

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--panel-muted)]">{s.trendTitle}</p>
        <div className="flex gap-2">
          <CategoryChip label={s.trend7d} active={range === '7'} onClick={() => setRange('7')} />
          <CategoryChip label={s.trend30d} active={range === '30'} onClick={() => setRange('30')} />
        </div>
      </div>

      <div className="flex max-w-md items-end gap-[3px]">
        {days.map((day, index) => {
          const heightPct = Math.max(4, (day.focusSeconds / maxSeconds) * 100)
          const label = `${barLabel(day, range)} : ${
            day.focusSeconds > 0 ? formatFocusDuration(day.focusSeconds) : s.calendarNoFocus
          }`
          const showLabel = range === '7' || index % 5 === 0 || index === days.length - 1

          return (
            <div key={day.dayStart} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-20 w-full items-end">
                <div
                  role="img"
                  aria-label={label}
                  title={label}
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${heightPct}%`,
                    background: 'var(--accent)',
                    opacity: day.goalMet ? 1 : 0.55,
                  }}
                />
              </div>
              {showLabel ? (
                <span className="text-[10px] text-[var(--panel-muted)]">
                  {barLabel(day, range)}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
