import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/shared/design-system'

import { ThemesPage } from './ThemesPage'

function renderThemesPage(onSelect = vi.fn(), disableAnimatedThemes = false) {
  return {
    onSelect,
    ...render(
      <ThemeProvider>
        <ThemesPage
          mode="home"
          onModeChange={vi.fn()}
          selection={{ home: 'horizon', focus: 'horizon', ambient: 'horizon' }}
          onSelect={onSelect}
          disableAnimatedThemes={disableAnimatedThemes}
        />
      </ThemeProvider>,
    ),
  }
}

describe('ThemesPage — bibliothèque de fonds par catégorie', () => {
  it('affiche au moins un fond dans chacune des 7 catégories, jamais le message vide', async () => {
    const user = userEvent.setup()
    renderThemesPage()

    const categories = [
      'Dégradés et couleurs',
      'Abstrait',
      'Scénique',
      'Nature',
      'Urbain',
      'Intérieur',
      'Animé',
    ]
    for (const category of categories) {
      await user.click(screen.getByRole('button', { name: category }))
      expect(
        screen.queryByText('Aucun fond dans cette catégorie pour l’instant.'),
      ).not.toBeInTheDocument()
    }
  })

  it('choisit un fond d’une catégorie auparavant vide (Urbain) et le marque sélectionné', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderThemesPage()

    await user.click(screen.getByRole('button', { name: 'Urbain' }))
    const silhouettes = screen.getByRole('button', { name: /Silhouettes/ })
    await user.click(silhouettes)

    expect(onSelect).toHaveBeenCalledWith('home', 'silhouettes')
  })

  it('le fond actuel du mode s’affiche dans l’aperçu', () => {
    renderThemesPage()
    expect(screen.getByText('Aperçu')).toBeInTheDocument()
  })
})

describe('ThemesPage — désactiver les thèmes animés (§7.6 Extras)', () => {
  it('masque la catégorie Animé et ses fonds quand désactivé', () => {
    renderThemesPage(vi.fn(), true)
    expect(screen.queryByRole('button', { name: 'Animé' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Respiration/ })).not.toBeInTheDocument()
  })

  it('affiche la catégorie Animé par défaut', () => {
    renderThemesPage(vi.fn(), false)
    expect(screen.getByRole('button', { name: 'Animé' })).toBeInTheDocument()
  })
})
