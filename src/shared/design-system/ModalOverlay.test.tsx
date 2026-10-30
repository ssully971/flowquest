import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ModalOverlay } from './ModalOverlay'

afterEach(() => {
  vi.useRealTimers()
})

describe('ModalOverlay — cadre défilant des fenêtres modales', () => {
  it('le conteneur défile et la carte se centre seulement quand elle tient (marges verticales automatiques)', () => {
    render(
      <ModalOverlay className="z-[70]" backdropTestId="overlay">
        <div role="dialog">Carte</div>
      </ModalOverlay>,
    )
    const inner = screen.getByTestId('overlay')
    expect(inner.parentElement?.className).toContain('overflow-y-auto')
    expect(inner.parentElement?.className).toContain('z-[70]')
    expect(inner.className).toContain('min-h-full')
    expect(inner.className).toContain('[&>*]:my-auto')
    // Marges de sécurité (encoche, barre d'accueil).
    expect(inner.className).toContain('safe-area-inset-top')
    expect(inner.className).toContain('safe-area-inset-bottom')
  })

  it('un clic sur le fond (hors de la carte) appelle onBackdropClick, un clic sur la carte non', async () => {
    const user = userEvent.setup()
    const onBackdropClick = vi.fn()
    render(
      <ModalOverlay onBackdropClick={onBackdropClick} backdropTestId="overlay">
        <div role="dialog">Carte</div>
      </ModalOverlay>,
    )

    await user.click(screen.getByRole('dialog'))
    expect(onBackdropClick).not.toHaveBeenCalled()
    await user.click(screen.getByTestId('overlay'))
    expect(onBackdropClick).toHaveBeenCalledTimes(1)
  })

  it('ramène dans la vue le champ qui prend le focus, une fois le clavier ouvert', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <ModalOverlay>
        <form role="dialog">
          <label>
            Pseudo
            <input />
          </label>
          <button type="button">Valider</button>
        </form>
      </ModalOverlay>,
    )

    await user.click(screen.getByLabelText('Pseudo'))
    expect(scrollIntoView).not.toHaveBeenCalled() // pas avant que le clavier ait fini de s'ouvrir
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })

    scrollIntoView.mockClear()
    await user.click(screen.getByRole('button', { name: 'Valider' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })
    expect(scrollIntoView).not.toHaveBeenCalled() // un bouton n'est pas un champ de saisie
  })
})
