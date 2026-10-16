import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_CLOCK_SETTINGS } from './clock-settings'
import { ClockSettingsProvider } from './ClockSettingsProvider'
import { HomeScreen } from './HomeScreen'
import { QuotesSettingsProvider } from './QuotesSettingsProvider'

function renderHomeScreen() {
  return render(
    <ClockSettingsProvider>
      <QuotesSettingsProvider>
        <HomeScreen />
      </QuotesSettingsProvider>
    </ClockSettingsProvider>,
  )
}

function seedClockSettings(overrides: Partial<typeof DEFAULT_CLOCK_SETTINGS>) {
  window.localStorage.setItem(
    'flowquest.clockSettings',
    JSON.stringify({ ...DEFAULT_CLOCK_SETTINGS, ...overrides }),
  )
}

describe('HomeScreen — nom et citation agrandis, marges généreuses', () => {
  it('le nom « Flowquest » est affiché autour de 32-36px avec de grandes marges', () => {
    renderHomeScreen()
    const logo = screen.getByText('Flowquest')
    expect(logo.className).toContain('text-[32px]')
    expect(logo.className).toContain('sm:text-[36px]')
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
