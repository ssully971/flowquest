import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AuthProvider } from '../AuthProvider'
import { SignUpForm } from './SignUpForm'

const signUpMock = vi.fn()
const resendMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('@/features/feature-flags/useFeatureFlag', () => ({ useFeatureFlag: () => true }))

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signUp: (...args: unknown[]) => signUpMock(...args),
      resend: (...args: unknown[]) => resendMock(...args),
    },
    from: vi.fn(),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

function renderForm() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <SignUpForm onSwitchToSignIn={vi.fn()} />
      </AuthProvider>
    </ToastProvider>,
  )
}

beforeEach(() => {
  signUpMock.mockReset()
  resendMock.mockReset()
  rpcMock.mockReset()
  // Pseudo disponible par défaut : évite que le debounce de vérification en direct
  // (useUsernameAvailability) plante faute de réponse mockée.
  rpcMock.mockResolvedValue({ data: true, error: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SignUpForm — consentement marketing (lot I1, §3)', () => {
  it('décochée par défaut : marketing_consent=false transmis à l’inscription', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null })
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Pseudo'), 'sullivan_97')
    await user.type(screen.getByLabelText('E-mail'), 'sullivan@exemple.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'Secret123')
    await user.type(screen.getByLabelText('Code d’invitation'), 'abcd2345')
    expect(screen.getByText('Je souhaite recevoir les nouveautés par e-mail')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    await screen.findByText('Compte créé ! Un e-mail de confirmation vient de partir.')
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ marketing_consent: false }),
        }),
      }),
    )
  })

  it('cochée explicitement : marketing_consent=true transmis à l’inscription', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null })
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Pseudo'), 'sullivan_97')
    await user.type(screen.getByLabelText('E-mail'), 'sullivan@exemple.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'Secret123')
    await user.type(screen.getByLabelText('Code d’invitation'), 'abcd2345')
    await user.click(screen.getByText('Je souhaite recevoir les nouveautés par e-mail'))
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    await screen.findByText('Compte créé ! Un e-mail de confirmation vient de partir.')
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ marketing_consent: true }),
        }),
      }),
    )
  })

  it('affiche un lien vers les conditions et la politique de confidentialité', () => {
    renderForm()
    expect(screen.getByRole('link', { name: 'conditions' })).toHaveAttribute('href', '/conditions')
    expect(screen.getByRole('link', { name: 'politique de confidentialité' })).toHaveAttribute(
      'href',
      '/confidentialite',
    )
  })
})

describe('SignUpForm — renvoi de l’e-mail de confirmation avec délai (LOT 1)', () => {
  it('affiche le message honnête et un bouton de renvoi après inscription', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null })
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Pseudo'), 'sullivan_97')
    await user.type(screen.getByLabelText('E-mail'), 'sullivan@exemple.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'Secret123')
    await user.type(screen.getByLabelText('Code d’invitation'), 'abcd2345')
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(
      await screen.findByText('Compte créé ! Un e-mail de confirmation vient de partir.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Pense à vérifier tes spams/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Renvoyer l’e-mail' })).toBeEnabled()
  })

  it('désactive le bouton pendant le délai après un renvoi, puis le réactive', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null })
    resendMock.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderForm()

    // Saisie et inscription sur de vrais timers (findBy fonctionne normalement ici).
    await user.type(screen.getByLabelText('Pseudo'), 'sullivan_97')
    await user.type(screen.getByLabelText('E-mail'), 'sullivan@exemple.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'Secret123')
    await user.type(screen.getByLabelText('Code d’invitation'), 'abcd2345')
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
    await screen.findByRole('button', { name: 'Renvoyer l’e-mail' })

    // Le décompte du délai utilise un setInterval : on bascule sur des timers simulés
    // juste pour cette partie, avec fireEvent (purement synchrone, sans timer interne)
    // plutôt que userEvent, et sans findBy/waitFor (qui dépendent de vrais timers pour
    // relancer leurs tentatives).
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Renvoyer l’e-mail' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(resendMock).toHaveBeenCalledWith({
      type: 'signup',
      email: 'sullivan@exemple.com',
      options: { emailRedirectTo: expect.any(String) },
    })
    expect(screen.getByRole('button', { name: /Renvoyer dans 45 s/ })).toBeDisabled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000)
    })
    expect(screen.getByRole('button', { name: 'Renvoyer l’e-mail' })).toBeEnabled()
  })
})

describe('SignUpForm — bêta fermée (code d’invitation)', () => {
  async function fillCommon(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Pseudo'), 'sullivan_97')
    await user.type(screen.getByLabelText('E-mail'), 'sullivan@exemple.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'Secret123')
  }

  it('refuse l’envoi sans code, sans appeler signUp', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillCommon(user)

    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(
      await screen.findByText('Entre ton code d’invitation pour créer un compte.'),
    ).toBeInTheDocument()
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('normalise le code (majuscules) et l’envoie dans les metadata du signUp', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null })
    const user = userEvent.setup()
    renderForm()
    await fillCommon(user)
    await user.type(screen.getByLabelText('Code d’invitation'), '  abcd-2345 ')

    expect(screen.getByLabelText('Code d’invitation')).toHaveValue('ABCD2345')
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    await screen.findByText('Compte créé ! Un e-mail de confirmation vient de partir.')
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ invite_code: 'ABCD2345' }),
        }),
      }),
    )
  })

  it('vérifie le code en direct : valide puis invalide, avec un message générique', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Code d’invitation'), 'ABCD2345')
    expect(await screen.findByText('Code valide.')).toBeInTheDocument()
    expect(rpcMock).toHaveBeenCalledWith('check_invite_code', { p_code: 'ABCD2345' })

    rpcMock.mockImplementation((name: string) =>
      Promise.resolve({ data: name === 'check_invite_code' ? false : true, error: null }),
    )
    await user.clear(screen.getByLabelText('Code d’invitation'))
    await user.type(screen.getByLabelText('Code d’invitation'), 'ZZZZ2345')
    expect(await screen.findByText('Code invalide ou expiré.')).toBeInTheDocument()
  })

  it('traduit le refus du serveur en message générique (jamais la raison réelle)', async () => {
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: { message: 'Database error saving new user' },
    })
    const user = userEvent.setup()
    renderForm()
    await fillCommon(user)
    await user.type(screen.getByLabelText('Code d’invitation'), 'ABCD2345')
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText('Code invalide ou expiré.')).toBeInTheDocument()
  })
})
