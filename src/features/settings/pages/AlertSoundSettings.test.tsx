import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_TIMER_SETTINGS } from '@/features/timer/timer-settings'

import { AlertSoundSettings } from './AlertSoundSettings'

describe('AlertSoundSettings — son, notifications, choix et volume (lot 4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('bascule le son indépendamment des notifications', () => {
    const onChange = vi.fn()
    render(<AlertSoundSettings settings={DEFAULT_TIMER_SETTINGS} onChange={onChange} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Son' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_TIMER_SETTINGS, soundEnabled: false })
  })

  it('change le son choisi', () => {
    const onChange = vi.fn()
    render(<AlertSoundSettings settings={DEFAULT_TIMER_SETTINGS} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cloche' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_TIMER_SETTINGS, alertSoundId: 'cloche' })
  })

  it('prévisualise un son sans changer les réglages', () => {
    const playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())
    const onChange = vi.fn()
    render(<AlertSoundSettings settings={DEFAULT_TIMER_SETTINGS} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Écouter : Marimba' }))
    expect(playSpy).toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('change le volume', () => {
    const onChange = vi.fn()
    render(<AlertSoundSettings settings={DEFAULT_TIMER_SETTINGS} onChange={onChange} />)

    fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), { target: { value: '30' } })
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_TIMER_SETTINGS, alertVolume: 0.3 })
  })
})
