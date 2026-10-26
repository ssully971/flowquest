import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

describe('admin-users — visionneuse et modération (lot I3, §1-2)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('listAdminUsers transmet pagination, recherche élaguée et tri à admin_list_users', async () => {
    rpcMock.mockResolvedValue({ data: [{ id: 'u1', total_count: 1 }], error: null })
    const { listAdminUsers } = await import('./admin-users')

    const result = await listAdminUsers(20, 0, '  alice  ', 'username_asc')

    expect(rpcMock).toHaveBeenCalledWith('admin_list_users', {
      p_limit: 20,
      p_offset: 0,
      p_search: 'alice',
      p_sort: 'username_asc',
    })
    expect(result).toEqual([{ id: 'u1', total_count: 1 }])
  })

  it('listAdminUsers transmet une recherche vide comme null', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const { listAdminUsers } = await import('./admin-users')

    await listAdminUsers(20, 0, '   ', 'created_at_desc')

    expect(rpcMock).toHaveBeenCalledWith('admin_list_users', {
      p_limit: 20,
      p_offset: 0,
      p_search: null,
      p_sort: 'created_at_desc',
    })
  })

  it('listAdminUsers renvoie un tableau vide en cas d’erreur', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { listAdminUsers } = await import('./admin-users')

    expect(await listAdminUsers(20, 0, null, 'created_at_desc')).toEqual([])
  })

  it('exportAdminUsers transmet le filtre de consentement', async () => {
    rpcMock.mockResolvedValue({ data: [{ email: 'a@b.com' }], error: null })
    const { exportAdminUsers } = await import('./admin-users')

    await exportAdminUsers(true)
    expect(rpcMock).toHaveBeenCalledWith('admin_export_users', { p_only_consented: true })

    await exportAdminUsers(false)
    expect(rpcMock).toHaveBeenLastCalledWith('admin_export_users', { p_only_consented: false })
  })

  it('suspendUser transmet la durée et élague le motif', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { suspendUser } = await import('./admin-users')

    const ok = await suspendUser('u1', 7, '  spam  ')

    expect(rpcMock).toHaveBeenCalledWith('admin_suspend_user', {
      p_target_user_id: 'u1',
      p_duration_days: 7,
      p_reason: 'spam',
    })
    expect(ok).toBe(true)
  })

  it('suspendUser renvoie false en cas d’erreur', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'réservé aux administrateurs' } })
    const { suspendUser } = await import('./admin-users')

    expect(await suspendUser('u1', 1, null)).toBe(false)
  })

  it('unsuspendUser/banUser/unbanUser/removeUserAvatar appellent les bonnes RPC', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { banUser, removeUserAvatar, unbanUser, unsuspendUser } = await import('./admin-users')

    await unsuspendUser('u1')
    expect(rpcMock).toHaveBeenLastCalledWith('admin_unsuspend_user', { p_target_user_id: 'u1' })

    await banUser('u1', null)
    expect(rpcMock).toHaveBeenLastCalledWith('admin_ban_user', {
      p_target_user_id: 'u1',
      p_reason: null,
    })

    await unbanUser('u1')
    expect(rpcMock).toHaveBeenLastCalledWith('admin_unban_user', { p_target_user_id: 'u1' })

    await removeUserAvatar('u1')
    expect(rpcMock).toHaveBeenLastCalledWith('admin_remove_avatar', { p_target_user_id: 'u1' })
  })
})
