import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/shared/toast'

import { AdminUsersPanel } from './AdminUsersPanel'

const getSessionMock = vi.fn()
const rpcMock = vi.fn()

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alice-1',
    email: 'alice@exemple.com',
    username: 'alice',
    display_name: null,
    created_at: '2026-01-01T00:00:00.000Z',
    last_active_at: '2026-01-05T00:00:00.000Z',
    role: 'user',
    status: 'active',
    marketing_consent: false,
    total_count: 1,
    ...overrides,
  }
}

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 'admin-1', username: 'admin', role: 'admin' },
                  error: null,
                }),
            }),
          }),
        }
      }
      return { insert: () => Promise.resolve({ data: null, error: null }) }
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
    channel: () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() }),
    removeChannel: vi.fn(),
  },
}))

function renderPanel() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <AdminUsersPanel />
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
  rpcMock.mockImplementation((name: string) => {
    if (name === 'admin_list_users') return Promise.resolve({ data: [user()], error: null })
    return Promise.resolve({ data: null, error: null })
  })
})

describe('AdminUsersPanel — visionneuse et modération (lot I3, §1-2-4)', () => {
  it('liste les comptes renvoyés par admin_list_users', async () => {
    renderPanel()
    expect(await screen.findByText('alice')).toBeInTheDocument()
    expect(screen.getByText('alice@exemple.com')).toBeInTheDocument()
  })

  it('transmet la recherche à admin_list_users après un court délai', async () => {
    const userEv = userEvent.setup()
    renderPanel()
    await screen.findByText('alice')
    rpcMock.mockClear()

    await userEv.type(screen.getByPlaceholderText('Chercher par pseudo ou e-mail…'), 'ali')

    await vi.waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        'admin_list_users',
        expect.objectContaining({ p_search: 'ali' }),
      )
    })
  })

  it('demande une confirmation avant de suspendre un compte', async () => {
    const userEv = userEvent.setup()
    renderPanel()
    const row = await screen.findByText('alice')
    await userEv.click(row)

    await userEv.click(screen.getByText('Suspendre 1 jour'))

    expect(screen.getByText('Suspendre ce compte ?')).toBeInTheDocument()
    expect(rpcMock).not.toHaveBeenCalledWith('admin_suspend_user', expect.anything())
  })

  it('appelle admin_suspend_user seulement après confirmation', async () => {
    const userEv = userEvent.setup()
    renderPanel()
    const row = await screen.findByText('alice')
    await userEv.click(row)
    await userEv.click(screen.getByText('Suspendre 1 jour'))
    await userEv.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(rpcMock).toHaveBeenCalledWith('admin_suspend_user', {
      p_target_user_id: 'alice-1',
      p_duration_days: 1,
      p_reason: null,
    })
  })

  it('exporte le CSV des comptes ayant consenti par défaut', async () => {
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:fake-url')
    URL.revokeObjectURL = vi.fn()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const userEv = userEvent.setup()
    renderPanel()
    await screen.findByText('alice')

    await userEv.click(screen.getByRole('button', { name: 'Exporter les utilisateurs' }))

    await vi.waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('admin_export_users', { p_only_consented: true })
    })
    expect(clickSpy).toHaveBeenCalled()

    clickSpy.mockRestore()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })
})
