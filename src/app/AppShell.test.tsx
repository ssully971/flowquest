import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AppMode } from '@/app/useAppMode'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { QuotesSettingsProvider } from '@/features/home/QuotesSettingsProvider'
import { BackgroundDisplaySettingsProvider } from '@/features/settings/BackgroundDisplaySettingsProvider'
import { DEFAULT_EXTRAS_SETTINGS } from '@/features/settings/extras-settings'
import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { TimerSettingsProvider } from '@/features/timer/TimerSettingsProvider'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { AppShell } from './AppShell'

function renderAppShell(children: ReactNode, mode: AppMode = 'home') {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ActiveTaskProvider>
            <TimerSettingsProvider>
              <ClockSettingsProvider>
                <QuotesSettingsProvider>
                  <ExtrasSettingsProvider>
                    <BackgroundDisplaySettingsProvider>
                      <AppShell mode={mode} onModeChange={vi.fn()}>
                        {children}
                      </AppShell>
                    </BackgroundDisplaySettingsProvider>
                  </ExtrasSettingsProvider>
                </QuotesSettingsProvider>
              </ClockSettingsProvider>
            </TimerSettingsProvider>
          </ActiveTaskProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>,
  )
}

afterEach(() => {
  window.localStorage.clear()
})

describe('AppShell — mise en page en calques (pas de décalage par la barre du bas)', () => {
  it('le contenu occupe tout le conteneur (absolute inset-0) indépendamment de la barre du bas', () => {
    renderAppShell(<div data-testid="content">Contenu</div>)

    const content = screen.getByTestId('content')
    const contentWrapper = content.parentElement
    expect(contentWrapper?.className).toContain('absolute')
    expect(contentWrapper?.className).toContain('inset-0')
  })

  it('la barre du bas est superposée (absolute, bottom-0), pas en flux normal', () => {
    renderAppShell(<div>Contenu</div>)

    const settingsButton = screen.getByRole('button', { name: 'Réglages' })
    const bottomBar = settingsButton.closest('div[class*="absolute"][class*="bottom-0"]')
    expect(bottomBar).not.toBeNull()
  })

  it('le conteneur racine utilise 100dvh (suit la barre d’outils Safari en temps réel, lot 3 : plus de bande vide quand elle se masque)', () => {
    const { container } = renderAppShell(<div>Contenu</div>)
    expect(container.firstElementChild?.className).toContain('h-dvh')
  })
})

describe('AppShell — Réglages et Plein écran à gauche, Tâches/Notes à droite', () => {
  it('Réglages et Plein écran sont groupés ensemble à gauche de la barre du bas', () => {
    renderAppShell(<div>Contenu</div>)

    const leftGroup = screen.getByTestId('left-button-group')
    const childLabels = Array.from(leftGroup.children).map((el) => el.getAttribute('aria-label'))
    expect(childLabels).toEqual(['Réglages', 'Plein écran'])
  })

  it('Tâches et Bloc-notes sont dans le groupe de droite', () => {
    renderAppShell(<div>Contenu</div>)

    const rightGroup = screen.getByTestId('right-button-group')
    const labels = Array.from(rightGroup.querySelectorAll('[aria-label]')).map((el) =>
      el.getAttribute('aria-label'),
    )
    expect(labels.slice(-2)).toEqual(['Tâches', 'Bloc-notes'])
  })

  it('Réglages se déplace dans le groupe de droite quand Extras le règle sur « Droite » (LOT B9)', () => {
    window.localStorage.setItem(
      'flowquest.extrasSettings',
      JSON.stringify({ ...DEFAULT_EXTRAS_SETTINGS, settingsPanelSide: 'right' }),
    )
    renderAppShell(<div>Contenu</div>)

    const leftGroup = screen.getByTestId('left-button-group')
    const leftLabels = Array.from(leftGroup.children).map((el) => el.getAttribute('aria-label'))
    expect(leftLabels).toEqual(['Plein écran'])

    const rightGroup = screen.getByTestId('right-button-group')
    const rightLabels = Array.from(rightGroup.querySelectorAll('[aria-label]')).map((el) =>
      el.getAttribute('aria-label'),
    )
    expect(rightLabels[0]).toBe('Réglages')
  })
})

describe('AppShell — pastille de série (lot 4 : panneau de détail)', () => {
  it('ouvre le panneau de détail de la série au clic sur la pastille', async () => {
    const user = userEvent.setup()
    renderAppShell(<div>Contenu</div>)

    const streakButton = screen.getByRole('button', { name: /Série/ })
    expect(screen.queryByRole('dialog', { name: 'Série' })).not.toBeInTheDocument()

    await user.click(streakButton)
    expect(screen.getByRole('dialog', { name: 'Série' })).toBeInTheDocument()
  })
})

describe('AppShell — mode Ambiant (§5.3) : tâches et bloc-notes masqués', () => {
  it('propose Ambiant dans le sélecteur de mode', () => {
    renderAppShell(<div>Contenu</div>)
    expect(screen.getByRole('radio', { name: 'Ambiant' })).toBeInTheDocument()
  })

  it('masque les boutons Tâches et Bloc-notes en mode Ambiant', () => {
    renderAppShell(<div>Contenu</div>, 'ambient')

    expect(screen.queryByRole('button', { name: 'Tâches' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bloc-notes' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réglages' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plein écran' })).toBeInTheDocument()
  })
})
