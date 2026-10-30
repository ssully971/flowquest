import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CLOCK_COLORS_DARK, DEFAULT_CLOCK_SETTINGS } from '@/features/home/clock-settings'
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

  it('propose les tailles XS et S, plus petites que « Petite » (LOT H2, §2)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderClockPage(DEFAULT_CLOCK_SETTINGS, onChange)

    await user.click(screen.getByRole('radio', { name: 'XS' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, size: 'xs' })

    await user.click(screen.getByRole('radio', { name: 'S' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, size: 's' })
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
  it('choisit une couleur de la palette (thème sombre par défaut en test)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderClockPage(DEFAULT_CLOCK_SETTINGS, onChange)

    await user.click(screen.getByRole('button', { name: CLOCK_COLORS_DARK[0] }))
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_CLOCK_SETTINGS,
      color: CLOCK_COLORS_DARK[0],
    })
  })

  it('revient à Auto', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderClockPage({ ...DEFAULT_CLOCK_SETTINGS, color: CLOCK_COLORS_DARK[0] }, onChange)

    await user.click(screen.getByRole('button', { name: 'Auto' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CLOCK_SETTINGS, color: 'auto' })
  })

  it('n’affiche pas d’avertissement de contraste par défaut (Auto)', () => {
    renderClockPage(DEFAULT_CLOCK_SETTINGS, vi.fn())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('affiche un avertissement pour une couleur à faible contraste avec le thème courant', () => {
    // Le blanc cassé de la palette sombre a un contraste < 4,5:1 avec le thème clair
    // (teinte --surface claire) : exactement le cas que la séparation par thème évite.
    window.localStorage.setItem('flowquest.appearance', 'light')
    renderClockPage({ ...DEFAULT_CLOCK_SETTINGS, color: CLOCK_COLORS_DARK[0] }, vi.fn())
    expect(screen.getByRole('alert')).toHaveTextContent('Contraste faible')
  })
})

describe('ClockPage — palette selon le thème (lot 3 bis, §5)', () => {
  it('propose des tons profonds en thème clair plutôt que la palette sombre', () => {
    window.localStorage.setItem('flowquest.appearance', 'light')
    renderClockPage(DEFAULT_CLOCK_SETTINGS, vi.fn())

    expect(screen.getByRole('button', { name: '#1A1A2E' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: CLOCK_COLORS_DARK[0] })).not.toBeInTheDocument()
  })

  it('propose des tons doux et désaturés en thème sombre', () => {
    window.localStorage.setItem('flowquest.appearance', 'dark')
    renderClockPage(DEFAULT_CLOCK_SETTINGS, vi.fn())

    for (const color of CLOCK_COLORS_DARK) {
      expect(screen.getByRole('button', { name: color })).toBeInTheDocument()
    }
  })
})

describe('ClockPage — remise en place de l’horloge Ambiant (LOT 2)', () => {
  it('le bouton est inactif sans position mémorisée', () => {
    renderClockPage(DEFAULT_CLOCK_SETTINGS, vi.fn())
    expect(
      screen.getByRole('button', { name: 'Remettre l’horloge du mode Ambiant à sa place' }),
    ).toBeDisabled()
  })

  it('avec une position mémorisée, le bouton la remet à l’emplacement par défaut', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const settings = {
      ...DEFAULT_CLOCK_SETTINGS,
      ambientPositions: { compact: null, wide: { x: 0.3, y: 0.6 } },
    }
    renderClockPage(settings, onChange)

    await user.click(screen.getByRole('button', { name: 'Remettre l’horloge du mode Ambiant à sa place' }))

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      ambientPositions: { compact: null, wide: null },
    })
  })
})
