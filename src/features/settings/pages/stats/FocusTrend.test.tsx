import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { DayFocus } from '@/features/stats/compute-stats'

import { FocusTrend } from './FocusTrend'

const DAY_MS = 24 * 60 * 60 * 1000

function buildDays(count: number, startDayStart: number): DayFocus[] {
  return Array.from({ length: count }, (_, i) => ({
    dayStart: startDayStart + i * DAY_MS,
    focusSeconds: i * 600,
    sessionsCount: i,
    goalMet: i % 2 === 0,
  }))
}

describe('FocusTrend — tendance de focus sur la période choisie (§9 du cahier des charges)', () => {
  const start = Date.UTC(2026, 0, 1)

  it('affiche une barre par jour sur une courte période (7 jours)', () => {
    render(<FocusTrend days={buildDays(7, start)} dailyGoalMinutes={120} />)
    expect(screen.getAllByRole('img')).toHaveLength(7)
  })

  it('affiche une barre par jour jusqu’à un mois (30 jours)', () => {
    render(<FocusTrend days={buildDays(30, start)} dailyGoalMinutes={120} />)
    expect(screen.getAllByRole('img')).toHaveLength(30)
  })

  it('regroupe en semaines au-delà d’un mois (ex. un an = 365 jours)', () => {
    render(<FocusTrend days={buildDays(365, start)} dailyGoalMinutes={120} />)
    const bars = screen.getAllByRole('img')
    // 365 jours regroupés par semaine (lundi-dimanche) : nettement moins de 365 barres.
    expect(bars.length).toBeGreaterThan(0)
    expect(bars.length).toBeLessThan(60)
  })

  it('ne plante pas quand aucun jour n’a de focus (hauteur minimale conservée)', () => {
    const emptyDays = buildDays(7, start).map((day) => ({ ...day, focusSeconds: 0 }))
    expect(() => render(<FocusTrend days={emptyDays} dailyGoalMinutes={120} />)).not.toThrow()
  })

  it('ne plante pas sur un historique vide', () => {
    expect(() => render(<FocusTrend days={[]} dailyGoalMinutes={120} />)).not.toThrow()
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })
})
