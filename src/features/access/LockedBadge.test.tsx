import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AuthStub } from './AuthStub'
import { LockedBadge } from './LockedBadge'
import { LockedBlock } from './LockedBlock'
import { UpsellContext } from './upsell-context'

describe('LockedBadge', () => {
  it('affiche un cadenas décoratif (caché aux lecteurs d’écran)', () => {
    render(<LockedBadge />)
    expect(screen.getByTestId('locked-badge')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('LockedBlock', () => {
  it('reste atteignable, porte un aria-label « verrouillé » et ouvre la modale au clic', async () => {
    const user = userEvent.setup()
    const openUpsell = vi.fn()
    render(
      <AuthStub>
        <UpsellContext.Provider
          value={{ isOpen: false, feature: null, openUpsell, closeUpsell: vi.fn() }}
        >
          <LockedBlock feature="stats" title="Statistiques" />
        </UpsellContext.Provider>
      </AuthStub>,
    )

    const button = screen.getByRole('button', {
      name: 'Statistiques, verrouillé : crée un compte pour débloquer',
    })
    expect(button).not.toBeDisabled()
    await user.click(button)
    expect(openUpsell).toHaveBeenCalledWith('stats')
  })
})
