import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_EXTRAS_SETTINGS } from '@/features/settings/extras-settings'

import { ExtrasPage } from './ExtrasPage'

describe('ExtrasPage — nom affiché, thèmes animés, mode épuré, veille, randomiseur, série, onglet par défaut', () => {
  it('change le nom affiché', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExtrasPage settings={DEFAULT_EXTRAS_SETTINGS} onChange={onChange} />)

    await user.type(screen.getByPlaceholderText('Ton prénom (optionnel)'), 'A')
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_EXTRAS_SETTINGS, displayName: 'A' })
  })

  it('bascule désactiver les thèmes animés', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExtrasPage settings={DEFAULT_EXTRAS_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('switch', { name: 'Désactiver les thèmes animés' }))
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_EXTRAS_SETTINGS,
      disableAnimatedThemes: true,
    })
  })

  it('bascule le mode épuré', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExtrasPage settings={DEFAULT_EXTRAS_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('switch', { name: 'Mode épuré' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_EXTRAS_SETTINGS, cleanMode: true })
  })

  it('bascule empêcher la mise en veille et le randomiseur de thème', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExtrasPage settings={DEFAULT_EXTRAS_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('switch', { name: 'Empêcher la mise en veille' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_EXTRAS_SETTINGS, preventSleep: true })

    await user.click(screen.getByRole('switch', { name: 'Thème aléatoire à chaque chargement' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_EXTRAS_SETTINGS, themeRandomizer: true })
  })

  it('bascule l’affichage de la série sur l’accueil', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExtrasPage settings={DEFAULT_EXTRAS_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('switch', { name: 'Afficher la série sur l’accueil' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_EXTRAS_SETTINGS, showStreak: false })
  })

  it('change l’onglet des réglages ouvert par défaut', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExtrasPage settings={DEFAULT_EXTRAS_SETTINGS} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Stats' }))
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_EXTRAS_SETTINGS,
      defaultSettingsTab: 'stats',
    })
  })
})
