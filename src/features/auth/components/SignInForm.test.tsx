import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AuthProvider } from '../AuthProvider'
import { SignInForm } from './SignInForm'

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

describe('SignInForm — lien mot de passe oublié (LOT 1)', () => {
  it('appelle onForgotPassword au clic sur le lien', async () => {
    const user = userEvent.setup()
    const onForgotPassword = vi.fn()
    render(
      <ToastProvider>
        <AuthProvider>
          <SignInForm onSwitchToSignUp={vi.fn()} onForgotPassword={onForgotPassword} />
        </AuthProvider>
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }))
    expect(onForgotPassword).toHaveBeenCalled()
  })
})
