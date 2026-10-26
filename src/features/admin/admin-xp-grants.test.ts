import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

describe('admin-xp-grants — offrir de l’XP (lot I3, §6)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('listUserPillarsForGrant appelle admin_list_user_pillars avec la cible', async () => {
    rpcMock.mockResolvedValue({ data: [{ id: 'p1', name: 'Travail' }], error: null })
    const { listUserPillarsForGrant } = await import('./admin-xp-grants')

    const result = await listUserPillarsForGrant('u1')

    expect(rpcMock).toHaveBeenCalledWith('admin_list_user_pillars', { p_target_user_id: 'u1' })
    expect(result).toEqual([{ id: 'p1', name: 'Travail' }])
  })

  it('grantXp transmet cible/pilier/quantité/motif à admin_grant_xp', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'g1' }, error: null })
    const { grantXp } = await import('./admin-xp-grants')

    await grantXp('u1', 'p1', 200, 'Merci d’avoir signalé un bug')

    expect(rpcMock).toHaveBeenCalledWith('admin_grant_xp', {
      p_target_user_id: 'u1',
      p_pillar_id: 'p1',
      p_amount: 200,
      p_reason: 'Merci d’avoir signalé un bug',
    })
  })

  it('grantXp relance l’erreur serveur (plafond, motif manquant...)', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'La quantité d’XP doit être comprise entre 1 et 1000' },
    })
    const { grantXp } = await import('./admin-xp-grants')

    await expect(grantXp('u1', 'p1', 5000, 'test')).rejects.toMatchObject({
      message: 'La quantité d’XP doit être comprise entre 1 et 1000',
    })
  })
})
