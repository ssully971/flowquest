import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
const fetchWeeklyLeaderboardMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('./friends-repository', () => ({
  FriendsError: class FriendsError extends Error {},
  fetchWeeklyLeaderboard: (...args: unknown[]) => fetchWeeklyLeaderboardMock(...args),
}))

const LEADERBOARD = {
  entries: [{ id: 'u1', username: 'moi', displayName: null, avatarUrl: null, avatarVersion: 0, rank: 1, isSelf: true, score: 90, focusSeconds: 7200, completionRate: 100, regularityRate: 90 }],
  weekStart: '2026-01-05T04:00:00Z',
  weekEnd: '2026-01-12T04:00:00Z',
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ status: 'authenticated' })
  fetchWeeklyLeaderboardMock.mockReset().mockResolvedValue(LEADERBOARD)
})

describe('useLeaderboard — classement hebdomadaire (LOT F2)', () => {
  it('charge la semaine en cours (0) au montage', async () => {
    const { useLeaderboard } = await import('./useLeaderboard')
    const { result } = renderHook(() => useLeaderboard())

    await waitFor(() => expect(result.current.leaderboard).toEqual(LEADERBOARD))
    expect(fetchWeeklyLeaderboardMock).toHaveBeenCalledWith(0)
  })

  it('recharge avec le bon décalage quand on change de semaine', async () => {
    const { useLeaderboard } = await import('./useLeaderboard')
    const { result } = renderHook(() => useLeaderboard())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.setWeekOffset(1)
    })

    await waitFor(() => expect(fetchWeeklyLeaderboardMock).toHaveBeenCalledWith(1))
  })

  it('expose une erreur de chargement en cas d’échec', async () => {
    const { FriendsError } = await import('./friends-repository')
    fetchWeeklyLeaderboardMock.mockRejectedValue(new FriendsError('Oups'))
    const { useLeaderboard } = await import('./useLeaderboard')
    const { result } = renderHook(() => useLeaderboard())

    await waitFor(() => expect(result.current.loadError).toBe('Oups'))
  })

  it('ne charge rien en mode invité', async () => {
    useAuthMock.mockReturnValue({ status: 'guest' })
    const { useLeaderboard } = await import('./useLeaderboard')
    renderHook(() => useLeaderboard())

    await Promise.resolve()
    expect(fetchWeeklyLeaderboardMock).not.toHaveBeenCalled()
  })
})
