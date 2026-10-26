import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

describe('stats-admin — Vue d’ensemble (lot I2, §2)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('appelle la RPC admin_stats_overview sans argument', async () => {
    const overview = { totalSignups: 12, dau: 3 }
    rpcMock.mockResolvedValue({ data: overview, error: null })
    const { fetchAdminStatsOverview } = await import('./stats-admin')

    const result = await fetchAdminStatsOverview()

    expect(rpcMock).toHaveBeenCalledWith('admin_stats_overview')
    expect(result).toEqual(overview)
  })

  it('renvoie null en cas d’erreur (jamais une exception qui casse l’écran)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'réservé aux administrateurs' } })
    const { fetchAdminStatsOverview } = await import('./stats-admin')

    expect(await fetchAdminStatsOverview()).toBeNull()
  })
})
