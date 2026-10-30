import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthStub } from './AuthStub'
import { UpsellModal } from './UpsellModal'

const betaFlag = vi.hoisted(() => ({ value: true }))
vi.mock('@/features/feature-flags/useFeatureFlag', () => ({
  useFeatureFlag: () => betaFlag.value,
}))

function setup() {
  const handlers = { onClose: vi.fn(), onSignUp: vi.fn(), onSignIn: vi.fn() }
  render(
    <AuthStub>
      <button type="button">Déclencheur</button>
      <UpsellModal {...handlers} />
    </AuthStub>,
  )
  return handlers
}

beforeEach(() => {
  betaFlag.value = true
  document.body.style.overflow = ''
})

describe('UpsellModal', () => {
  it('affiche le titre, le texte et trois boutons, avec une boîte de dialogue accessible', () => {
    setup()

    const dialog = screen.getByRole('dialog', { name: /Débloque le plein potentiel de Fokitsu/ })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText(/mixeur de sons/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'S’inscrire (J’ai un code)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plus tard' })).toBeInTheDocument()
  })

  it('donne le focus au bouton principal et bloque le défilement de l’arrière-plan', () => {
    setup()
    expect(screen.getByRole('button', { name: 'S’inscrire (J’ai un code)' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('appelle le bon gestionnaire pour chaque bouton', async () => {
    const user = userEvent.setup()
    const handlers = setup()

    await user.click(screen.getByRole('button', { name: 'S’inscrire (J’ai un code)' }))
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    await user.click(screen.getByRole('button', { name: 'Plus tard' }))

    expect(handlers.onSignUp).toHaveBeenCalledTimes(1)
    expect(handlers.onSignIn).toHaveBeenCalledTimes(1)
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
  })

  it('se ferme avec Échap et au clic sur le fond', async () => {
    const user = userEvent.setup()
    const handlers = setup()

    await user.keyboard('{Escape}')
    expect(handlers.onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByTestId('upsell-backdrop'))
    expect(handlers.onClose).toHaveBeenCalledTimes(2)
  })

  it('piège le focus (Tab depuis le dernier bouton revient au premier, Maj+Tab inversement)', async () => {
    const user = userEvent.setup()
    setup()

    const first = screen.getByRole('button', { name: 'S’inscrire (J’ai un code)' })
    const last = screen.getByRole('button', { name: 'Plus tard' })
    last.focus()
    await user.tab()
    expect(first).toHaveFocus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
  })

  it('affiche la mention de bêta fermée seulement si la bêta est fermée', () => {
    setup()
    expect(
      screen.getByText(
        'Attention : Fokitsu est actuellement en bêta fermée. Un code d’invitation est requis pour s’inscrire.',
      ),
    ).toBeInTheDocument()
  })

  it('masque la mention quand la bêta est rouverte', () => {
    betaFlag.value = false
    setup()
    expect(screen.queryByText(/bêta fermée/)).not.toBeInTheDocument()
  })
})
