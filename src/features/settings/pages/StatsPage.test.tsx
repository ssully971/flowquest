import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { StatsPage } from './StatsPage'

describe('StatsPage — objectif quotidien ajustable', () => {
  it('affiche l’objectif courant et le message vide tant qu’aucune session n’est enregistrée', async () => {
    render(<StatsPage dailyGoalMinutes={120} onDailyGoalChange={vi.fn()} />)

    expect(await screen.findByText('0 min / 120 min')).toBeInTheDocument()
    expect(
      screen.getByText('Termine ta première session de focus pour voir tes statistiques ici.'),
    ).toBeInTheDocument()
  })

  it('augmente l’objectif de 15 min au clic sur +', async () => {
    const user = userEvent.setup()
    const onDailyGoalChange = vi.fn()
    render(<StatsPage dailyGoalMinutes={120} onDailyGoalChange={onDailyGoalChange} />)

    await user.click(screen.getByRole('button', { name: 'Augmenter l’objectif quotidien' }))
    expect(onDailyGoalChange).toHaveBeenCalledWith(135)
  })

  it('diminue l’objectif de 15 min au clic sur -', async () => {
    const user = userEvent.setup()
    const onDailyGoalChange = vi.fn()
    render(<StatsPage dailyGoalMinutes={120} onDailyGoalChange={onDailyGoalChange} />)

    await user.click(screen.getByRole('button', { name: 'Diminuer l’objectif quotidien' }))
    expect(onDailyGoalChange).toHaveBeenCalledWith(105)
  })

  it('désactive le bouton - à la borne basse et + à la borne haute', () => {
    const { rerender } = render(<StatsPage dailyGoalMinutes={15} onDailyGoalChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Diminuer l’objectif quotidien' })).toBeDisabled()

    rerender(<StatsPage dailyGoalMinutes={480} onDailyGoalChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Augmenter l’objectif quotidien' })).toBeDisabled()
  })
})
