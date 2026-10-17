import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { DayFocus } from '@/features/stats/compute-stats'

import { FocusCalendar } from './FocusCalendar'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function buildEmptyDays(count: number, startDayStart: number): DayFocus[] {
  return Array.from({ length: count }, (_, i) => ({
    dayStart: startDayStart + i * DAY_MS,
    focusSeconds: 0,
    sessionsCount: 0,
    goalMet: false,
  }))
}

describe('FocusCalendar — calendrier de régularité façon GitHub (§9 du cahier des charges)', () => {
  it('affiche une cellule par jour fourni, avec sa durée dans le libellé', () => {
    const monday = Date.UTC(2026, 0, 12) // lundi 12 janvier 2026
    const days: DayFocus[] = [
      { dayStart: monday, focusSeconds: 1800, sessionsCount: 1, goalMet: false },
      { dayStart: monday + DAY_MS, focusSeconds: 7200, sessionsCount: 3, goalMet: true },
    ]
    render(<FocusCalendar days={days} dailyGoalMinutes={120} />)

    const mondayLabel = `${DAY_LABEL_FORMATTER.format(new Date(monday))} — 30 min`
    const tuesdayLabel = `${DAY_LABEL_FORMATTER.format(new Date(monday + DAY_MS))} — 2 h`
    expect(screen.getByRole('img', { name: mondayLabel })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: tuesdayLabel })).toBeInTheDocument()
  })

  it('indique « Aucune session » pour un jour sans focus', () => {
    const monday = Date.UTC(2026, 0, 12)
    render(
      <FocusCalendar
        days={[{ dayStart: monday, focusSeconds: 0, sessionsCount: 0, goalMet: false }]}
        dailyGoalMinutes={120}
      />,
    )
    expect(screen.getByRole('img', { name: /Aucune session/ })).toBeInTheDocument()
  })

  it('ne plante pas avec une fenêtre de plusieurs semaines, une cellule par jour', () => {
    const start = Date.UTC(2026, 0, 1)
    const days = buildEmptyDays(84, start)
    expect(() => render(<FocusCalendar days={days} dailyGoalMinutes={120} />)).not.toThrow()
    expect(screen.getAllByRole('img')).toHaveLength(84)
  })

  it('n’affiche rien pour une fenêtre vide', () => {
    render(<FocusCalendar days={[]} dailyGoalMinutes={120} />)
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })
})
