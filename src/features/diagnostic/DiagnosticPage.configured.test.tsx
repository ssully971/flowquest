import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/shared/toast'

const getSessionMock = vi.fn()
const onAuthStateChangeMock = vi.fn()
const selectMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
    },
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { DiagnosticPage } from './DiagnosticPage'

function renderDiagnosticPage() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <DiagnosticPage />
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('DiagnosticPage — Supabase configuré (LOT A)', () => {
  beforeEach(() => {
    getSessionMock.mockReset()
    onAuthStateChangeMock.mockReset()
    selectMock.mockReset()
    fromMock.mockReset()
    getSessionMock.mockResolvedValue({ data: { session: null } })
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    selectMock.mockResolvedValue({ error: null })
    fromMock.mockReturnValue({ select: selectMock })

    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clé-anon')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          paths: {
            '/rpc/ensure_profile': {},
            '/rpc/is_admin': {},
            '/rpc/is_username_available': {},
          },
        }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('affiche la fonction manquante détectée via l’introspection OpenAPI', async () => {
    renderDiagnosticPage()

    await waitFor(() => expect(screen.getByText('delete_own_account')).toBeInTheDocument())
    const row = screen.getByText('delete_own_account').closest('li')
    expect(row).toHaveTextContent('introuvable')
    expect(screen.getByText('is_admin').closest('li')).toHaveTextContent('trouvée')
  })

  it('affiche les résultats de lecture des tables principales (invité, sans session)', async () => {
    renderDiagnosticPage()

    await waitFor(() => expect(screen.getByText('quotes')).toBeInTheDocument())
    expect(screen.getByText('admin_log')).toBeInTheDocument()
    expect(fromMock).toHaveBeenCalledWith('profiles')
  })

  it('remonte le code d’erreur exact quand une lecture de table échoue', async () => {
    fromMock.mockImplementation((table: string) => ({
      select: vi
        .fn()
        .mockResolvedValue(
          table === 'admin_log'
            ? { error: { code: '42501', message: 'permission denied for table admin_log' } }
            : { error: null },
        ),
    }))
    renderDiagnosticPage()

    await waitFor(() => expect(screen.getByText('admin_log')).toBeInTheDocument())
    const row = screen.getByText('admin_log').closest('li')
    expect(row).toHaveTextContent('42501')
  })

  it('affiche « aucune session (mode invité) » quand personne n’est connecté', async () => {
    renderDiagnosticPage()

    await waitFor(() => expect(screen.getByText('Aucune session (mode invité)')).toBeInTheDocument())
  })

  it('affiche l’e-mail, l’id, le pseudo et le rôle du compte connecté (LOT E8)', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-123', email: 'admin@flowquest.app' },
        },
      },
    })
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => {
            // Double usage du même mock : checkTableReads() attend directement le
            // résultat de select(...), AuthProvider enchaîne .eq(...).single() dessus —
            // un objet "thenable" avec .eq greffé dessus sert les deux appelants.
            const result = Promise.resolve({ error: null }) as Promise<{ error: null }> & {
              eq: () => { single: () => Promise<{ data: unknown; error: null }> }
            }
            result.eq = () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 'user-123', username: 'sullivan', role: 'admin' },
                  error: null,
                }),
            })
            return result
          },
        }
      }
      return { select: vi.fn().mockResolvedValue({ error: null }) }
    })

    renderDiagnosticPage()

    await waitFor(() => expect(screen.getAllByText('admin@flowquest.app').length).toBeGreaterThan(0))
    expect(screen.getByText('user-123')).toBeInTheDocument()
    expect(screen.getByText('sullivan')).toBeInTheDocument()
    expect(screen.getAllByText('admin').length).toBeGreaterThan(0)
  })
})
