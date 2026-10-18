import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AuthProvider } from '../AuthProvider'
import { ForgotPasswordForm } from './ForgotPasswordForm'

const resetPasswordForEmailMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmailMock(...args),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

function renderForm(onBack = vi.fn()) {
  return {
    onBack,
    ...render(
      <ToastProvider>
        <AuthProvider>
          <ForgotPasswordForm onBack={onBack} />
        </AuthProvider>
      </ToastProvider>,
    ),
  }
}

describe('ForgotPasswordForm — demande de réinitialisation (LOT 1)', () => {
  it('envoie la demande puis affiche un message honnête, même adresse inconnue', async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('E-mail'), 'sullivan@exemple.com')
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }))

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
      'sullivan@exemple.com',
      expect.objectContaining({ redirectTo: expect.any(String) }),
    )
    expect(
      await screen.findByText(/Si un compte existe avec cette adresse/),
    ).toBeInTheDocument()
  })

  it('revient à la connexion au clic sur le lien retour', async () => {
    const user = userEvent.setup()
    const { onBack } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Retour à la connexion' }))
    expect(onBack).toHaveBeenCalled()
  })
})
