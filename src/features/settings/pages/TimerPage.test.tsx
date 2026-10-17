import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_TIMER_SETTINGS } from '@/features/timer/timer-settings'

import { TimerPage } from './TimerPage'

describe('TimerPage — durées Pomodoro et démarrage automatique', () => {
  it('affiche les durées et le nombre de sessions configurés', () => {
    render(<TimerPage settings={DEFAULT_TIMER_SETTINGS} onChange={vi.fn()} />)

    expect(screen.getByText('25 min')).toBeInTheDocument()
    expect(screen.getByText('5 min')).toBeInTheDocument()
    expect(screen.getByText('10 min')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('augmente la durée de focus de 5 min au clic sur +', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimerPage settings={DEFAULT_TIMER_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Augmenter : Durée de focus' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_TIMER_SETTINGS, focusMinutes: 30 })
  })

  it('désactive le bouton - sur la durée de focus à la borne basse (10 min)', () => {
    render(
      <TimerPage settings={{ ...DEFAULT_TIMER_SETTINGS, focusMinutes: 10 }} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Diminuer : Durée de focus' })).toBeDisabled()
  })

  it('bascule le démarrage automatique', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimerPage settings={DEFAULT_TIMER_SETTINGS} onChange={onChange} />)

    const toggle = screen.getByRole('switch', {
      name: 'Démarrage automatique du segment suivant',
    })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_TIMER_SETTINGS, autoStartNext: true })
  })

  it('bascule l’affichage de la tâche dans le PiP (§6.3)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimerPage settings={DEFAULT_TIMER_SETTINGS} onChange={onChange} />)

    const toggle = screen.getByRole('switch', {
      name: 'Afficher la tâche dans l’Image dans l’image',
    })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    await user.click(toggle)
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_TIMER_SETTINGS, showTaskInPip: false })
  })
})
