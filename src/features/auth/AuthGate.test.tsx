import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AuthGate } from './AuthGate'
import { AuthGateRequestProvider } from './AuthGateRequestProvider'
import { useAuthGateRequest } from './useAuthGateRequest'

const useAuthMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

function baseAuth(overrides: Record<string, unknown> = {}) {
  return {
    status: 'guest',
    isSupabaseConfigured: true,
    signInWithEmail: vi.fn(),
    signInWithGoogle: vi.fn(),
    signUpWithEmail: vi.fn().mockResolvedValue({ needsEmailConfirmation: true }),
    resendConfirmationEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    ...overrides,
  }
}

function renderGate() {
  return render(
    <ToastProvider>
      <AuthGate>
        <p>Contenu de l’app</p>
      </AuthGate>
    </ToastProvider>,
  )
}

beforeEach(() => {
  useAuthMock.mockReset()
  try {
    window.sessionStorage.clear()
  } catch {
    // sans conséquence pour le test
  }
})

describe('AuthGate — fenêtre plein écran de connexion (LOT A)', () => {
  it('affiche la fenêtre en mode invité, Supabase configuré, sans jamais démonter le contenu', () => {
    useAuthMock.mockReturnValue(baseAuth())
    renderGate()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Contenu de l’app')).toBeInTheDocument()
  })

  it('ne s’affiche jamais si Supabase n’est pas configuré', () => {
    useAuthMock.mockReturnValue(baseAuth({ isSupabaseConfigured: false }))
    renderGate()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ne s’affiche jamais pendant la vérification de la session', () => {
    useAuthMock.mockReturnValue(baseAuth({ status: 'loading' }))
    renderGate()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ne s’affiche jamais à un utilisateur connecté', () => {
    useAuthMock.mockReturnValue(baseAuth({ status: 'authenticated' }))
    renderGate()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('« Continuer sans compte » ferme la fenêtre et la mémorise pour la session', async () => {
    useAuthMock.mockReturnValue(baseAuth())
    const user = userEvent.setup()
    const { unmount } = renderGate()

    await user.click(screen.getByRole('button', { name: 'Continuer sans compte' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    unmount()
    renderGate()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('« Se connecter » ouvre le formulaire de connexion', async () => {
    useAuthMock.mockReturnValue(baseAuth())
    const user = userEvent.setup()
    renderGate()

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
  })

  it('« Créer un compte » ouvre le formulaire d’inscription', async () => {
    useAuthMock.mockReturnValue(baseAuth())
    const user = userEvent.setup()
    renderGate()

    await user.click(screen.getByRole('button', { name: 'Créer un compte' }))
    expect(screen.getByLabelText('Pseudo')).toBeInTheDocument()
  })

  it('« Retour » revient à l’écran de choix', async () => {
    useAuthMock.mockReturnValue(baseAuth())
    const user = userEvent.setup()
    renderGate()

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    await user.click(screen.getByRole('button', { name: 'Retour' }))

    expect(screen.getByRole('button', { name: 'Créer un compte' })).toBeInTheDocument()
  })
})

function RequestSignInButton({ view }: { view?: 'signIn' | 'signUp' }) {
  const { requestSignIn } = useAuthGateRequest()
  return (
    <button type="button" onClick={() => requestSignIn(view)}>
      {view === 'signUp' ? 'Demander l’inscription' : 'Déclencher depuis un écran social'}
    </button>
  )
}

describe('AuthGate — réouverture depuis un écran social (LOT H1, §3)', () => {
  it('useAuthGateRequest() rouvre directement le formulaire de connexion après « continuer sans compte »', async () => {
    useAuthMock.mockReturnValue(baseAuth())
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <AuthGateRequestProvider>
          <AuthGate>
            <p>Contenu de l’app</p>
          </AuthGate>
          <RequestSignInButton />
        </AuthGateRequestProvider>
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Continuer sans compte' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Déclencher depuis un écran social' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
  })

  it('sans AuthGateRequestProvider, requestSignIn() ne fait rien (pas d’erreur)', () => {
    useAuthMock.mockReturnValue(baseAuth())
    renderGate()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('AuthGate — vue demandée (mode invité, modale d’upsell)', () => {
  it("requestSignIn('signUp') ouvre directement le formulaire d’inscription", async () => {
    useAuthMock.mockReturnValue(baseAuth())
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <AuthGateRequestProvider>
          <AuthGate>
            <p>Contenu de l’app</p>
          </AuthGate>
          <RequestSignInButton view="signUp" />
        </AuthGateRequestProvider>
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Continuer sans compte' }))
    await user.click(screen.getByRole('button', { name: 'Demander l’inscription' }))

    expect(screen.getByLabelText('Pseudo')).toBeInTheDocument()
  })
})

describe('AuthGate — reconnexion discrète (LOT 2)', () => {
  it('affiche « Reconnexion… » sans fermer l’application ni ouvrir la fenêtre de connexion', () => {
    useAuthMock.mockReturnValue(baseAuth({ status: 'authenticated', isReconnecting: true }))
    renderGate()

    expect(screen.getByRole('status')).toHaveTextContent('Reconnexion…')
    expect(screen.getByText('Contenu de l’app')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('n’affiche rien quand la connexion est stable', () => {
    useAuthMock.mockReturnValue(baseAuth({ status: 'authenticated' }))
    renderGate()
    expect(screen.queryByText('Reconnexion…')).not.toBeInTheDocument()
  })
})
