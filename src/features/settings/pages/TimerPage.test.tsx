import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_TIMER_SETTINGS } from '@/features/timer/timer-settings'

import { TimerPage } from './TimerPage'

describe('TimerPage — durées Pomodoro et démarrage automatique', () => {
  it('affiche les durées et le nombre de sessions configurés', () => {
    render(<TimerPage settings={DEFAULT_TIMER_SETTINGS} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Durée de focus')).toHaveValue(25)
    expect(screen.getByLabelText('Pause courte')).toHaveValue(5)
    expect(screen.getByLabelText('Pause longue')).toHaveValue(10)
    // Le nombre de sessions avant la pause longue vit désormais dans le réglage
    // « Fin de cycle » (LOT E5), sous le libellé « Nombre de sessions ».
    expect(screen.getByLabelText('Nombre de sessions')).toHaveValue(4)
  })

  it('augmente la durée du compte à rebours de 1 min au clic sur +', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimerPage settings={DEFAULT_TIMER_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Augmenter : Durée du compte à rebours' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_TIMER_SETTINGS, countdownMinutes: 21 })
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

  it('bascule les raccourcis clavier (LOT G1)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimerPage settings={DEFAULT_TIMER_SETTINGS} onChange={onChange} />)

    const toggle = screen.getByRole('switch', { name: 'Raccourcis clavier' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    await user.click(toggle)
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_TIMER_SETTINGS, keyboardShortcutsEnabled: false })
  })

  it('le lien « Afficher les raccourcis clavier » ouvre l’aide (LOT G1)', async () => {
    const user = userEvent.setup()
    render(<TimerPage settings={DEFAULT_TIMER_SETTINGS} onChange={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Afficher les raccourcis clavier' }))
    expect(screen.getByRole('dialog', { name: 'Raccourcis clavier' })).toBeInTheDocument()
  })
})
