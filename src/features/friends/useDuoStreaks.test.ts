import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
const listDuoStreaksMock = vi.fn()
const channelMock = vi.fn()
const removeChannelMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('./friends-repository', () => ({
  FriendsError: class FriendsError extends Error {},
  listDuoStreaks: (...args: unknown[]) => listDuoStreaksMock(...args),
}))
vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    channel: (...args: unknown[]) => channelMock(...args),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
  },
}))

const STREAKS = [
  { friendId: 'u1', currentStreak: 3, longestStreak: 5, lastActiveDate: '2026-01-10', activeToday: true },
]

beforeEach(() => {
  useAuthMock.mockReturnValue({ status: 'authenticated' })
  listDuoStreaksMock.mockReset().mockResolvedValue(STREAKS)
  channelMock.mockReset().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })
  removeChannelMock.mockReset()
})

describe('useDuoStreaks — série partagée (LOT F4)', () => {
  it('charge les séries au montage', async () => {
    const { useDuoStreaks } = await import('./useDuoStreaks')
    const { result } = renderHook(() => useDuoStreaks())

    await waitFor(() => expect(result.current.streaks).toEqual(STREAKS))
    expect(result.current.isLoading).toBe(false)
  })

  it('ne charge rien en mode invité', async () => {
    useAuthMock.mockReturnValue({ status: 'guest' })
    const { useDuoStreaks } = await import('./useDuoStreaks')
    renderHook(() => useDuoStreaks())

    await Promise.resolve()
    expect(listDuoStreaksMock).not.toHaveBeenCalled()
  })

  it('expose une erreur de chargement en cas d’échec', async () => {
    const { FriendsError } = await import('./friends-repository')
    listDuoStreaksMock.mockRejectedValue(new FriendsError('Oups'))
    const { useDuoStreaks } = await import('./useDuoStreaks')
    const { result } = renderHook(() => useDuoStreaks())

    await waitFor(() => expect(result.current.loadError).toBe('Oups'))
  })

  it('s’abonne à duo_streaks en Realtime', async () => {
    const { useDuoStreaks } = await import('./useDuoStreaks')
    renderHook(() => useDuoStreaks())

    await waitFor(() => expect(channelMock).toHaveBeenCalledWith(expect.stringMatching(/^duo-streaks-/)))
  })
})
