import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_TIMER_SETTINGS } from '@/features/timer/timer-settings'

import { SessionGoalSettings } from './SessionGoalSettings'

describe('SessionGoalSettings — objectif de session (lot 4)', () => {
  it('n’affiche aucun réglage de valeur quand l’objectif est désactivé (par défaut)', () => {
    render(<SessionGoalSettings settings={DEFAULT_TIMER_SETTINGS} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Aucun' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Nombre de sessions visé')).not.toBeInTheDocument()
    expect(screen.queryByText('Durée totale visée')).not.toBeInTheDocument()
  })

  it('bascule vers « nombre de sessions » et affiche le réglage correspondant', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SessionGoalSettings settings={DEFAULT_TIMER_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Nombre de sessions' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_TIMER_SETTINGS, sessionGoalType: 'count' })
  })

  it('affiche le pas-à-pas du nombre de sessions et le plan calculé', () => {
    render(
      <SessionGoalSettings
        settings={{ ...DEFAULT_TIMER_SETTINGS, sessionGoalType: 'count', sessionGoalCount: 4 }}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Nombre de sessions visé')).toBeInTheDocument()
    // 4 sessions de 25 min, 3 pauses courtes de 5 min (sessionsBeforeLongBreak=4 par défaut)
    expect(screen.getByText('4 sessions · 3 pauses courtes · ~1 h 55 au total')).toBeInTheDocument()
  })

  it('affiche le pas-à-pas de la durée visée quand ce type est choisi', () => {
    render(
      <SessionGoalSettings
        settings={{ ...DEFAULT_TIMER_SETTINGS, sessionGoalType: 'duration', sessionGoalMinutes: 90 }}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Durée totale visée')).toBeInTheDocument()
    expect(screen.getByText('90 min')).toBeInTheDocument()
  })

  it('augmente le nombre de sessions visé au clic sur +', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SessionGoalSettings
        settings={{ ...DEFAULT_TIMER_SETTINGS, sessionGoalType: 'count', sessionGoalCount: 4 }}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Augmenter : Nombre de sessions visé' }))
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_TIMER_SETTINGS,
      sessionGoalType: 'count',
      sessionGoalCount: 5,
    })
  })
})
