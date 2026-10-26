import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { CycleSummary } from '../cycle-summary'
import { SessionEndScreen } from './SessionEndScreen'

const SUMMARY: CycleSummary = {
  focusSeconds: 2580, // 43 min
  sessionsCount: 2,
  pausesCount: 1,
  completedTasksCount: 3,
}

describe('SessionEndScreen — confirmation de fin de session (LOT E6)', () => {
  it('affiche toujours la confirmation « Session terminée », même sans bilan', () => {
    render(
      <SessionEndScreen
        summary={null}
        showSummary={false}
        pillarLevelUp={null}
        onAcknowledge={vi.fn()}
      />,
    )
    expect(screen.getByText('Session terminée')).toBeInTheDocument()
  })

  it('n’affiche pas le détail chiffré quand le bilan est désactivé', () => {
    render(
      <SessionEndScreen
        summary={SUMMARY}
        showSummary={false}
        pillarLevelUp={null}
        onAcknowledge={vi.fn()}
      />,
    )
    expect(screen.queryByText('Sessions')).not.toBeInTheDocument()
  })

  it('affiche le détail chiffré quand le bilan est activé', () => {
    render(
      <SessionEndScreen summary={SUMMARY} showSummary pillarLevelUp={null} onAcknowledge={vi.fn()} />,
    )
    expect(screen.getByText('Temps de focus')).toBeInTheDocument()
    expect(screen.getByText('43 min')).toBeInTheDocument()
    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Pauses')).toBeInTheDocument()
    expect(screen.getByText('Tâches validées')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('appelle onAcknowledge au clic sur le bouton', async () => {
    const user = userEvent.setup()
    const onAcknowledge = vi.fn()
    render(
      <SessionEndScreen
        summary={SUMMARY}
        showSummary
        pillarLevelUp={null}
        onAcknowledge={onAcknowledge}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Nouvelle session' }))
    expect(onAcknowledge).toHaveBeenCalled()
  })
})

describe('SessionEndScreen — animation de niveau gagné (LOT G3)', () => {
  const LEVEL_UP = {
    pillarId: 'pillar-1',
    pillarName: 'Travail',
    previousLevel: 1,
    newLevel: 2,
    leveledUp: true,
    goalReached: false,
    goalLevel: null,
  }

  it('affiche le badge de niveau gagné quand le bilan est activé', () => {
    render(
      <SessionEndScreen
        summary={SUMMARY}
        showSummary
        pillarLevelUp={LEVEL_UP}
        onAcknowledge={vi.fn()}
      />,
    )
    expect(screen.getByText('Travail a atteint le niveau 2')).toBeInTheDocument()
  })

  it('n’affiche aucun badge sans changement de niveau', () => {
    render(
      <SessionEndScreen summary={SUMMARY} showSummary pillarLevelUp={null} onAcknowledge={vi.fn()} />,
    )
    expect(screen.queryByText(/a atteint le niveau/)).not.toBeInTheDocument()
  })

  it('n’affiche pas le badge quand le bilan est désactivé, même avec un niveau gagné', () => {
    render(
      <SessionEndScreen
        summary={SUMMARY}
        showSummary={false}
        pillarLevelUp={LEVEL_UP}
        onAcknowledge={vi.fn()}
      />,
    )
    expect(screen.queryByText(/a atteint le niveau/)).not.toBeInTheDocument()
  })
})

describe('SessionEndScreen — objectif de niveau atteint (lot 4, §4)', () => {
  const GOAL_REACHED = {
    pillarId: 'pillar-1',
    pillarName: 'Travail',
    previousLevel: 1,
    newLevel: 2,
    leveledUp: true,
    goalReached: true,
    goalLevel: 2,
  }

  it('affiche un message distinct d’un simple niveau gagné quand l’objectif est atteint', () => {
    render(
      <SessionEndScreen
        summary={SUMMARY}
        showSummary
        pillarLevelUp={GOAL_REACHED}
        onAcknowledge={vi.fn()}
      />,
    )
    expect(screen.getByText('Travail a atteint son objectif : niveau 2')).toBeInTheDocument()
    expect(screen.queryByText(/a atteint le niveau 2/)).not.toBeInTheDocument()
  })

  it('n’affiche pas le message d’objectif quand le bilan est désactivé', () => {
    render(
      <SessionEndScreen
        summary={SUMMARY}
        showSummary={false}
        pillarLevelUp={GOAL_REACHED}
        onAcknowledge={vi.fn()}
      />,
    )
    expect(screen.queryByText(/a atteint son objectif/)).not.toBeInTheDocument()
  })
})
