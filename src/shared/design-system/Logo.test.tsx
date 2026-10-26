import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Logo } from './Logo'
import { ThemeProvider } from './ThemeProvider'

function renderLogo(appearance: 'dark' | 'light', props: Parameters<typeof Logo>[0] = {}) {
  window.localStorage.setItem('flowquest.appearance', appearance)
  return render(
    <ThemeProvider>
      <Logo {...props} />
    </ThemeProvider>,
  )
}

describe('Logo — variantes selon le thème (LOT 2)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  it('variant="mark" affiche toujours l’icône tête de renard, quel que soit le thème', () => {
    renderLogo('dark', { variant: 'mark' })
    expect(screen.getByAltText('Fokitsu')).toHaveAttribute('src', '/brand/logo-icon.webp')
  })

  it('tone="auto" (défaut) affiche la version blanche en thème sombre', () => {
    renderLogo('dark')
    expect(screen.getByAltText('Fokitsu')).toHaveAttribute(
      'src',
      '/brand/logo-wordmark-white.webp',
    )
  })

  it('tone="auto" (défaut) affiche la version noire en thème clair', () => {
    renderLogo('light')
    expect(screen.getByAltText('Fokitsu')).toHaveAttribute(
      'src',
      '/brand/logo-wordmark-black.webp',
    )
  })

  it('tone="panel" affiche la version blanche en thème sombre (le bleu nuit n’y a pas assez de contraste)', () => {
    renderLogo('dark', { tone: 'panel' })
    expect(screen.getByAltText('Fokitsu')).toHaveAttribute(
      'src',
      '/brand/logo-wordmark-white.webp',
    )
  })

  it('tone="panel" affiche la version bleu nuit en thème clair (contraste ≈ 10:1 sur le panneau)', () => {
    renderLogo('light', { tone: 'panel' })
    expect(screen.getByAltText('Fokitsu')).toHaveAttribute(
      'src',
      '/brand/logo-wordmark-color.webp',
    )
  })
})
