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

  it('le conteneur racine utilise 100svh (hauteur garantie visible, même avec la barre Safari affichée)', () => {
    const { container } = render(
      <AppShell mode="home" onModeChange={vi.fn()}>
        <div>Contenu</div>
      </AppShell>,
    )
    expect(container.firstElementChild?.className).toContain('h-svh')
  })
})

describe('AppShell — Réglages à gauche, Tâches/Notes à droite près du plein écran', () => {
  it('Réglages est seul dans le groupe de gauche de la barre du bas', () => {
    render(
      <AppShell mode="home" onModeChange={vi.fn()}>
        <div>Contenu</div>
      </AppShell>,
    )

    const settingsButton = screen.getByRole('button', { name: 'Réglages' })
    const leftGroup = settingsButton.parentElement
    expect(leftGroup?.children).toHaveLength(1)
    expect(leftGroup?.firstElementChild).toBe(settingsButton)
  })

  it('Tâches et Bloc-notes sont juste avant le bouton plein écran, à droite', () => {
    render(
      <AppShell mode="home" onModeChange={vi.fn()}>
        <div>Contenu</div>
      </AppShell>,
    )

    const rightGroup = screen.getByRole('button', { name: 'Tâches' }).parentElement
    const childLabels = Array.from(rightGroup?.children ?? []).map((el) =>
      el.getAttribute('aria-label'),
    )
    expect(childLabels.slice(-3)).toEqual(['Tâches', 'Bloc-notes', 'Plein écran'])
  })
})
