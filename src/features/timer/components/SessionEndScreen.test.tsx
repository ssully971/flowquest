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
    render(<SessionEndScreen summary={null} showSummary={false} onAcknowledge={vi.fn()} />)
    expect(screen.getByText('Session terminée')).toBeInTheDocument()
  })

  it('n’affiche pas le détail chiffré quand le bilan est désactivé', () => {
    render(<SessionEndScreen summary={SUMMARY} showSummary={false} onAcknowledge={vi.fn()} />)
    expect(screen.queryByText('Sessions')).not.toBeInTheDocument()
  })

  it('affiche le détail chiffré quand le bilan est activé', () => {
    render(<SessionEndScreen summary={SUMMARY} showSummary onAcknowledge={vi.fn()} />)
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
    render(<SessionEndScreen summary={SUMMARY} showSummary onAcknowledge={onAcknowledge} />)

    await user.click(screen.getByRole('button', { name: 'Nouvelle session' }))
    expect(onAcknowledge).toHaveBeenCalled()
  })
})
