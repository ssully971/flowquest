import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AuthProvider } from '../AuthProvider'
import { GoogleSignInButton } from './GoogleSignInButton'

const signInWithOAuthMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuthMock(...args),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

function renderButton() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <GoogleSignInButton label="Continuer avec Google" />
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('GoogleSignInButton — repli sur l’OAuth redirigé (LOT 1)', () => {
  it('affiche le bouton de repli quand VITE_GOOGLE_CLIENT_ID n’est pas configuré', () => {
    renderButton()
    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeInTheDocument()
  })

  it('déclenche l’OAuth redirigé au clic sur le bouton de repli', () => {
    signInWithOAuthMock.mockResolvedValue({ error: null })
    renderButton()

    fireEvent.click(screen.getByRole('button', { name: 'Continuer avec Google' }))
    expect(signInWithOAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    )
  })
})
