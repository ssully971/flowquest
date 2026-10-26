import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

describe('current-campaign — bandeau Double XP (lot I3, §6)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('renvoie la première ligne quand une campagne est active', async () => {
    rpcMock.mockResolvedValue({
      data: [{ name: 'Week-end Double XP', xp_multiplier: 2, ends_at: '2026-06-03T00:00:00.000Z' }],
      error: null,
    })
    const { fetchCurrentCampaign } = await import('./current-campaign')

    expect(await fetchCurrentCampaign()).toEqual({
      name: 'Week-end Double XP',
      xp_multiplier: 2,
      ends_at: '2026-06-03T00:00:00.000Z',
    })
  })

  it('renvoie null quand aucune campagne n’est active', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const { fetchCurrentCampaign } = await import('./current-campaign')

    expect(await fetchCurrentCampaign()).toBeNull()
  })

  it('renvoie null en cas d’erreur', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { fetchCurrentCampaign } = await import('./current-campaign')

    expect(await fetchCurrentCampaign()).toBeNull()
  })
})
