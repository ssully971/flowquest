import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

describe('admin-delete-user — suppression nucléaire (lot I3, §5)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('transmet la cible et le pseudo de confirmation tel quel à admin_delete_user', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { deleteUserNuclear } = await import('./admin-delete-user')

    await deleteUserNuclear('u1', 'bob')

    expect(rpcMock).toHaveBeenCalledWith('admin_delete_user', {
      p_target_user_id: 'u1',
      p_confirm_username: 'bob',
    })
  })

  it('relance l’erreur du serveur (pseudo incorrect, cible admin...) plutôt que de l’avaler', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Le pseudo saisi ne correspond pas à celui du compte à supprimer' },
    })
    const { deleteUserNuclear } = await import('./admin-delete-user')

    await expect(deleteUserNuclear('u1', 'wrong')).rejects.toMatchObject({
      message: 'Le pseudo saisi ne correspond pas à celui du compte à supprimer',
    })
  })
})
