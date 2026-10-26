import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

describe('admin-campaigns — Maître du jeu (lot I3, §6)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('listCampaigns appelle admin_list_campaigns sans argument', async () => {
    rpcMock.mockResolvedValue({ data: [{ id: 'c1' }], error: null })
    const { listCampaigns } = await import('./admin-campaigns')

    const result = await listCampaigns()

    expect(rpcMock).toHaveBeenCalledWith('admin_list_campaigns')
    expect(result).toEqual([{ id: 'c1' }])
  })

  it('startDoubleXpWeekend démarre une campagne ×2 de 48 h à partir de maintenant', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'c1' }, error: null })
    const { startDoubleXpWeekend } = await import('./admin-campaigns')

    await startDoubleXpWeekend()

    expect(rpcMock).toHaveBeenCalledWith('admin_start_campaign', {
      p_name: 'Week-end Double XP',
      p_xp_multiplier: 2,
      p_starts_at: '2026-06-01T00:00:00.000Z',
      p_ends_at: '2026-06-03T00:00:00.000Z',
    })
  })

  it('startCustomCampaign transmet nom/multiplicateur/dates tels quels', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'c2' }, error: null })
    const { startCustomCampaign } = await import('./admin-campaigns')

    const starts = new Date('2026-07-01T10:00:00.000Z')
    const ends = new Date('2026-07-02T10:00:00.000Z')
    await startCustomCampaign('Marathon', 3, starts, ends)

    expect(rpcMock).toHaveBeenCalledWith('admin_start_campaign', {
      p_name: 'Marathon',
      p_xp_multiplier: 3,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends.toISOString(),
    })
  })

  it('stopCampaign renvoie true/false selon le résultat', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })
    const { stopCampaign } = await import('./admin-campaigns')
    expect(await stopCampaign('c1')).toBe(true)

    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    expect(await stopCampaign('c1')).toBe(false)
  })
})
