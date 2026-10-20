import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CLOCK_COLORS, DEFAULT_CLOCK_SETTINGS } from '@/features/home/clock-settings'
import type { ClockSettings } from '@/features/home/clock-settings'
import { ThemeProvider } from '@/shared/design-system'

import { ClockPage } from './ClockPage'

function renderClockPage(settings: ClockSettings, onChange: (settings: ClockSettings) => void) {
  return render(
    <ThemeProvider>
      <ClockPage settings={settings} onChange={onChange} />
    </ThemeProvider>,
  )
}

describe('ClockPage — format, taille, secondes, salutation, style et horloge flip', () => {
  it('bascule le format 12h/24h', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderClockPage(DEFAULT_CLOCK_SETTINGS, onChange)

    await user.click(screen.getByRole('radio', { name: '12 h' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, format: '12h' })
  })

  it('change la taille', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderClockPage(DEFAULT_CLOCK_SETTINGS, onChange)

    await user.click(screen.getByRole('radio', { name: 'Énorme' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, size: 'huge' })
  })

  it('change le style de police parmi les 12 proposés', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderClockPage(DEFAULT_CLOCK_SETTINGS, onChange)

    await user.click(screen.getByRole('button', { name: 'Handwritten' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, style: 'handwritten' })
  })

  it('bascule afficher les secondes, la salutation et l’horloge flip', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderClockPage(DEFAULT_CLOCK_SETTINGS, onChange)

    await user.click(screen.getByRole('switch', { name: 'Afficher les secondes' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, showSeconds: true })

    await user.click(screen.getByRole('switch', { name: 'Afficher la salutation' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, showGreeting: false })

    await user.click(screen.getByRole('switch', { name: 'Horloge « flip »' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, flipClock: true })
  })
})

describe('ClockPage — couleur de l’horloge (LOT B10)', () => {
  it('choisit une couleur de la palette', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderClockPage(DEFAULT_CLOCK_SETTINGS, onChange)

    await user.click(screen.getByRole('button', { name: CLOCK_COLORS[0] }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, color: CLOCK_COLORS[0] })
  })

  it('revient à Auto', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderClockPage({ ...DEFAULT_CLOCK_SETTINGS, color: CLOCK_COLORS[0] }, onChange)

    await user.click(screen.getByRole('button', { name: 'Auto' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, color: 'auto' })
  })

  it('n’affiche pas d’avertissement de contraste par défaut (Auto)', () => {
    renderClockPage(DEFAULT_CLOCK_SETTINGS, vi.fn())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('affiche un avertissement pour une couleur à faible contraste avec le thème courant', () => {
    // #E8C547 (jaune) a un contraste < 3:1 avec le thème clair (teinte --surface claire).
    window.localStorage.setItem('flowquest.appearance', 'light')
    renderClockPage({ ...DEFAULT_CLOCK_SETTINGS, color: '#E8C547' }, vi.fn())
    expect(screen.getByRole('alert')).toHaveTextContent('Contraste faible')
  })
})
