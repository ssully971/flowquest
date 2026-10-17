import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { FocusScoreComparison, PeriodComparison } from '@/features/stats/compute-stats'

import { PeriodStatCards } from './PeriodStatCards'

function stats(overrides: Partial<PeriodComparison> = {}): PeriodComparison {
  return {
    current: { focusSeconds: 1500, sessionsCount: 1, pauseSeconds: 300, tasksCompleted: 2 },
    previous: { focusSeconds: 1000, sessionsCount: 1, pauseSeconds: 300, tasksCompleted: 1 },
    ...overrides,
  }
}

function focusScore(overrides: Partial<FocusScoreComparison> = {}): FocusScoreComparison {
  return {
    current: { score: 78, completionRate: 85, regularityRate: 92 },
    previous: { score: 60, completionRate: 70, regularityRate: 86 },
    ...overrides,
  }
}

describe('PeriodStatCards — cartes de la période choisie, comparées à la période précédente (lot 5)', () => {
  it('affiche les 5 cartes avec leur valeur', () => {
    render(
      <PeriodStatCards
        period="week"
        onPeriodChange={vi.fn()}
        stats={stats()}
        focusScore={focusScore()}
      />,
    )

    expect(screen.getByText('25 min')).toBeInTheDocument() // temps de focus (1500 s)
    expect(screen.getByText('1 session')).toBeInTheDocument()
    expect(screen.getByText('5 min')).toBeInTheDocument() // temps de pause (300 s)
    expect(screen.getByText('2 tâches')).toBeInTheDocument()
    expect(screen.getByText('78 %')).toBeInTheDocument() // score de focus
  })

  it('affiche une flèche vers le haut quand la valeur augmente vs la période précédente', () => {
    render(
      <PeriodStatCards
        period="week"
        onPeriodChange={vi.fn()}
        stats={stats()}
        focusScore={focusScore()}
      />,
    )
    // focusSeconds 1500 vs 1000 précédent : +50 %
    expect(screen.getByText('↑ 50 % vs période précédente')).toBeInTheDocument()
    // score 78 vs 60 précédent : +30 %
    expect(screen.getByText('↑ 30 % vs période précédente')).toBeInTheDocument()
  })

  it('affiche « stable » quand la valeur n’a pas changé', () => {
    render(
      <PeriodStatCards
        period="week"
        onPeriodChange={vi.fn()}
        stats={stats({
          current: { focusSeconds: 1500, sessionsCount: 1, pauseSeconds: 999, tasksCompleted: 2 },
          previous: { focusSeconds: 1000, sessionsCount: 1, pauseSeconds: 1, tasksCompleted: 1 },
        })}
        focusScore={focusScore()}
      />,
    )
    // sessionsCount 1 vs 1 précédent : aucun changement
    expect(screen.getByText('stable vs période précédente')).toBeInTheDocument()
  })

  it('n’affiche aucune comparaison pour « depuis le début » (pas de période précédente)', () => {
    render(
      <PeriodStatCards
        period="all"
        onPeriodChange={vi.fn()}
        stats={stats({ previous: null })}
        focusScore={focusScore({ previous: null })}
      />,
    )
    expect(screen.queryByText(/vs période précédente/)).not.toBeInTheDocument()
  })

  it('n’affiche pas la carte score de focus tant qu’elle n’est pas chargée', () => {
    render(
      <PeriodStatCards period="week" onPeriodChange={vi.fn()} stats={stats()} focusScore={null} />,
    )
    expect(screen.queryByText('Score de focus')).not.toBeInTheDocument()
  })

  it('change de période au clic sur un chip', async () => {
    const user = userEvent.setup()
    const onPeriodChange = vi.fn()
    render(
      <PeriodStatCards
        period="week"
        onPeriodChange={onPeriodChange}
        stats={stats()}
        focusScore={focusScore()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Année' }))
    expect(onPeriodChange).toHaveBeenCalledWith('year')
  })

  it('ne rend rien tant que les stats ne sont pas chargées', () => {
    const { container } = render(
      <PeriodStatCards period="week" onPeriodChange={vi.fn()} stats={null} focusScore={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
