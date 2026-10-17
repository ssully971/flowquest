import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { DayFocus } from '@/features/stats/compute-stats'

import { FocusTrend } from './FocusTrend'

const DAY_MS = 24 * 60 * 60 * 1000

function buildDays(count: number, startDayStart: number): DayFocus[] {
  return Array.from({ length: count }, (_, i) => ({
    dayStart: startDayStart + i * DAY_MS,
    focusSeconds: i * 600,
    goalMet: i % 2 === 0,
  }))
}

describe('FocusTrend — tendance de focus sur 7 ou 30 jours (§9 du cahier des charges)', () => {
  const start = Date.UTC(2026, 0, 1)
  const days7 = buildDays(7, start)
  const days30 = buildDays(30, start)

  it('affiche 7 barres par défaut', () => {
    render(<FocusTrend days7={days7} days30={days30} />)
    expect(screen.getAllByRole('img')).toHaveLength(7)
  })

  it('bascule sur 30 barres au clic sur « 30 jours »', async () => {
    const user = userEvent.setup()
    render(<FocusTrend days7={days7} days30={days30} />)

    await user.click(screen.getByRole('button', { name: '30 jours' }))
    expect(screen.getAllByRole('img')).toHaveLength(30)
  })

  it('revient à 7 barres au clic sur « 7 jours »', async () => {
    const user = userEvent.setup()
    render(<FocusTrend days7={days7} days30={days30} />)

    await user.click(screen.getByRole('button', { name: '30 jours' }))
    await user.click(screen.getByRole('button', { name: '7 jours' }))
    expect(screen.getAllByRole('img')).toHaveLength(7)
  })

  it('ne plante pas quand aucun jour n’a de focus (hauteur minimale conservée)', () => {
    const emptyDays = buildDays(7, start).map((day) => ({ ...day, focusSeconds: 0 }))
    expect(() => render(<FocusTrend days7={emptyDays} days30={emptyDays} />)).not.toThrow()
  })
})
