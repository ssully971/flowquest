import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/shared/design-system'

import { SettingsPanel } from './SettingsPanel'

function renderPanel(open: boolean) {
  const onClose = vi.fn()
  render(
    <ThemeProvider>
      <button type="button">Déclencheur</button>
      <SettingsPanel
        open={open}
        onClose={onClose}
        mode="home"
        onModeChange={vi.fn()}
        backgroundSelection={{ home: 'horizon', focus: 'horizon' }}
        onBackgroundSelect={vi.fn()}
      />
    </ThemeProvider>,
  )
  return { onClose }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('SettingsPanel — ouverture et fermeture', () => {
  it('ne rend rien quand il est fermé', () => {
    renderPanel(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('s’ouvre et place le focus sur le bouton de fermeture', async () => {
    renderPanel(true)
    const dialog = await screen.findByRole('dialog', { name: 'Réglages' })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Fermer les réglages' })).toHaveFocus()
    })
    expect(dialog).toBeInTheDocument()
  })

  it('le clic sur le fond assombri ferme le panneau', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPanel(true)
    await screen.findByRole('dialog')

    const scrim = document.querySelector('[style*="--scrim"]') as HTMLElement
    await user.click(scrim)
    expect(onClose).toHaveBeenCalled()
  })

  it('Échap ferme le panneau', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPanel(true)
    await screen.findByRole('dialog')

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('SettingsPanel — piège de focus clavier', () => {
  it('Tab ne sort jamais du panneau tant qu’il est ouvert', async () => {
    const user = userEvent.setup()
    renderPanel(true)
    await screen.findByRole('dialog')

    for (let i = 0; i < 20; i++) {
      await user.tab()
    }

    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('Shift+Tab depuis le premier élément revient sur le dernier', async () => {
    const user = userEvent.setup()
    renderPanel(true)
    const dialog = await screen.findByRole('dialog')

    // Attend que le focus initial (bouton de fermeture) se soit posé avant de
    // le redéplacer manuellement, pour éviter une course avec cet effet.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Fermer les réglages' })).toHaveFocus()
    })

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    focusable[0].focus()

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(focusable[focusable.length - 1])
  })
})
