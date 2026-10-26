import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AdminUserDetail } from './AdminUserDetail'

const fetchAdminUserStatsMock = vi.fn()
const deleteUserNuclearMock = vi.fn()

vi.mock('../admin-user-stats', () => ({
  fetchAdminUserStats: (...args: unknown[]) => fetchAdminUserStatsMock(...args),
}))
vi.mock('../admin-delete-user', () => ({
  deleteUserNuclear: (...args: unknown[]) => deleteUserNuclearMock(...args),
}))

function renderDetail(overrides: Partial<Parameters<typeof AdminUserDetail>[0]> = {}) {
  const onClose = vi.fn()
  const onDeleted = vi.fn()
  render(
    <ToastProvider>
      <AdminUserDetail
        userId="u1"
        username="bob"
        canDelete
        onClose={onClose}
        onDeleted={onDeleted}
        {...overrides}
      />
    </ToastProvider>,
  )
  return { onClose, onDeleted }
}

const STATS = {
  totalFocusSeconds: 3600,
  dailyFocus: [{ dayStart: Date.now(), focusSeconds: 1500, sessionsCount: 2 }],
  pillars: [{ name: 'Travail', level: 2, focusSeconds: 3000 }],
  recentActivity: [
    {
      startedAt: new Date().toISOString(),
      kind: 'focus',
      actualSeconds: 1500,
      pillarName: 'Travail',
    },
  ],
}

beforeEach(() => {
  fetchAdminUserStatsMock.mockReset()
  deleteUserNuclearMock.mockReset()
})

describe('AdminUserDetail — profil détaillé « god mode » (lot I3, §3)', () => {
  it('affiche le bandeau de rappel et les statistiques une fois chargées', async () => {
    fetchAdminUserStatsMock.mockResolvedValue(STATS)
    renderDetail()

    expect(screen.getByText(/Lecture seule/)).toBeInTheDocument()
    expect(await screen.findByText('1 h')).toBeInTheDocument()
    expect(screen.getAllByText(/Travail/).length).toBeGreaterThan(0)
  })

  it('affiche un message d’erreur si le chargement échoue', async () => {
    fetchAdminUserStatsMock.mockResolvedValue(null)
    renderDetail()

    expect(
      await screen.findByText('Impossible de charger les statistiques. Réessaie.'),
    ).toBeInTheDocument()
  })

  it('ne propose pas la suppression quand canDelete est faux (soi-même ou un autre admin)', async () => {
    fetchAdminUserStatsMock.mockResolvedValue(STATS)
    renderDetail({ canDelete: false })

    await screen.findByText('1 h')
    expect(screen.queryByText('Supprimer définitivement ce compte')).not.toBeInTheDocument()
  })

  it('ouvre la boîte de suppression nucléaire au clic', async () => {
    fetchAdminUserStatsMock.mockResolvedValue(STATS)
    const user = userEvent.setup()
    renderDetail()

    await screen.findByText('1 h')
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement ce compte' }))

    expect(screen.getByPlaceholderText('Pseudo du compte')).toBeInTheDocument()
  })
})
