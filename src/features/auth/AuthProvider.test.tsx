import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

const getSessionMock = vi.fn()
const onAuthStateChangeMock = vi.fn()
const fromMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
    },
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

const SESSION_USER = { id: 'user-1', email: 'sullivan@exemple.com' }
const PROFILE_ROW = {
  id: 'user-1',
  username: 'sullivan',
  display_name: null,
  avatar_url: null,
  role: 'user',
  timezone: 'Europe/Paris',
  stats_visibility: 'public',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

function selectQuery(result: { data: unknown; error: unknown }) {
  return { select: () => ({ eq: () => ({ single: () => Promise.resolve(result) }) }) }
}

function ProbeAccountState() {
  const { profileState, profile, profileError, retryLoadProfile } = useAuth()
  return (
    <div>
      <span data-testid="profile-state">{profileState}</span>
      <span data-testid="profile-username">{profile?.username ?? ''}</span>
      <span data-testid="profile-error">{profileError ?? ''}</span>
      <button type="button" onClick={retryLoadProfile}>
        Réessayer
      </button>
    </div>
  )
}

function renderProbe() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <ProbeAccountState />
      </AuthProvider>
    </ToastProvider>,
  )
}

beforeEach(() => {
  getSessionMock.mockReset()
  onAuthStateChangeMock.mockReset()
  fromMock.mockReset()
  rpcMock.mockReset()
  getSessionMock.mockResolvedValue({ data: { session: { user: SESSION_USER } } })
  onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})

describe('AuthProvider — profil manquant (reproduction du bug « Impossible de charger ton profil »)', () => {
  it('se répare tout seul quand la ligne profiles n’existe pas encore (ensure_profile réussit)', async () => {
    fromMock.mockReturnValue(
      selectQuery({
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned' },
      }),
    )
    rpcMock.mockResolvedValue({ data: PROFILE_ROW, error: null })

    renderProbe()

    await waitFor(() => {
      expect(screen.getByTestId('profile-state')).toHaveTextContent('loaded')
    })
    expect(screen.getByTestId('profile-username')).toHaveTextContent('sullivan')
    expect(rpcMock).toHaveBeenCalledWith('ensure_profile')
  })

  it('passe en état d’erreur explicite (jamais silencieux) si ensure_profile échoue aussi', async () => {
    fromMock.mockReturnValue(selectQuery({ data: null, error: { message: 'no rows' } }))
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'function ensure_profile() does not exist' },
    })

    renderProbe()

    await waitFor(() => {
      expect(screen.getByTestId('profile-state')).toHaveTextContent('error')
    })
    expect(screen.getByTestId('profile-error').textContent).not.toBe('')
  })

  it('le bouton Réessayer relance le chargement et peut récupérer après correction côté serveur', async () => {
    fromMock.mockReturnValue(selectQuery({ data: null, error: { message: 'no rows' } }))
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'down' } })

    const { user } = await import('@testing-library/user-event').then((m) => ({
      user: m.default.setup(),
    }))
    renderProbe()

    await waitFor(() => {
      expect(screen.getByTestId('profile-state')).toHaveTextContent('error')
    })

    rpcMock.mockResolvedValueOnce({ data: PROFILE_ROW, error: null })
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))

    await waitFor(() => {
      expect(screen.getByTestId('profile-state')).toHaveTextContent('loaded')
    })
  })

  it('charge directement le profil quand la ligne existe déjà (chemin normal, pas de self-heal)', async () => {
    fromMock.mockReturnValue(selectQuery({ data: PROFILE_ROW, error: null }))

    renderProbe()

    await waitFor(() => {
      expect(screen.getByTestId('profile-state')).toHaveTextContent('loaded')
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
