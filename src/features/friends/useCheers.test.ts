import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
const useGlobalTimerStateMock = vi.fn()
const listUnreadCheersMock = vi.fn()
const markCheersReadMock = vi.fn()
let sessionRecordedListeners: Array<() => void> = []

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('@/features/timer/useGlobalTimerState', () => ({
  useGlobalTimerState: () => useGlobalTimerStateMock(),
}))
vi.mock('@/features/stats/session-events', () => ({
  onSessionRecorded: (listener: () => void) => {
    sessionRecordedListeners.push(listener)
    return () => {
      sessionRecordedListeners = sessionRecordedListeners.filter((l) => l !== listener)
    }
  },
}))
vi.mock('./friends-repository', () => ({
  listUnreadCheers: (...args: unknown[]) => listUnreadCheersMock(...args),
  markCheersRead: (...args: unknown[]) => markCheersReadMock(...args),
}))
const useCheersRealtimeMock = vi.fn()
vi.mock('./useCheersRealtime', () => ({
  useCheersRealtime: (...args: unknown[]) => useCheersRealtimeMock(...args),
}))

const CHEER = {
  id: 'c1',
  emoji: '🔥',
  createdAt: '2026-01-01T00:00:00Z',
  sender: { id: 'u2', username: 'ami', displayName: null, avatarUrl: null, avatarVersion: 0 },
}

beforeEach(() => {
  sessionRecordedListeners = []
  useAuthMock.mockReturnValue({ status: 'authenticated' })
  useGlobalTimerStateMock.mockReturnValue({ liveState: 'inactive', startedAt: null, durationMs: null })
  listUnreadCheersMock.mockReset().mockResolvedValue([])
  markCheersReadMock.mockReset().mockResolvedValue(undefined)
  useCheersRealtimeMock.mockReset()
})

describe('useCheers — bandeau d’encouragements différé pendant le focus (LOT F2)', () => {
  it('récupère les encouragements non lus au montage et les affiche hors focus', async () => {
    listUnreadCheersMock.mockResolvedValue([CHEER])
    const { useCheers } = await import('./useCheers')
    const { result } = renderHook(() => useCheers())

    await waitFor(() => expect(result.current.cheers).toEqual([CHEER]))
  })

  it('ne récupère rien en mode invité', async () => {
    useAuthMock.mockReturnValue({ status: 'guest' })
    const { useCheers } = await import('./useCheers')
    renderHook(() => useCheers())

    await Promise.resolve()
    expect(listUnreadCheersMock).not.toHaveBeenCalled()
  })

  it('ne montre pas le bandeau tant qu’on est en focus', async () => {
    useGlobalTimerStateMock.mockReturnValue({ liveState: 'focus', startedAt: 1000, durationMs: 1500000 })
    listUnreadCheersMock.mockResolvedValue([CHEER])
    const { useCheers } = await import('./useCheers')
    const { result } = renderHook(() => useCheers())

    await waitFor(() => expect(listUnreadCheersMock).toHaveBeenCalled())
    expect(result.current.cheers).toEqual([])
  })

  it('unreadCount (LOT H2, §1) reste visible même en focus, contrairement au bandeau', async () => {
    useGlobalTimerStateMock.mockReturnValue({ liveState: 'focus', startedAt: 1000, durationMs: 1500000 })
    listUnreadCheersMock.mockResolvedValue([CHEER])
    const { useCheers } = await import('./useCheers')
    const { result } = renderHook(() => useCheers())

    await waitFor(() => expect(result.current.unreadCount).toBe(1))
    expect(result.current.cheers).toEqual([])
  })

  it('se re-vérifie à chaque session enregistrée (fin de session)', async () => {
    const { useCheers } = await import('./useCheers')
    renderHook(() => useCheers())
    await waitFor(() => expect(listUnreadCheersMock).toHaveBeenCalledTimes(1))

    listUnreadCheersMock.mockResolvedValue([CHEER])
    act(() => {
      sessionRecordedListeners.forEach((listener) => listener())
    })

    await waitFor(() => expect(listUnreadCheersMock).toHaveBeenCalledTimes(2))
  })

  it('dismiss vide le bandeau et marque tout comme lu', async () => {
    listUnreadCheersMock.mockResolvedValue([CHEER])
    const { useCheers } = await import('./useCheers')
    const { result } = renderHook(() => useCheers())
    await waitFor(() => expect(result.current.cheers).toEqual([CHEER]))

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.cheers).toEqual([])
    expect(markCheersReadMock).toHaveBeenCalled()
  })

  it('s’abonne au temps réel (LOT H1), activé seulement une fois connecté', async () => {
    const { useCheers } = await import('./useCheers')
    renderHook(() => useCheers())

    await waitFor(() => expect(useCheersRealtimeMock).toHaveBeenCalledWith(expect.any(Function), true))
  })

  it('n’active pas le temps réel en mode invité', async () => {
    useAuthMock.mockReturnValue({ status: 'guest' })
    const { useCheers } = await import('./useCheers')
    renderHook(() => useCheers())

    await waitFor(() => expect(useCheersRealtimeMock).toHaveBeenCalledWith(expect.any(Function), false))
  })
})
