import { beforeEach, describe, expect, it, vi } from 'vitest'

const isMock = vi.fn()
const orderMock = vi.fn()
const selectMock = vi.fn()
const fromMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

describe('xp-grant-notice — cadeaux d’XP reçus (lot I3, §6)', () => {
  beforeEach(() => {
    fromMock.mockReset()
    rpcMock.mockReset()
    isMock.mockReset()
    orderMock.mockReset()
    selectMock.mockReset()
    orderMock.mockResolvedValue({ data: [{ id: 'g1', amount: 200 }], error: null })
    isMock.mockReturnValue({ order: orderMock })
    selectMock.mockReturnValue({ is: isMock })
    fromMock.mockReturnValue({ select: selectMock })
  })

  it('listUnseenXpGrants interroge xp_grants où seen_at est nul', async () => {
    const { listUnseenXpGrants } = await import('./xp-grant-notice')

    const result = await listUnseenXpGrants()

    expect(fromMock).toHaveBeenCalledWith('xp_grants')
    expect(isMock).toHaveBeenCalledWith('seen_at', null)
    expect(result).toEqual([{ id: 'g1', amount: 200 }])
  })

  it('listUnseenXpGrants renvoie un tableau vide en cas d’erreur', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { listUnseenXpGrants } = await import('./xp-grant-notice')

    expect(await listUnseenXpGrants()).toEqual([])
  })

  it('acknowledgeXpGrant appelle acknowledge_xp_grant avec l’identifiant du cadeau', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { acknowledgeXpGrant } = await import('./xp-grant-notice')

    await acknowledgeXpGrant('g1')

    expect(rpcMock).toHaveBeenCalledWith('acknowledge_xp_grant', { p_grant_id: 'g1' })
  })
})
