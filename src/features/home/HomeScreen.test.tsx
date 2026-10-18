import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { ThemeProvider } from '@/shared/design-system'

import { DEFAULT_CLOCK_SETTINGS } from './clock-settings'
import { ClockSettingsProvider } from './ClockSettingsProvider'
import { HomeScreen } from './HomeScreen'
import { QuotesSettingsProvider } from './QuotesSettingsProvider'

function renderHomeScreen() {
  return render(
    <ThemeProvider>
      <ClockSettingsProvider>
        <QuotesSettingsProvider>
          <ExtrasSettingsProvider>
            <HomeScreen />
          </ExtrasSettingsProvider>
        </QuotesSettingsProvider>
      </ClockSettingsProvider>
    </ThemeProvider>,
  )
}

function seedClockSettings(overrides: Partial<typeof DEFAULT_CLOCK_SETTINGS>) {
  window.localStorage.setItem(
    'flowquest.clockSettings',
    JSON.stringify({ ...DEFAULT_CLOCK_SETTINGS, ...overrides }),
  )
}

describe('HomeScreen — nom et citation agrandis, marges généreuses', () => {
  it('le logo « flowquest » est affiché autour de 36-44px de haut avec de grandes marges', () => {
    renderHomeScreen()
    const logo = screen.getByAltText('Flowquest')
    expect(logo.tagName).toBe('IMG')
    expect(logo.className).toContain('h-9')
    expect(logo.className).toContain('sm:h-11')
    expect(logo.parentElement?.className).toContain('sm:pt-16')
    expect(logo.parentElement?.className).toContain('sm:px-14')
  })

  it('la citation est affichée autour de 18-20px avec une largeur confortable', () => {
    const { container } = renderHomeScreen()
    const quote = container.querySelector('blockquote')
    expect(quote).not.toBeNull()
    expect(quote?.className).toContain('text-[18px]')
    expect(quote?.className).toContain('sm:text-[20px]')
    expect(quote?.closest('figure')?.className).toMatch(/max-w-(sm|md)/)
  })
})

describe('HomeScreen — horloge configurable (format, secondes, salutation)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15, 14, 30, 5))
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.useRealTimers()
  })

  it('affiche l’heure en 24h par défaut, sans secondes', () => {
    renderHomeScreen()
    expect(screen.getByTestId('big-digits')).toHaveTextContent('14:30')
  })

  it('affiche l’heure en 12h avec AM/PM quand configuré', () => {
    seedClockSettings({ format: '12h' })
    renderHomeScreen()
    expect(screen.getByTestId('big-digits')).toHaveTextContent('02:30')
    expect(screen.getByText('PM')).toBeInTheDocument()
  })

  it('affiche les secondes quand configuré', () => {
    seedClockSettings({ showSeconds: true })
    renderHomeScreen()
    expect(screen.getByTestId('big-digits')).toHaveTextContent('14:30:05')
  })

  it('masque la salutation quand configuré', () => {
    seedClockSettings({ showGreeting: false })
    renderHomeScreen()
    expect(screen.queryByText('Prends un instant, puis lance ta session.')).not.toBeInTheDocument()
  })
})

describe('HomeScreen — Extras (nom affiché, mode épuré)', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('ajoute le nom affiché à la salutation quand configuré', () => {
    window.localStorage.setItem(
      'flowquest.extrasSettings',
      JSON.stringify({
        displayName: 'Camille',
        disableAnimatedThemes: false,
        cleanMode: false,
        preventSleep: false,
        defaultSettingsTab: 'themes',
        themeRandomizer: false,
      }),
    )
    renderHomeScreen()
    expect(screen.getByText(/, Camille/)).toBeInTheDocument()
  })

  it('le mode épuré masque la citation et le sous-texte de la salutation', () => {
    window.localStorage.setItem(
      'flowquest.extrasSettings',
      JSON.stringify({
        displayName: '',
        disableAnimatedThemes: false,
        cleanMode: true,
        preventSleep: false,
        defaultSettingsTab: 'themes',
        themeRandomizer: false,
      }),
    )
    const { container } = renderHomeScreen()
    expect(container.querySelector('blockquote')).toBeNull()
    expect(screen.queryByText('Prends un instant, puis lance ta session.')).not.toBeInTheDocument()
  })
})
