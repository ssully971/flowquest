import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { GoalReachedPanel } from './GoalReachedPanel'

describe('GoalReachedPanel', () => {
  it('affiche le nombre de sessions complétées, accordé au pluriel', () => {
    render(<GoalReachedPanel completed={4} onContinue={vi.fn()} />)
    expect(screen.getByText('Objectif atteint')).toBeInTheDocument()
    expect(screen.getByText('Tu as complété 4 sessions. Bravo !')).toBeInTheDocument()
  })

  it('accorde au singulier pour une seule session', () => {
    render(<GoalReachedPanel completed={1} onContinue={vi.fn()} />)
    expect(screen.getByText('Tu as complété 1 session. Bravo !')).toBeInTheDocument()
  })

  it('appelle onContinue au clic sur « Continuer quand même »', async () => {
    const user = userEvent.setup()
    const onContinue = vi.fn()
    render(<GoalReachedPanel completed={4} onContinue={onContinue} />)

    await user.click(screen.getByRole('button', { name: 'Continuer quand même' }))
    expect(onContinue).toHaveBeenCalled()
  })
})
