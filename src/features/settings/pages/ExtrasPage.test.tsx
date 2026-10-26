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

  it('bascule la confirmation avant suppression d’une tâche (LOT H1, §5)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExtrasPage settings={DEFAULT_EXTRAS_SETTINGS} onChange={onChange} />)

    expect(DEFAULT_EXTRAS_SETTINGS.confirmTaskDeletion).toBe(true)
    await user.click(screen.getByRole('switch', { name: 'Confirmer avant de supprimer une tâche' }))
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_EXTRAS_SETTINGS,
      confirmTaskDeletion: false,
    })
  })

  it('bascule l’activation des piliers de vie (lot 4, §5)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExtrasPage settings={DEFAULT_EXTRAS_SETTINGS} onChange={onChange} />)

    expect(DEFAULT_EXTRAS_SETTINGS.pillarsEnabled).toBe(true)
    await user.click(screen.getByRole('switch', { name: 'Activer les piliers de vie' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_EXTRAS_SETTINGS, pillarsEnabled: false })
  })

  it('change la taille des icônes, petite par défaut (LOT H2, §2)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExtrasPage settings={DEFAULT_EXTRAS_SETTINGS} onChange={onChange} />)

    expect(DEFAULT_EXTRAS_SETTINGS.iconSize).toBe('small')
    await user.click(screen.getByRole('radio', { name: 'Grande' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_EXTRAS_SETTINGS, iconSize: 'large' })
  })

  it('change le côté du panneau de réglages (LOT B9)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExtrasPage settings={DEFAULT_EXTRAS_SETTINGS} onChange={onChange} />)

    expect(DEFAULT_EXTRAS_SETTINGS.settingsPanelSide).toBe('left')
    await user.click(screen.getByRole('radio', { name: 'Droite' }))
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_EXTRAS_SETTINGS,
      settingsPanelSide: 'right',
    })
  })

  it('change le mode d’affichage des tâches et des notes (LOT B11)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ExtrasPage settings={DEFAULT_EXTRAS_SETTINGS} onChange={onChange} />)

    expect(DEFAULT_EXTRAS_SETTINGS.tasksDisplayMode).toBe('panel')
    expect(DEFAULT_EXTRAS_SETTINGS.notesDisplayMode).toBe('panel')

    const windowButtons = screen.getAllByRole('radio', { name: 'Grande fenêtre' })
    expect(windowButtons).toHaveLength(2)

    await user.click(windowButtons[0])
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_EXTRAS_SETTINGS,
      tasksDisplayMode: 'window',
    })

    await user.click(windowButtons[1])
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_EXTRAS_SETTINGS,
      notesDisplayMode: 'window',
    })
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
