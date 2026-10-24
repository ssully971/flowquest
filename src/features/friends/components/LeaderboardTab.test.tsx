import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Leaderboard } from '../types'
import { LeaderboardTab } from './LeaderboardTab'

const LEADERBOARD: Leaderboard = {
  weekStart: '2026-01-05T04:00:00Z',
  weekEnd: '2026-01-12T04:00:00Z',
  entries: [
    {
      id: 'u1',
      username: 'moi',
      displayName: null,
      avatarUrl: null,
      avatarVersion: 0,
      rank: 1,
      isSelf: true,
      score: 90,
      focusSeconds: 7200,
      completionRate: 100,
      regularityRate: 90,
    },
    {
      id: 'u2',
      username: 'ami',
      displayName: 'Ami',
      avatarUrl: null,
      avatarVersion: 0,
      rank: 2,
      isSelf: false,
      score: 60,
      focusSeconds: 3600,
      completionRate: 80,
      regularityRate: 60,
    },
  ],
}

describe('LeaderboardTab — classement hebdomadaire (LOT F2)', () => {
  it('affiche le chargement avant d’avoir des données', () => {
    render(
      <LeaderboardTab
        leaderboard={null}
        isLoading
        loadError={null}
        weekOffset={0}
        onWeekOffsetChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByText('Chargement…')).toBeInTheDocument()
  })

  it('affiche un état vide quand il n’y a personne à classer', () => {
    render(
      <LeaderboardTab
        leaderboard={{ entries: [], weekStart: '', weekEnd: '' }}
        isLoading={false}
        loadError={null}
        weekOffset={0}
        onWeekOffsetChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByText(/Personne à classer/)).toBeInTheDocument()
  })

  it('affiche le classement, ma position en évidence (« Toi ») et le message d’encouragement', () => {
    render(
      <LeaderboardTab
        leaderboard={LEADERBOARD}
        isLoading={false}
        loadError={null}
        weekOffset={0}
        onWeekOffsetChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByText('Toi')).toBeInTheDocument()
    expect(screen.getByText('Ami')).toBeInTheDocument()
    expect(screen.getByText('Tu es en tête cette semaine. Continue comme ça !')).toBeInTheDocument()
  })

  it('bascule entre cette semaine et la semaine dernière', async () => {
    const user = userEvent.setup()
    const onWeekOffsetChange = vi.fn()
    render(
      <LeaderboardTab
        leaderboard={LEADERBOARD}
        isLoading={false}
        loadError={null}
        weekOffset={0}
        onWeekOffsetChange={onWeekOffsetChange}
        onRetry={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Semaine dernière' }))

    expect(onWeekOffsetChange).toHaveBeenCalledWith(1)
  })

  it('affiche une erreur avec un bouton Réessayer', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <LeaderboardTab
        leaderboard={null}
        isLoading={false}
        loadError="Impossible de charger le classement. Réessaie."
        weekOffset={0}
        onWeekOffsetChange={vi.fn()}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
