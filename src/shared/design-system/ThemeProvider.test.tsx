import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { SegmentedControl } from './SegmentedControl'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './theme-context'
import type { Appearance } from './theme-context'

function AppearanceSwitcher() {
  const { appearance, setAppearance } = useTheme()
  return (
    <SegmentedControl
      ariaLabel="Apparence"
      value={appearance}
      onChange={setAppearance}
      options={
        [
          { value: 'dark', label: 'Sombre' },
          { value: 'light', label: 'Clair' },
          { value: 'system', label: 'Système' },
        ] satisfies { value: Appearance; label: string }[]
      }
    />
  )
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeProvider', () => {
  it('ne pose aucun attribut data-theme par défaut (préférence système)', () => {
    render(
      <ThemeProvider>
        <AppearanceSwitcher />
      </ThemeProvider>,
    )
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('pose data-theme et le persiste quand on choisit un thème explicite', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <AppearanceSwitcher />
      </ThemeProvider>,
    )

    await act(() => user.click(screen.getByRole('radio', { name: 'Sombre' })))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(window.localStorage.getItem('flowquest.appearance')).toBe('dark')
  })

  it('retire data-theme quand on revient sur « Système »', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <AppearanceSwitcher />
      </ThemeProvider>,
    )

    await act(() => user.click(screen.getByRole('radio', { name: 'Clair' })))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    await act(() => user.click(screen.getByRole('radio', { name: 'Système' })))
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})
