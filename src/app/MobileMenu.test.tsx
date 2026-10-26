import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Settings } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'

import { MobileMenu } from './MobileMenu'

function renderMenu(onClick = vi.fn()) {
  return {
    onClick,
    ...render(
      <ExtrasSettingsProvider>
        <MobileMenu items={[{ key: 'settings', icon: Settings, label: 'Réglages', onClick }]} />
      </ExtrasSettingsProvider>,
    ),
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('MobileMenu — actions secondaires regroupées sur mobile (retour après feu vert, LOT H2, §5)', () => {
  it('le menu est fermé par défaut', () => {
    renderMenu()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('ouvre le menu au clic et affiche les éléments', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Réglages' })).toBeInTheDocument()
  })

  it('cliquer un élément le referme et appelle son onClick', async () => {
    const user = userEvent.setup()
    const { onClick } = renderMenu()

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Réglages' }))

    expect(onClick).toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Échap referme le menu', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('un clic à l’extérieur referme le menu', async () => {
    const user = userEvent.setup()
    render(
      <ExtrasSettingsProvider>
        <button type="button">Ailleurs</button>
        <MobileMenu items={[{ key: 'settings', icon: Settings, label: 'Réglages', onClick: vi.fn() }]} />
      </ExtrasSettingsProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ailleurs' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
