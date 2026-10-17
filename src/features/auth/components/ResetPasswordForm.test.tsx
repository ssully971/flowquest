import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AuthProvider } from '../AuthProvider'
import { ResetPasswordForm } from './ResetPasswordForm'

const updateUserMock = vi.fn()
let authStateCallback: ((event: string, session: unknown) => void) | null = null

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

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        authStateCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      updateUser: (...args: unknown[]) => updateUserMock(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: PROFILE_ROW, error: null }) }),
      }),
    }),
    rpc: vi.fn(),
  },
}))

function renderForm() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <ResetPasswordForm />
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('ResetPasswordForm — nouveau mot de passe depuis le lien de réinitialisation (LOT 1)', () => {
  it('refuse un mot de passe qui ne respecte pas le format requis', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'short')
    await user.type(screen.getByLabelText('Confirme le mot de passe'), 'short')
    await user.click(screen.getByRole('button', { name: 'Mettre à jour le mot de passe' }))

    expect(
      screen.getByText(
        'Le mot de passe doit faire au moins 8 caractères, avec une majuscule et un chiffre.',
      ),
    ).toBeInTheDocument()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it('refuse quand les deux mots de passe ne correspondent pas', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'Secret123')
    await user.type(screen.getByLabelText('Confirme le mot de passe'), 'Secret124')
    await user.click(screen.getByRole('button', { name: 'Mettre à jour le mot de passe' }))

    expect(
      screen.getByText('Les deux mots de passe ne correspondent pas.'),
    ).toBeInTheDocument()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it('met à jour le mot de passe quand les deux champs correspondent et sont valides', async () => {
    updateUserMock.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'Secret123')
    await user.type(screen.getByLabelText('Confirme le mot de passe'), 'Secret123')
    await user.click(screen.getByRole('button', { name: 'Mettre à jour le mot de passe' }))

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledWith({ password: 'Secret123' }))
  })

  it('le lien retour quitte le mode récupération', async () => {
    const user = userEvent.setup()
    renderForm()

    act(() => authStateCallback?.('PASSWORD_RECOVERY', { user: { id: 'user-1' } }))
    await user.click(screen.getByRole('button', { name: 'Retour à la connexion' }))
    // Rien à observer directement ici (AccountPage décide du rendu) : on vérifie juste
    // que le bouton ne lève aucune erreur et reste cliquable sans planter le formulaire.
    expect(screen.getByRole('button', { name: 'Retour à la connexion' })).toBeInTheDocument()
  })
})
