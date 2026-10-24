import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
const showToastMock = vi.fn()
const getRoomStateMock = vi.fn()
const startRoomMock = vi.fn()
const pauseRoomMock = vi.fn()
const resumeRoomMock = vi.fn()
const endRoomMock = vi.fn()
const leaveRoomMock = vi.fn()
const transferHostMock = vi.fn()
const useRoomRealtimeMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('@/shared/toast', () => ({ useToast: () => ({ showToast: showToastMock }) }))
vi.mock('./useRoomRealtime', () => ({ useRoomRealtime: (...args: unknown[]) => useRoomRealtimeMock(...args) }))
vi.mock('./rooms-repository', () => ({
  RoomsError: class RoomsError extends Error {},
  getRoomState: (...args: unknown[]) => getRoomStateMock(...args),
  startRoom: (...args: unknown[]) => startRoomMock(...args),
  pauseRoom: (...args: unknown[]) => pauseRoomMock(...args),
  resumeRoom: (...args: unknown[]) => resumeRoomMock(...args),
  endRoom: (...args: unknown[]) => endRoomMock(...args),
  leaveRoom: (...args: unknown[]) => leaveRoomMock(...args),
  transferHost: (...args: unknown[]) => transferHostMock(...args),
}))

const ROOM = {
  roomId: 'r1',
  hostId: 'host-1',
  status: 'lobby' as const,
  focusMinutes: 25,
  startedAt: null,
  durationMs: null,
  elapsedMsAtPause: null,
  createdAt: '2026-01-01T00:00:00Z',
  endedAt: null,
  participants: [],
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ status: 'authenticated', user: { id: 'host-1' } })
  showToastMock.mockReset()
  useRoomRealtimeMock.mockReset()
  getRoomStateMock.mockReset().mockResolvedValue(ROOM)
  startRoomMock.mockReset().mockResolvedValue(undefined)
  pauseRoomMock.mockReset().mockResolvedValue(undefined)
  resumeRoomMock.mockReset().mockResolvedValue(undefined)
  endRoomMock.mockReset().mockResolvedValue(undefined)
  leaveRoomMock.mockReset().mockResolvedValue(undefined)
  transferHostMock.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useActiveRoom — salon ouvert (LOT F3)', () => {
  it('charge l’état du salon au montage', async () => {
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))

    await waitFor(() => expect(result.current.room).toEqual(ROOM))
    expect(getRoomStateMock).toHaveBeenCalledWith('r1')
  })

  it('ne charge rien sans roomId', async () => {
    const { useActiveRoom } = await import('./useActiveRoom')
    renderHook(() => useActiveRoom(null))

    await Promise.resolve()
    expect(getRoomStateMock).not.toHaveBeenCalled()
  })

  it('isHost reflète si l’utilisateur courant est l’hôte du salon', async () => {
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))

    await waitFor(() => expect(result.current.isHost).toBe(true))
  })

  it('isHost est faux pour un participant non hôte', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', user: { id: 'member-1' } })
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))

    await waitFor(() => expect(result.current.room).toEqual(ROOM))
    expect(result.current.isHost).toBe(false)
  })

  it('start appelle startRoom puis recharge l’état', async () => {
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    getRoomStateMock.mockClear()

    await act(async () => {
      await result.current.start()
    })

    expect(startRoomMock).toHaveBeenCalledWith('r1')
    expect(getRoomStateMock).toHaveBeenCalledWith('r1')
  })

  it('affiche une erreur et ne casse pas si une action échoue', async () => {
    const { RoomsError } = await import('./rooms-repository')
    pauseRoomMock.mockRejectedValue(new RoomsError('Le salon n’est pas en cours'))
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let ok = true
    await act(async () => {
      ok = await result.current.pause()
    })

    expect(ok).toBe(false)
    expect(showToastMock).toHaveBeenCalledWith({ type: 'error', message: 'Le salon n’est pas en cours' })
  })

  it('transfer transmet le nouvel hôte', async () => {
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.transfer('member-1')
    })

    expect(transferHostMock).toHaveBeenCalledWith('r1', 'member-1')
  })

  it('tick local toutes les secondes uniquement pendant que le salon tourne', async () => {
    vi.useFakeTimers()
    getRoomStateMock.mockResolvedValue({ ...ROOM, status: 'running', startedAt: new Date().toISOString(), durationMs: 60_000 })
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    const firstNow = result.current.nowMs

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(result.current.nowMs).toBeGreaterThan(firstNow)
  })
})
