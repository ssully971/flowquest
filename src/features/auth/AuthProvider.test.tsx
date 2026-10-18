import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

const getSessionMock = vi.fn()
const onAuthStateChangeMock = vi.fn()
const fromMock = vi.fn()
const rpcMock = vi.fn()
const resendMock = vi.fn()
const resetPasswordForEmailMock = vi.fn()
const updateUserMock = vi.fn()
const signInWithIdTokenMock = vi.fn()
const signOutMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
      resend: (...args: unknown[]) => resendMock(...args),
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmailMock(...args),
      updateUser: (...args: unknown[]) => updateUserMock(...args),
      signInWithIdToken: (...args: unknown[]) => signInWithIdTokenMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
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
  const {
    profileState,
    profile,
    profileError,
    retryLoadProfile,
    isPasswordRecovery,
    resendConfirmationEmail,
    requestPasswordReset,
    updatePassword,
    clearPasswordRecovery,
    signInWithGoogleIdToken,
    deleteAccount,
  } = useAuth()
  return (
    <div>
      <span data-testid="profile-state">{profileState}</span>
      <span data-testid="profile-username">{profile?.username ?? ''}</span>
      <span data-testid="profile-error">{profileError ?? ''}</span>
      <span data-testid="password-recovery">{String(isPasswordRecovery)}</span>
      <button type="button" onClick={retryLoadProfile}>
        Réessayer
      </button>
      <button type="button" onClick={() => void resendConfirmationEmail('sullivan@exemple.com')}>
        Renvoyer
      </button>
      <button type="button" onClick={() => void requestPasswordReset('sullivan@exemple.com')}>
        Demander une réinitialisation
      </button>
      <button type="button" onClick={() => void updatePassword('Nouveau1234')}>
        Mettre à jour le mot de passe
      </button>
      <button type="button" onClick={clearPasswordRecovery}>
        Annuler la réinitialisation
      </button>
      <button
        type="button"
        onClick={() => void signInWithGoogleIdToken('fake-id-token', 'fake-nonce')}
      >
        Connexion Google (ID token)
      </button>
      <button type="button" onClick={() => void deleteAccount()}>
        Supprimer le compte
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
  resendMock.mockReset()
  resetPasswordForEmailMock.mockReset()
  updateUserMock.mockReset()
  signInWithIdTokenMock.mockReset()
  signOutMock.mockReset()
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

describe('AuthProvider — ne relance pas loadProfile à chaque évènement (bug de la popup en boucle après Google)', () => {
  it('ne recharge le profil qu’une fois même si plusieurs évènements onAuthStateChange arrivent coup sur coup pour le même utilisateur', async () => {
    fromMock.mockReturnValue(selectQuery({ data: PROFILE_ROW, error: null }))

    renderProbe()
    await waitFor(() => {
      expect(screen.getByTestId('profile-state')).toHaveTextContent('loaded')
    })
    expect(fromMock).toHaveBeenCalledTimes(1)

    // Simule les évènements successifs que Supabase émet coup sur coup pour la même
    // session après un retour OAuth (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED…).
    const authStateCallback = onAuthStateChangeMock.mock.calls[0][0] as (
      event: string,
      session: unknown,
    ) => void
    authStateCallback('SIGNED_IN', { user: SESSION_USER })
    authStateCallback('TOKEN_REFRESHED', { user: SESSION_USER })

    await waitFor(() => {
      expect(screen.getByTestId('profile-state')).toHaveTextContent('loaded')
    })
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('n’affiche l’erreur de chargement qu’une seule fois malgré plusieurs évènements', async () => {
    fromMock.mockReturnValue(selectQuery({ data: null, error: { message: 'no rows' } }))
    rpcMock.mockResolvedValue({ data: null, error: { message: 'down' } })

    renderProbe()
    await waitFor(() => {
      expect(screen.getByTestId('profile-state')).toHaveTextContent('error')
    })
    expect(rpcMock).toHaveBeenCalledTimes(1)

    const authStateCallback = onAuthStateChangeMock.mock.calls[0][0] as (
      event: string,
      session: unknown,
    ) => void
    authStateCallback('SIGNED_IN', { user: SESSION_USER })
    authStateCallback('SIGNED_IN', { user: SESSION_USER })

    await waitFor(() => {
      expect(screen.getByTestId('profile-state')).toHaveTextContent('error')
    })
    expect(rpcMock).toHaveBeenCalledTimes(1)
  })
})

describe('AuthProvider — renvoi d’e-mail et réinitialisation du mot de passe (LOT 1)', () => {
  it('renvoie l’e-mail de confirmation via supabase.auth.resend', async () => {
    fromMock.mockReturnValue(selectQuery({ data: PROFILE_ROW, error: null }))
    resendMock.mockResolvedValue({ error: null })
    const user = await import('@testing-library/user-event').then((m) => m.default.setup())

    renderProbe()
    await waitFor(() => expect(screen.getByTestId('profile-state')).toHaveTextContent('loaded'))

    await user.click(screen.getByRole('button', { name: 'Renvoyer' }))
    expect(resendMock).toHaveBeenCalledWith({
      type: 'signup',
      email: 'sullivan@exemple.com',
    })
  })

  it('demande une réinitialisation via supabase.auth.resetPasswordForEmail', async () => {
    fromMock.mockReturnValue(selectQuery({ data: PROFILE_ROW, error: null }))
    resetPasswordForEmailMock.mockResolvedValue({ error: null })
    const user = await import('@testing-library/user-event').then((m) => m.default.setup())

    renderProbe()
    await waitFor(() => expect(screen.getByTestId('profile-state')).toHaveTextContent('loaded'))

    await user.click(screen.getByRole('button', { name: 'Demander une réinitialisation' }))
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
      'sullivan@exemple.com',
      expect.objectContaining({ redirectTo: expect.any(String) }),
    )
  })

  it('passe en mode récupération sur l’évènement PASSWORD_RECOVERY, et peut en sortir', async () => {
    fromMock.mockReturnValue(selectQuery({ data: PROFILE_ROW, error: null }))
    const user = await import('@testing-library/user-event').then((m) => m.default.setup())

    renderProbe()
    await waitFor(() => expect(screen.getByTestId('profile-state')).toHaveTextContent('loaded'))
    expect(screen.getByTestId('password-recovery')).toHaveTextContent('false')

    const authStateCallback = onAuthStateChangeMock.mock.calls[0][0] as (
      event: string,
      session: unknown,
    ) => void
    act(() => authStateCallback('PASSWORD_RECOVERY', { user: SESSION_USER }))
    expect(screen.getByTestId('password-recovery')).toHaveTextContent('true')

    await user.click(screen.getByRole('button', { name: 'Annuler la réinitialisation' }))
    expect(screen.getByTestId('password-recovery')).toHaveTextContent('false')
  })

  it('met à jour le mot de passe et quitte le mode récupération en cas de succès', async () => {
    fromMock.mockReturnValue(selectQuery({ data: PROFILE_ROW, error: null }))
    updateUserMock.mockResolvedValue({ error: null })
    const user = await import('@testing-library/user-event').then((m) => m.default.setup())

    renderProbe()
    await waitFor(() => expect(screen.getByTestId('profile-state')).toHaveTextContent('loaded'))

    const authStateCallback = onAuthStateChangeMock.mock.calls[0][0] as (
      event: string,
      session: unknown,
    ) => void
    act(() => authStateCallback('PASSWORD_RECOVERY', { user: SESSION_USER }))
    expect(screen.getByTestId('password-recovery')).toHaveTextContent('true')

    await user.click(screen.getByRole('button', { name: 'Mettre à jour le mot de passe' }))
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'Nouveau1234' })
    await waitFor(() => expect(screen.getByTestId('password-recovery')).toHaveTextContent('false'))
  })

  it('se connecte via signInWithIdToken (Google Identity Services)', async () => {
    fromMock.mockReturnValue(selectQuery({ data: PROFILE_ROW, error: null }))
    signInWithIdTokenMock.mockResolvedValue({ error: null })
    const user = await import('@testing-library/user-event').then((m) => m.default.setup())

    renderProbe()
    await waitFor(() => expect(screen.getByTestId('profile-state')).toHaveTextContent('loaded'))

    await user.click(screen.getByRole('button', { name: 'Connexion Google (ID token)' }))
    expect(signInWithIdTokenMock).toHaveBeenCalledWith({
      provider: 'google',
      token: 'fake-id-token',
      nonce: 'fake-nonce',
    })
  })

  it('supprime le compte via delete_own_account puis repasse en invité', async () => {
    fromMock.mockReturnValue(selectQuery({ data: PROFILE_ROW, error: null }))
    rpcMock.mockResolvedValue({ data: null, error: null })
    signOutMock.mockResolvedValue({ error: null })
    const user = await import('@testing-library/user-event').then((m) => m.default.setup())

    renderProbe()
    await waitFor(() => expect(screen.getByTestId('profile-state')).toHaveTextContent('loaded'))

    await user.click(screen.getByRole('button', { name: 'Supprimer le compte' }))
    expect(rpcMock).toHaveBeenCalledWith('delete_own_account')
    await waitFor(() => expect(signOutMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('profile-state')).toHaveTextContent('idle'))
    expect(screen.getByTestId('profile-username')).toHaveTextContent('')
  })
})
