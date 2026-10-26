import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

describe('admin-user-stats — god mode (lot I3, §3)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('appelle admin_user_stats avec la cible et renvoie le résultat', async () => {
    const stats = { totalFocusSeconds: 120, dailyFocus: [], pillars: [], recentActivity: [] }
    rpcMock.mockResolvedValue({ data: stats, error: null })
    const { fetchAdminUserStats } = await import('./admin-user-stats')

    const result = await fetchAdminUserStats('u1')

    expect(rpcMock).toHaveBeenCalledWith('admin_user_stats', { p_target_user_id: 'u1' })
    expect(result).toEqual(stats)
  })

  it('renvoie null en cas d’erreur (jamais une exception qui casse l’écran)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'réservé aux administrateurs' } })
    const { fetchAdminUserStats } = await import('./admin-user-stats')

    expect(await fetchAdminUserStats('u1')).toBeNull()
  })
})
