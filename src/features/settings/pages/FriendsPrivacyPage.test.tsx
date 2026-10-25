import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FriendsPrivacyPage } from './FriendsPrivacyPage'

const useAuthMock = vi.fn()
const requestSignInMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('@/features/auth/useAuthGateRequest', () => ({
  useAuthGateRequest: () => ({ signInRequested: false, requestSignIn: requestSignInMock, clearSignInRequest: vi.fn() }),
}))

const PROFILE = {
  id: 'u1',
  username: 'moi',
  invisible_mode: false,
  show_live_status: true,
  show_total_time_score: true,
  participate_leaderboard: true,
}

beforeEach(() => {
  useAuthMock.mockReset()
  requestSignInMock.mockReset()
})

describe('FriendsPrivacyPage — état invité (LOT H1, §3)', () => {
  it('invite à se connecter plutôt que de rester vide quand on n’est pas connecté', () => {
    useAuthMock.mockReturnValue({ status: 'guest', profile: null, updateProfile: vi.fn() })
    render(<FriendsPrivacyPage />)

    expect(screen.getByText(/Connecte-toi pour accéder aux amis/)).toBeInTheDocument()
    expect(screen.queryByText('Mode invisible')).not.toBeInTheDocument()
  })

  it('« Se connecter » déclenche la réouverture de l’écran de connexion', async () => {
    useAuthMock.mockReturnValue({ status: 'guest', profile: null, updateProfile: vi.fn() })
    const user = userEvent.setup()
    render(<FriendsPrivacyPage />)

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(requestSignInMock).toHaveBeenCalled()
  })

  it('affiche les réglages normalement une fois connecté', () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: PROFILE, updateProfile: vi.fn() })
    render(<FriendsPrivacyPage />)

    expect(screen.getByText('Mode invisible')).toBeInTheDocument()
    expect(screen.queryByText(/Connecte-toi/)).not.toBeInTheDocument()
  })
})
