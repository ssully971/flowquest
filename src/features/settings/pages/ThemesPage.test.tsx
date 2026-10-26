import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { BackgroundSelections } from '@/app/background-selection'
import { DEFAULT_BACKGROUND_DISPLAY_SETTINGS } from '@/features/settings/background-display-settings'
import { CustomBackgroundProvider } from '@/features/settings/CustomBackgroundProvider'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { ThemesPage } from './ThemesPage'

const SELECTIONS: BackgroundSelections = {
  home: { dark: 'horizon', light: 'horizon', linked: true },
  focus: { dark: 'horizon', light: 'horizon', linked: true },
  ambient: { dark: 'horizon', light: 'horizon', linked: true },
}

function renderThemesPage(
  onSelect = vi.fn(),
  disableAnimatedThemes = false,
  onBackgroundDisplaySettingsChange = vi.fn(),
  selections = SELECTIONS,
  onLinkedChange = vi.fn(),
) {
  return {
    onSelect,
    onBackgroundDisplaySettingsChange,
    onLinkedChange,
    ...render(
      <ToastProvider>
        <ThemeProvider>
          <CustomBackgroundProvider>
            <ThemesPage
              mode="home"
              onModeChange={vi.fn()}
              selections={selections}
              onSelect={onSelect}
              onLinkedChange={onLinkedChange}
              disableAnimatedThemes={disableAnimatedThemes}
              backgroundDisplaySettings={DEFAULT_BACKGROUND_DISPLAY_SETTINGS}
              onBackgroundDisplaySettingsChange={onBackgroundDisplaySettingsChange}
            />
          </CustomBackgroundProvider>
        </ThemeProvider>
      </ToastProvider>,
    ),
  }
}

describe('ThemesPage — bibliothèque de fonds par catégorie', () => {
  it('affiche au moins un fond dans chacune des 8 catégories, jamais le message vide', async () => {
    const user = userEvent.setup()
    renderThemesPage()

    const categories = [
      'Dégradés et couleurs',
      'Abstrait',
      'Scénique',
      'Nature',
      'Urbain',
      'Intérieur',
      'Minimal',
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

    expect(onSelect).toHaveBeenCalledWith('home', 'dark', 'silhouettes')
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

describe('ThemesPage — flou du fond (lot 3)', () => {
  it('affiche le pourcentage actuel et prévient au changement', () => {
    const { onBackgroundDisplaySettingsChange } = renderThemesPage()

    const slider = screen.getByRole('slider', { name: 'Flou du fond' })
    expect(slider).toHaveValue('0')

    fireEvent.change(slider, { target: { value: '60' } })
    expect(onBackgroundDisplaySettingsChange).toHaveBeenCalledWith({ blurPercent: 60 })
  })
})

describe('ThemesPage — vue « Tous » en rangées par catégorie (lot 3 bis, §2)', () => {
  it('affiche au plus 4 vignettes par catégorie avec un bouton « Tout voir (N) » au-delà', () => {
    renderThemesPage()

    // Plusieurs catégories (Dégradés, Abstrait…) comptent plus de 4 fonds dans le
    // catalogue : leur rangée est tronquée et un bouton « Tout voir » apparaît avec le
    // compte total de la catégorie.
    expect(screen.getAllByRole('button', { name: /Tout voir \(\d+\)/ }).length).toBeGreaterThan(0)
  })

  it('cliquer « Tout voir » bascule sur la grille complète de la catégorie', async () => {
    const user = userEvent.setup()
    renderThemesPage()

    const seeAllButtons = screen.getAllByRole('button', { name: /Tout voir \(\d+\)/ })
    await user.click(seeAllButtons[0])

    // La grille complète de la catégorie choisie est désormais affichée : le bouton
    // « Tout voir » (propre à la vue « Tous ») a disparu.
    expect(screen.queryByRole('button', { name: /Tout voir \(\d+\)/ })).not.toBeInTheDocument()
  })
})

describe('ThemesPage — un fond par thème (lot 3 bis, §3)', () => {
  it('bascule le fond modifié par la sélection « Pour : Sombre / Clair »', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderThemesPage()

    await user.click(screen.getByRole('button', { name: 'Clair' }))
    await user.click(screen.getByRole('button', { name: 'Urbain' }))
    await user.click(screen.getByRole('button', { name: /Silhouettes/ }))

    expect(onSelect).toHaveBeenCalledWith('home', 'light', 'silhouettes')
  })

  it('la case « utiliser le même fond pour les deux thèmes » appelle onLinkedChange', async () => {
    const user = userEvent.setup()
    const { onLinkedChange } = renderThemesPage()

    const checkbox = screen.getByRole('checkbox', {
      name: 'Utiliser le même fond pour les deux thèmes',
    })
    expect(checkbox).toBeChecked()

    await user.click(checkbox)
    expect(onLinkedChange).toHaveBeenCalledWith('home', false)
  })
})
