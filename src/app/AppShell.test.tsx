import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { TimerSettingsProvider } from '@/features/timer/TimerSettingsProvider'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { AppShell } from './AppShell'

function renderAppShell(children: ReactNode) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ActiveTaskProvider>
            <TimerSettingsProvider>
              <AppShell mode="home" onModeChange={vi.fn()}>
                {children}
              </AppShell>
            </TimerSettingsProvider>
          </ActiveTaskProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>,
  )
}

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

  it('le conteneur racine utilise 100svh (hauteur garantie visible, même avec la barre Safari affichée)', () => {
    const { container } = renderAppShell(<div>Contenu</div>)
    expect(container.firstElementChild?.className).toContain('h-svh')
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
})
