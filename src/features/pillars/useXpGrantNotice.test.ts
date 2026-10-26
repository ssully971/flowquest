import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
const showToastMock = vi.fn()
const listUnseenXpGrantsMock = vi.fn()
const acknowledgeXpGrantMock = vi.fn()
const reconcilePillarFromServerMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('@/shared/toast', () => ({ useToast: () => ({ showToast: showToastMock }) }))
vi.mock('./xp-grant-notice', () => ({
  listUnseenXpGrants: () => listUnseenXpGrantsMock(),
  acknowledgeXpGrant: (id: string) => acknowledgeXpGrantMock(id),
}))
vi.mock('./apply-session-xp', () => ({
  reconcilePillarFromServer: (id: string) => reconcilePillarFromServerMock(id),
}))

beforeEach(() => {
  useAuthMock.mockReset()
  showToastMock.mockReset()
  listUnseenXpGrantsMock.mockReset()
  acknowledgeXpGrantMock.mockReset()
  reconcilePillarFromServerMock.mockReset()
})

describe('useXpGrantNotice — message affiché une seule fois (lot I3, §6)', () => {
  it('ne fait rien pour un invité', async () => {
    useAuthMock.mockReturnValue({ status: 'guest' })
    const { useXpGrantNotice } = await import('./useXpGrantNotice')

    renderHook(() => useXpGrantNotice())

    expect(listUnseenXpGrantsMock).not.toHaveBeenCalled()
  })

  it('affiche un toast par cadeau non vu, l’accuse réception et relit le pilier concerné', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated' })
    listUnseenXpGrantsMock.mockResolvedValue([
      { id: 'g1', amount: 200, reason: 'Merci d’avoir signalé un bug', pillar_id: 'p1' },
    ])
    const { useXpGrantNotice } = await import('./useXpGrantNotice')

    renderHook(() => useXpGrantNotice())

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith({
        type: 'success',
        message: '🎁 Tu as reçu 200 XP : Merci d’avoir signalé un bug',
      })
    })
    expect(acknowledgeXpGrantMock).toHaveBeenCalledWith('g1')
    expect(reconcilePillarFromServerMock).toHaveBeenCalledWith('p1')
  })

  it('n’affiche rien quand il n’y a aucun cadeau en attente', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated' })
    listUnseenXpGrantsMock.mockResolvedValue([])
    const { useXpGrantNotice } = await import('./useXpGrantNotice')

    renderHook(() => useXpGrantNotice())

    await waitFor(() => expect(listUnseenXpGrantsMock).toHaveBeenCalled())
    expect(showToastMock).not.toHaveBeenCalled()
  })
})
