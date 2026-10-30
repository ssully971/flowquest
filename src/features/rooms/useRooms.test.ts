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
  mode: 'countdown' as const,
  phase: 'focus' as const,
  startedAt: null,
  durationMs: null,
  elapsedMsAtPause: null,
}

const DRAFT = {
  mode: 'countdown' as const,
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
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
    const { RoomsError } = await import('./rooms-errors')
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
      roomId = await result.current.create(DRAFT, ['f1'])
    })

    expect(createRoomMock).toHaveBeenCalledWith({ ...DRAFT, friendIds: ['f1'], pillarId: null })
    expect(roomId).toBe('new-room-id')
    expect(listMyRoomsMock).toHaveBeenCalled()
  })

  it('create affiche une erreur et renvoie null en cas d’échec', async () => {
    const { RoomsError } = await import('./rooms-errors')
    createRoomMock.mockRejectedValue(new RoomsError('Un salon réunit au plus 6 personnes'))
    const { useRooms } = await import('./useRooms')
    const { result } = renderHook(() => useRooms())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let roomId: string | null = 'unset'
    await act(async () => {
      roomId = await result.current.create(DRAFT, [])
    })

    expect(roomId).toBeNull()
    expect(showToastMock).toHaveBeenCalledWith({
      type: 'error',
      message: 'Un salon réunit au plus 6 personnes',
    })
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

    expect(respondRoomInviteMock).toHaveBeenCalledWith('r1', true, null)
    expect(accepted).toBe(true)
    expect(listMyRoomsMock).toHaveBeenCalled()
  })
})

describe('useRooms — nouvelles invitations en temps réel (LOT H1, M4)', () => {
  it('expose une nouvelle invitation arrivée entre deux rafraîchissements, sans toast éphémère', async () => {
    const { useRooms } = await import('./useRooms')
    const { result } = renderHook(() => useRooms())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const newInvite = { ...MY_ROOM, roomId: 'r2', hostUsername: 'autre_hote', hostDisplayName: 'Autre Hôte' }
    listMyRoomsMock.mockResolvedValue([MY_ROOM, newInvite])
    await act(async () => {
      await result.current.refresh()
    })

    // La notification visible (bannière Rejoindre / Refuser) est celle de SocialInvitesBanner
    // (LOT M4), qui lit cette liste : plus de toast de 5 s ici, donc jamais deux notifications
    // pour la même invitation.
    expect(result.current.rooms.map((room) => room.roomId)).toEqual(['r1', 'r2'])
    expect(showToastMock).not.toHaveBeenCalled()
  })
})

describe('useRooms — réponse à une invitation : verrou et retour visuel (LOT P1)', () => {
  it('expose la réponse en cours et ignore un second clic (anti-double-clic)', async () => {
    let finish!: () => void
    respondRoomInviteMock.mockReset().mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const { useRooms } = await import('./useRooms')
    const { result } = renderHook(() => useRooms())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let first: Promise<boolean> | undefined
    act(() => {
      first = result.current.respond('r1', true)
    })
    await waitFor(() => expect(result.current.responding).toEqual({ roomId: 'r1', accept: true }))

    let second = true
    await act(async () => {
      second = await result.current.respond('r1', true)
    })
    expect(second).toBe(false)
    expect(respondRoomInviteMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      finish()
      await first
    })
    expect(result.current.responding).toBeNull()
  })

  it('échec réseau : message français + « Réessayer », verrou libéré', async () => {
    respondRoomInviteMock.mockReset().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { useRooms } = await import('./useRooms')
    const { result } = renderHook(() => useRooms())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.respond('r1', true)
    })

    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Connexion impossible. Vérifie ta connexion internet puis réessaie.',
        action: expect.objectContaining({ label: 'Réessayer' }),
      }),
    )
    expect(result.current.responding).toBeNull()
  })
})
