import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppShell } from './AppShell'

describe('AppShell — mise en page en calques (pas de décalage par la barre du bas)', () => {
  it('le contenu occupe tout le conteneur (absolute inset-0) indépendamment de la barre du bas', () => {
    render(
      <AppShell mode="home" onModeChange={vi.fn()}>
        <div data-testid="content">Contenu</div>
      </AppShell>,
    )

    const content = screen.getByTestId('content')
    const contentWrapper = content.parentElement
    expect(contentWrapper?.className).toContain('absolute')
    expect(contentWrapper?.className).toContain('inset-0')
  })

  it('la barre du bas est superposée (absolute, bottom-0), pas en flux normal', () => {
    render(
      <AppShell mode="home" onModeChange={vi.fn()}>
        <div>Contenu</div>
      </AppShell>,
    )

    const settingsButton = screen.getByRole('button', { name: 'Réglages' })
    const bottomBar = settingsButton.closest('div[class*="absolute"][class*="bottom-0"]')
    expect(bottomBar).not.toBeNull()
  })

  it('le conteneur racine utilise 100dvh', () => {
    const { container } = render(
      <AppShell mode="home" onModeChange={vi.fn()}>
        <div>Contenu</div>
      </AppShell>,
    )
    expect(container.firstElementChild?.className).toContain('h-dvh')
  })
})
