import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
const showToastMock = vi.fn()
const listMyRoomsMock = vi.fn()
const createRoomMock = vi.fn()
const respondRoomInviteMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('@/shared/toast', () => ({ useToast: () => ({ showToast: showToastMock }) }))
vi.mock('./rooms-repository', () => ({
  RoomsError: class RoomsError extends Error {},
  listMyRooms: (...args: unknown[]) => listMyRoomsMock(...args),
  createRoom: (...args: unknown[]) => createRoomMock(...args),
  respondRoomInvite: (...args: unknown[]) => respondRoomInviteMock(...args),
}))

const MY_ROOM = {
  roomId: 'r1',
  hostId: 'u1',
  hostUsername: 'hote',
  hostDisplayName: null,
  status: 'lobby' as const,
  focusMinutes: 25,
  myStatus: 'invited' as const,
  participantCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ status: 'authenticated' })
  showToastMock.mockReset()
  listMyRoomsMock.mockReset().mockResolvedValue([MY_ROOM])
  createRoomMock.mockReset().mockResolvedValue('new-room-id')
  respondRoomInviteMock.mockReset().mockResolvedValue(undefined)
})

describe('useRooms — mes salons (LOT F3)', () => {
  it('charge mes salons au montage', async () => {
    const { useRooms } = await import('./useRooms')
    const { result } = renderHook(() => useRooms())

    await waitFor(() => expect(result.current.rooms).toEqual([MY_ROOM]))
    expect(result.current.isLoading).toBe(false)
  })

  it('ne charge rien en mode invité', async () => {
    useAuthMock.mockReturnValue({ status: 'guest' })
    const { useRooms } = await import('./useRooms')
    renderHook(() => useRooms())

    await Promise.resolve()
    expect(listMyRoomsMock).not.toHaveBeenCalled()
  })

  it('expose une erreur de chargement en cas d’échec', async () => {
    const { RoomsError } = await import('./rooms-repository')
    listMyRoomsMock.mockRejectedValue(new RoomsError('Oups'))
    const { useRooms } = await import('./useRooms')
    const { result } = renderHook(() => useRooms())

    await waitFor(() => expect(result.current.loadError).toBe('Oups'))
  })

  it('create appelle createRoom puis recharge, renvoie l’id créé', async () => {
    const { useRooms } = await import('./useRooms')
    const { result } = renderHook(() => useRooms())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    listMyRoomsMock.mockClear()

    let roomId: string | null = null
    await act(async () => {
      roomId = await result.current.create(25, ['f1'])
    })

    expect(createRoomMock).toHaveBeenCalledWith(25, ['f1'])
    expect(roomId).toBe('new-room-id')
    expect(listMyRoomsMock).toHaveBeenCalled()
  })

  it('create affiche une erreur et renvoie null en cas d’échec', async () => {
    const { RoomsError } = await import('./rooms-repository')
    createRoomMock.mockRejectedValue(new RoomsError('Un salon réunit au plus 6 personnes'))
    const { useRooms } = await import('./useRooms')
    const { result } = renderHook(() => useRooms())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let roomId: string | null = 'unset'
    await act(async () => {
      roomId = await result.current.create(25, [])
    })

    expect(roomId).toBeNull()
    expect(showToastMock).toHaveBeenCalledWith({ type: 'error', message: 'Un salon réunit au plus 6 personnes' })
  })

  it('respond accepte ou refuse une invitation puis recharge', async () => {
    const { useRooms } = await import('./useRooms')
    const { result } = renderHook(() => useRooms())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    listMyRoomsMock.mockClear()

    let accepted = false
    await act(async () => {
      accepted = await result.current.respond('r1', true)
    })

    expect(respondRoomInviteMock).toHaveBeenCalledWith('r1', true)
    expect(accepted).toBe(true)
    expect(listMyRoomsMock).toHaveBeenCalled()
  })
})

describe('useRooms — nouvelles invitations en temps réel (LOT H1)', () => {
  it('ne montre aucun toast au tout premier chargement, même avec une invitation déjà en attente', async () => {
    const { useRooms } = await import('./useRooms')
    const { result } = renderHook(() => useRooms())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(showToastMock).not.toHaveBeenCalled()
  })

  it('montre un toast quand une nouvelle invitation apparaît entre deux rafraîchissements', async () => {
    const { useRooms } = await import('./useRooms')
    const { result } = renderHook(() => useRooms())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const newInvite = { ...MY_ROOM, roomId: 'r2', hostUsername: 'autre_hote', hostDisplayName: 'Autre Hôte' }
    listMyRoomsMock.mockResolvedValue([MY_ROOM, newInvite])

    await act(async () => {
      await result.current.refresh()
    })

    expect(showToastMock).toHaveBeenCalledWith({
      type: 'info',
      message: 'Autre Hôte t’invite à un salon de focus.',
    })
    expect(showToastMock).toHaveBeenCalledTimes(1)
  })

  it('ne montre aucun toast si la même invitation persiste', async () => {
    const { useRooms } = await import('./useRooms')
    const { result } = renderHook(() => useRooms())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.refresh()
    })

    expect(showToastMock).not.toHaveBeenCalled()
  })
})
