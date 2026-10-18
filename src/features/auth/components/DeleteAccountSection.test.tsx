import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AuthProvider } from '../AuthProvider'
import { DeleteAccountSection } from './DeleteAccountSection'

const rpcMock = vi.fn()
const signOutMock = vi.fn()

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
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: PROFILE_ROW, error: null }) }),
      }),
    }),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

function renderSection() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <DeleteAccountSection />
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('DeleteAccountSection — suppression de compte confirmée par le pseudo (LOT 1)', () => {
  it('n’affiche rien tant que le profil n’est pas chargé, puis le bouton d’ouverture', async () => {
    renderSection()
    expect(await screen.findByRole('button', { name: 'Supprimer mon compte' })).toBeInTheDocument()
  })

  it('le bouton de confirmation reste désactivé tant que le pseudo tapé ne correspond pas', async () => {
    renderSection()
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))

    const confirmButton = screen.getByRole('button', { name: 'Supprimer définitivement' })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Pour confirmer, tape ton pseudo/), {
      target: { value: 'mauvais-pseudo' },
    })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Pour confirmer, tape ton pseudo/), {
      target: { value: 'sullivan' },
    })
    expect(confirmButton).toBeEnabled()
  })

  it('appelle delete_own_account une fois le pseudo confirmé', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    signOutMock.mockResolvedValue({ error: null })
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))
    fireEvent.change(screen.getByLabelText(/Pour confirmer, tape ton pseudo/), {
      target: { value: 'sullivan' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('delete_own_account'))
    await waitFor(() => expect(signOutMock).toHaveBeenCalled())
  })
})
