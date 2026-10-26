import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { PillarRecord } from '@/shared/storage/db'

import { BalanceCard } from './BalanceCard'

function makePillar(overrides: Partial<PillarRecord>): PillarRecord {
  return {
    id: 'pillar',
    name: 'Pilier',
    color: '#4A9FE8',
    currentXp: 0,
    level: 1,
    createdAt: Date.now(),
    archivedAt: null,
    goalLevel: null,
    goalDeadline: null,
    ...overrides,
  }
}

describe('BalanceCard — carte « Équilibre » (LOT G3)', () => {
  it('affiche un message clair avec moins de 3 piliers actifs', () => {
    render(
      <BalanceCard
        activePillars={[
          makePillar({ id: '1', name: 'Travail' }),
          makePillar({ id: '2', name: 'Sport' }),
        ]}
      />,
    )
    expect(
      screen.getByText('Ajoute au moins 3 piliers actifs pour voir ton équilibre.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('affiche aucun message et aucun graphique quand il n’y a aucun pilier', () => {
    render(<BalanceCard activePillars={[]} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('affiche le radar et la liste des piliers avec au moins 3 piliers actifs', () => {
    render(
      <BalanceCard
        activePillars={[
          makePillar({ id: '1', name: 'Travail', currentXp: 600, level: 2 }),
          makePillar({ id: '2', name: 'Sport', currentXp: 100, level: 1 }),
          makePillar({ id: '3', name: 'Études', currentXp: 0, level: 1 }),
        ]}
      />,
    )
    const chart = screen.getByRole('img')
    expect(chart.getAttribute('aria-label')).toContain('Travail : Niv. 2')
    expect(chart.getAttribute('aria-label')).toContain('Sport : Niv. 1')
    expect(chart.getAttribute('aria-label')).toContain('Études : Niv. 1')

    expect(screen.getByText('Travail')).toBeInTheDocument()
    expect(screen.getByText('Sport')).toBeInTheDocument()
    expect(screen.getByText('Études')).toBeInTheDocument()
  })
})
