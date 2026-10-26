import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/shared/toast'

import { AdminFeaturesPanel } from './AdminFeaturesPanel'

const getSessionMock = vi.fn()
const rpcMock = vi.fn()

function flag(overrides: Record<string, unknown> = {}) {
  return {
    key: 'rooms',
    enabled: true,
    label: 'Salons de focus',
    description: 'Sessions de focus partagées entre amis.',
    updated_by: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function profile(overrides: Record<string, unknown> = {}) {
  return { id: 'admin-1', username: 'admin', role: 'admin', ...overrides }
}

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: (table: string) => {
      if (table === 'feature_flags') {
        return { select: () => ({ order: () => Promise.resolve({ data: [flag()], error: null }) }) }
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: profile(), error: null }) }),
          }),
        }
      }
      if (table === 'admin_log') {
        return { insert: () => Promise.resolve({ data: null, error: null }) }
      }
      return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

function renderPanel() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <AdminFeaturesPanel />
      </AuthProvider>
    </ToastProvider>,
  )
}

beforeEach(() => {
  getSessionMock.mockReset()
  rpcMock.mockReset()
  getSessionMock.mockResolvedValue({
    data: { session: { user: { id: 'admin-1', email: 'admin@exemple.com' } } },
  })
})

describe('AdminFeaturesPanel — coupe-circuits (lot I2, §1)', () => {
  it('demande une confirmation avant de désactiver un drapeau', async () => {
    const user = userEvent.setup()
    renderPanel()

    const toggle = await screen.findByRole('switch', { name: 'Salons de focus' })
    await user.click(toggle)

    expect(
      screen.getByText('Désactiver cette fonctionnalité pour tout le monde ?'),
    ).toBeInTheDocument()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('n’appelle la RPC qu’après confirmation', async () => {
    rpcMock.mockResolvedValue({ data: flag({ enabled: false }), error: null })
    const user = userEvent.setup()
    renderPanel()

    const toggle = await screen.findByRole('switch', { name: 'Salons de focus' })
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(rpcMock).toHaveBeenCalledWith('admin_set_feature_flag', {
      flag_key: 'rooms',
      new_enabled: false,
      new_description: null,
    })
  })

  it('annuler la confirmation ne change rien', async () => {
    const user = userEvent.setup()
    renderPanel()

    const toggle = await screen.findByRole('switch', { name: 'Salons de focus' })
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(
      screen.queryByText('Désactiver cette fonctionnalité pour tout le monde ?'),
    ).not.toBeInTheDocument()
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
