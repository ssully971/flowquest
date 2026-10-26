import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AdminInvitesPanel } from './AdminInvitesPanel'

const generateMock = vi.fn()
const listMock = vi.fn()
const revokeMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({ isSupabaseConfigured: true, supabase: {} }))
vi.mock('../invite-codes-admin', () => ({
  generateAdminInviteCode: () => generateMock(),
  listAdminInviteCodes: () => listMock(),
  revokeInviteCode: (...args: unknown[]) => revokeMock(...args),
}))

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    code: 'ABCD2345',
    type: 'admin',
    created_at: '2026-10-26T10:00:00.000Z',
    expires_at: '2099-01-01T00:00:00.000Z',
    is_used: false,
    used_at: null,
    used_by_username: null,
    status: 'active',
    ...overrides,
  }
}

function renderPanel() {
  return render(
    <ToastProvider>
      <AdminInvitesPanel />
    </ToastProvider>,
  )
}

describe('AdminInvitesPanel — codes d’accès (bêta fermée)', () => {
  beforeEach(() => {
    generateMock.mockReset()
    listMock.mockReset()
    revokeMock.mockReset()
  })

  it('liste les codes avec leur statut (actif, utilisé par qui, expiré)', async () => {
    listMock.mockResolvedValue([
      row(),
      row({
        id: 'c2',
        code: 'USED2345',
        status: 'used',
        is_used: true,
        used_by_username: 'alice',
        used_at: '2026-10-26T11:00:00.000Z',
      }),
      row({
        id: 'c3',
        code: 'OLDD2345',
        status: 'expired',
        expires_at: '2020-01-01T00:00:00.000Z',
      }),
    ])
    renderPanel()

    expect(await screen.findByText('ABCD2345')).toBeInTheDocument()
    expect(screen.getByText(/Utilisé par alice/)).toBeInTheDocument()
    expect(screen.getByText(/^Expiré/)).toBeInTheDocument()
    // Seul un code actif peut être révoqué.
    expect(screen.getAllByRole('button', { name: 'Révoquer' })).toHaveLength(1)
  })

  it('génère un code, l’affiche en grand avec son expiration et recharge la liste', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([])
    generateMock.mockResolvedValue({ code: 'NEWC2345', expires_at: '2099-01-01T12:00:00.000Z' })
    renderPanel()
    await screen.findByText('Aucun code généré pour l’instant.')

    listMock.mockResolvedValue([row({ code: 'NEWC2345' })])
    await user.click(screen.getByRole('button', { name: 'Générer un code d’accès' }))

    expect(await screen.findByTestId('invite-code')).toHaveTextContent('NEWC2345')
    expect(screen.getByRole('button', { name: 'Copier' })).toBeInTheDocument()
    expect(screen.getAllByText(/Expire le/).length).toBeGreaterThan(0)
    expect(generateMock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2))
  })

  it('révoque un code actif via la fonction dédiée puis recharge', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([row()])
    revokeMock.mockResolvedValue(undefined)
    renderPanel()

    await user.click(await screen.findByRole('button', { name: 'Révoquer' }))

    expect(revokeMock).toHaveBeenCalledWith('c1')
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2))
  })

  it('signale un échec de génération sans afficher de code', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([])
    generateMock.mockRejectedValue(new Error('boom'))
    renderPanel()
    await screen.findByText('Aucun code généré pour l’instant.')

    await user.click(screen.getByRole('button', { name: 'Générer un code d’accès' }))

    expect(await screen.findByText('La génération a échoué. Réessaie.')).toBeInTheDocument()
    expect(screen.queryByTestId('invite-code')).not.toBeInTheDocument()
  })
})
