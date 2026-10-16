import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_CLOCK_SETTINGS } from '@/features/home/clock-settings'

import { ClockPage } from './ClockPage'

describe('ClockPage — format, taille, secondes, salutation, style et horloge flip', () => {
  it('bascule le format 12h/24h', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ClockPage settings={DEFAULT_CLOCK_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: '12 h' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, format: '12h' })
  })

  it('change la taille', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ClockPage settings={DEFAULT_CLOCK_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: 'Énorme' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, size: 'huge' })
  })

  it('change le style de police parmi les 12 proposés', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ClockPage settings={DEFAULT_CLOCK_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Handwritten' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, style: 'handwritten' })
  })

  it('bascule afficher les secondes, la salutation et l’horloge flip', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ClockPage settings={DEFAULT_CLOCK_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('switch', { name: 'Afficher les secondes' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, showSeconds: true })

    await user.click(screen.getByRole('switch', { name: 'Afficher la salutation' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, showGreeting: false })

    await user.click(screen.getByRole('switch', { name: 'Horloge « flip »' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, flipClock: true })
  })
})
