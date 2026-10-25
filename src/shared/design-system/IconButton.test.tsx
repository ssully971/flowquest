import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Settings } from 'lucide-react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { DEFAULT_EXTRAS_SETTINGS } from '@/features/settings/extras-settings'

import { IconButton } from './IconButton'

beforeEach(() => {
  window.localStorage.clear()
})

describe('IconButton — taille des icônes (LOT H2, §2)', () => {
  it('petite par défaut (h-10 w-10, icône 16px)', () => {
    render(
      <ExtrasSettingsProvider>
        <IconButton icon={Settings} label="Réglages" />
      </ExtrasSettingsProvider>,
    )
    const button = screen.getByRole('button', { name: 'Réglages' })
    expect(button.className).toContain('h-10 w-10')
    expect(button.querySelector('svg')).toHaveAttribute('width', '16')
  })

  it('suit le réglage « Taille des icônes » (Grande → h-14 w-14, icône 24px)', () => {
    window.localStorage.setItem(
      'flowquest.extrasSettings',
      JSON.stringify({ ...DEFAULT_EXTRAS_SETTINGS, iconSize: 'large' }),
    )
    render(
      <ExtrasSettingsProvider>
        <IconButton icon={Settings} label="Réglages" />
      </ExtrasSettingsProvider>,
    )
    const button = screen.getByRole('button', { name: 'Réglages' })
    expect(button.className).toContain('h-14 w-14')
    expect(button.querySelector('svg')).toHaveAttribute('width', '24')
  })
})

describe('IconButton — infobulle au survol (LOT H2, §4)', () => {
  it('affiche le nom de l’icône au survol (révélé après un délai, jamais pendant le clic)', async () => {
    const user = userEvent.setup()
    render(
      <ExtrasSettingsProvider>
        <IconButton icon={Settings} label="Réglages" />
      </ExtrasSettingsProvider>,
    )
    const button = screen.getByRole('button', { name: 'Réglages' })
    const tooltip = button.nextElementSibling
    expect(tooltip).toHaveTextContent('Réglages')
    // Masquée par défaut (opacité 0, révélée seulement via group-hover après 400 ms en
    // CSS) : jamais lue par un lecteur d'écran (aria-hidden) ni visible sans survol.
    expect(tooltip?.className).toContain('opacity-0')
    expect(tooltip?.className).toContain('delay-[400ms]')

    await user.hover(button)
    // Le survol (classe CSS group-hover) est géré par le navigateur, pas jsdom : on
    // vérifie ici que la classe qui le pilote est bien présente plutôt que l'opacité
    // calculée (jsdom n'applique pas :hover).
    expect(tooltip?.className).toContain('group-hover/icon-btn:opacity-100')
  })
})
