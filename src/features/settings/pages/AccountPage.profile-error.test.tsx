import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/shared/toast'

import { AccountPage } from './AccountPage'

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

beforeEach(() => {
  getSessionMock.mockReset()
  onAuthStateChangeMock.mockReset()
  fromMock.mockReset()
  rpcMock.mockReset()
  getSessionMock.mockResolvedValue({
    data: { session: { user: { id: 'user-1', email: 'sullivan@exemple.com' } } },
  })
  onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'no rows' } }) }),
    }),
  })
  rpcMock.mockResolvedValue({
    data: null,
    error: { message: 'function ensure_profile() does not exist' },
  })
})

describe('AccountPage — connecté mais profil introuvable (jamais un panneau vide)', () => {
  it('affiche un message d’erreur explicite et un bouton Réessayer, jamais un panneau vide', async () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <AccountPage />
        </AuthProvider>
      </ToastProvider>,
    )

    const retryButton = await screen.findByRole('button', { name: 'Réessayer' })
    expect(retryButton).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/./)
    })
  })
})
