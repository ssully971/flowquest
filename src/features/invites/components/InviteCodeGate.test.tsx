import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InviteCodeGate } from './InviteCodeGate'

const authState = {
  status: 'authenticated',
  profile: { invite_ok: false } as { invite_ok: boolean } | null,
  retryLoadProfile: vi.fn(),
  signOut: vi.fn(),
}
let betaClosed = true
const consumeMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/features/feature-flags/useFeatureFlag', () => ({ useFeatureFlag: () => betaClosed }))
vi.mock('../invites-repository', () => ({
  consumeInviteCode: (...args: unknown[]) => consumeMock(...args),
}))

function renderGate() {
  return render(
    <InviteCodeGate>
      <p>contenu de l’app</p>
    </InviteCodeGate>,
  )
}

describe('InviteCodeGate — compte Google en attente', () => {
  beforeEach(() => {
    authState.status = 'authenticated'
    authState.profile = { invite_ok: false }
    authState.retryLoadProfile.mockReset()
    authState.signOut.mockReset()
    consumeMock.mockReset()
    betaClosed = true
  })

  it('ne bloque pas un compte existant ou actif', () => {
    authState.profile = { invite_ok: true }
    renderGate()
    expect(screen.getByText('contenu de l’app')).toBeInTheDocument()
  })

  it('ne bloque pas un invité non connecté', () => {
    authState.status = 'guest'
    authState.profile = null
    renderGate()
    expect(screen.getByText('contenu de l’app')).toBeInTheDocument()
  })

  it('remplace l’app par l’écran de saisie tant que le compte est en attente', () => {
    renderGate()
    expect(screen.getByText('Entre ton code d’invitation')).toBeInTheDocument()
    expect(screen.queryByText('contenu de l’app')).not.toBeInTheDocument()
  })

  it('code accepté : recharge le profil', async () => {
    const user = userEvent.setup()
    consumeMock.mockResolvedValue(true)
    renderGate()

    await user.type(screen.getByLabelText('Code d’invitation'), 'abcd2345')
    await user.click(screen.getByRole('button', { name: 'Activer mon compte' }))

    await waitFor(() => expect(authState.retryLoadProfile).toHaveBeenCalled())
    expect(consumeMock).toHaveBeenCalledWith('ABCD2345')
  })

  it('code refusé : message générique, compte toujours bloqué', async () => {
    const user = userEvent.setup()
    consumeMock.mockResolvedValue(false)
    renderGate()

    await user.type(screen.getByLabelText('Code d’invitation'), 'ABCD2345')
    await user.click(screen.getByRole('button', { name: 'Activer mon compte' }))

    expect(await screen.findByText('Code invalide ou expiré.')).toBeInTheDocument()
    expect(authState.retryLoadProfile).not.toHaveBeenCalled()
  })

  it('saisie de mauvaise forme : refusée sans appel serveur', async () => {
    const user = userEvent.setup()
    renderGate()

    await user.type(screen.getByLabelText('Code d’invitation'), 'ab')
    await user.click(screen.getByRole('button', { name: 'Activer mon compte' }))

    expect(await screen.findByText('Code invalide ou expiré.')).toBeInTheDocument()
    expect(consumeMock).not.toHaveBeenCalled()
  })

  it('bêta rouverte : le compte en attente est activé automatiquement', async () => {
    betaClosed = false
    consumeMock.mockResolvedValue(true)
    renderGate()

    await waitFor(() => expect(authState.retryLoadProfile).toHaveBeenCalled())
    expect(consumeMock).toHaveBeenCalledWith('')
  })
})
