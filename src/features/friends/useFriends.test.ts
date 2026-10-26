import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
const showToastMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('@/shared/toast', () => ({ useToast: () => ({ showToast: showToastMock }) }))

const listFriendsMock = vi.fn()
const listFriendRequestsMock = vi.fn()
const sendFriendRequestMock = vi.fn()
const respondFriendRequestMock = vi.fn()
const removeFriendMock = vi.fn()
const blockUserMock = vi.fn()

vi.mock('./friends-repository', () => ({
  FriendsError: class FriendsError extends Error {},
  listFriends: (...args: unknown[]) => listFriendsMock(...args),
  listFriendRequests: (...args: unknown[]) => listFriendRequestsMock(...args),
  sendFriendRequest: (...args: unknown[]) => sendFriendRequestMock(...args),
  respondFriendRequest: (...args: unknown[]) => respondFriendRequestMock(...args),
  cancelFriendRequest: vi.fn(),
  removeFriend: (...args: unknown[]) => removeFriendMock(...args),
  blockUser: (...args: unknown[]) => blockUserMock(...args),
  unblockUser: vi.fn(),
  regenerateFriendCode: vi.fn(),
  reportUser: vi.fn(),
  findProfilePreview: vi.fn(),
}))

const FRIEND_ROW = {
  friendshipId: 'f1',
  id: 'u1',
  username: 'ami',
  displayName: null,
  avatarUrl: null,
  avatarVersion: 0,
  since: '2026-01-01T00:00:00Z',
}
const INCOMING_REQUEST = {
  friendshipId: 'r1',
  direction: 'incoming' as const,
  id: 'u2',
  username: 'demandeur',
  displayName: null,
  avatarUrl: null,
  avatarVersion: 0,
  createdAt: '2026-01-01T00:00:00Z',
}
const OUTGOING_REQUEST = { ...INCOMING_REQUEST, friendshipId: 'r2', direction: 'outgoing' as const }

beforeEach(() => {
  useAuthMock.mockReturnValue({ status: 'authenticated' })
  showToastMock.mockReset()
  listFriendsMock.mockReset().mockResolvedValue([FRIEND_ROW])
  listFriendRequestsMock.mockReset().mockResolvedValue([INCOMING_REQUEST, OUTGOING_REQUEST])
  sendFriendRequestMock.mockReset().mockResolvedValue(undefined)
  respondFriendRequestMock.mockReset().mockResolvedValue(undefined)
  removeFriendMock.mockReset().mockResolvedValue(undefined)
  blockUserMock.mockReset().mockResolvedValue(undefined)
})

describe('useFriends — chargement et actions (LOT F1)', () => {
  it('charge les amis et sépare les demandes entrantes/sortantes au montage (authentifié)', async () => {
    const { useFriends } = await import('./useFriends')
    const { result } = renderHook(() => useFriends())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.friends).toEqual([FRIEND_ROW])
    expect(result.current.incomingRequests).toEqual([INCOMING_REQUEST])
    expect(result.current.outgoingRequests).toEqual([OUTGOING_REQUEST])
  })

  it('ne charge rien en mode invité', async () => {
    useAuthMock.mockReturnValue({ status: 'guest' })
    const { useFriends } = await import('./useFriends')
    renderHook(() => useFriends())

    await Promise.resolve()
    expect(listFriendsMock).not.toHaveBeenCalled()
  })

  it('affiche une erreur de chargement si les RPC échouent', async () => {
    const { FriendsError } = await import('./friends-repository')
    listFriendsMock.mockRejectedValue(new FriendsError('Compte introuvable'))
    const { useFriends } = await import('./useFriends')
    const { result } = renderHook(() => useFriends())

    await waitFor(() => expect(result.current.loadError).toBe('Compte introuvable'))
  })

  it('unfriend rappelle removeFriend puis recharge la liste', async () => {
    const { useFriends } = await import('./useFriends')
    const { result } = renderHook(() => useFriends())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    listFriendsMock.mockResolvedValue([])

    await act(async () => {
      await result.current.unfriend('u1')
    })

    expect(removeFriendMock).toHaveBeenCalledWith('u1')
    expect(listFriendsMock).toHaveBeenCalledTimes(2)
    expect(result.current.friends).toEqual([])
  })

  it('une action en échec affiche un toast d’erreur et ne recharge pas silencieusement un succès', async () => {
    const { FriendsError } = await import('./friends-repository')
    const { useFriends } = await import('./useFriends')
    const { result } = renderHook(() => useFriends())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    blockUserMock.mockRejectedValue(new FriendsError('Compte introuvable'))

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.block('u1')
    })

    expect(success).toBe(false)
    expect(showToastMock).toHaveBeenCalledWith({ type: 'error', message: 'Compte introuvable' })
  })

  it('acceptRequest appelle respondFriendRequest(id, true)', async () => {
    const { useFriends } = await import('./useFriends')
    const { result } = renderHook(() => useFriends())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.acceptRequest('r1')
    })

    expect(respondFriendRequestMock).toHaveBeenCalledWith('r1', true)
  })
})

describe('useFriends — nouvelles demandes en temps réel (LOT H1, M4)', () => {
  it('expose une nouvelle demande entrante arrivée entre deux rafraîchissements, sans toast éphémère', async () => {
    const { useFriends } = await import('./useFriends')
    const { result } = renderHook(() => useFriends())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const newIncoming = { ...INCOMING_REQUEST, friendshipId: 'r3', username: 'nouveau_demandeur' }
    listFriendRequestsMock.mockResolvedValue([INCOMING_REQUEST, OUTGOING_REQUEST, newIncoming])
    await act(async () => {
      await result.current.refresh()
    })

    // La notification visible (bannière Accepter / Refuser) est celle de SocialInvitesBanner
    // (LOT M4), qui lit cette liste : jamais deux notifications pour la même demande.
    expect(result.current.incomingRequests.map((request) => request.friendshipId)).toEqual(['r1', 'r3'])
    expect(showToastMock).not.toHaveBeenCalled()
  })
})
