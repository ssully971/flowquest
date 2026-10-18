import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_BACKGROUND_DISPLAY_SETTINGS } from '@/features/settings/background-display-settings'
import { CustomBackgroundProvider } from '@/features/settings/CustomBackgroundProvider'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { ThemesPage } from './ThemesPage'

function renderThemesPage(
  onSelect = vi.fn(),
  disableAnimatedThemes = false,
  onBackgroundDisplaySettingsChange = vi.fn(),
) {
  return {
    onSelect,
    onBackgroundDisplaySettingsChange,
    ...render(
      <ToastProvider>
        <ThemeProvider>
          <CustomBackgroundProvider>
            <ThemesPage
              mode="home"
              onModeChange={vi.fn()}
              selection={{ home: 'horizon', focus: 'horizon', ambient: 'horizon' }}
              onSelect={onSelect}
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

describe('ThemesPage — flou du fond (lot 3)', () => {
  it('affiche le pourcentage actuel et prévient au changement', () => {
    const { onBackgroundDisplaySettingsChange } = renderThemesPage()

    const slider = screen.getByRole('slider', { name: 'Flou du fond' })
    expect(slider).toHaveValue('0')

    fireEvent.change(slider, { target: { value: '60' } })
    expect(onBackgroundDisplaySettingsChange).toHaveBeenCalledWith({ blurPercent: 60 })
  })
})
