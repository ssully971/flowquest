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

  it('listAdminUsers fait remonter la VRAIE erreur (code + message), jamais une liste vide', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: '42804',
        message: 'structure of query does not match function result type',
        details:
          'Returned type character varying(255) does not match expected type text in column 2.',
      },
    })
    const { AdminUsersError, listAdminUsers } = await import('./admin-users')

    const failure = await listAdminUsers(20, 0, null, 'created_at_desc').catch(
      (err: unknown) => err,
    )

    expect(failure).toBeInstanceOf(AdminUsersError)
    const error = failure as InstanceType<typeof AdminUsersError>
    expect(error.code).toBe('42804')
    expect(error.message).toBe('structure of query does not match function result type')
    expect(error.technical).toContain('42804')
    expect(error.technical).toContain('character varying(255)')
  })

  it('listAdminUsers distingue une liste vide (succès) d’un échec', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const { listAdminUsers } = await import('./admin-users')
    expect(await listAdminUsers(20, 0, null, 'created_at_desc')).toEqual([])

    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(listAdminUsers(20, 0, null, 'created_at_desc')).rejects.toThrow('boom')
  })

  it('exportAdminUsers fait aussi remonter l’erreur', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })
    const { exportAdminUsers } = await import('./admin-users')
    await expect(exportAdminUsers(true)).rejects.toMatchObject({
      code: '42501',
      message: 'permission denied',
    })
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

    await suspendUser('u1', 7, '  spam  ')

    expect(rpcMock).toHaveBeenCalledWith('admin_suspend_user', {
      p_target_user_id: 'u1',
      p_duration_days: 7,
      p_reason: 'spam',
    })
  })

  it('les actions de modération rejettent avec le vrai message en cas d’erreur', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'réservé aux administrateurs' } })
    const { banUser, removeUserAvatar, suspendUser, unbanUser, unsuspendUser } =
      await import('./admin-users')

    await expect(suspendUser('u1', 1, null)).rejects.toThrow('réservé aux administrateurs')
    await expect(unsuspendUser('u1')).rejects.toThrow('réservé aux administrateurs')
    await expect(banUser('u1', null)).rejects.toThrow('réservé aux administrateurs')
    await expect(unbanUser('u1')).rejects.toThrow('réservé aux administrateurs')
    await expect(removeUserAvatar('u1')).rejects.toThrow('réservé aux administrateurs')
  })

  it('repairUserProfile appelle admin_repair_profile', async () => {
    rpcMock.mockResolvedValue({ data: 'u1', error: null })
    const { repairUserProfile } = await import('./admin-users')

    await repairUserProfile('u1')

    expect(rpcMock).toHaveBeenCalledWith('admin_repair_profile', { p_target_user_id: 'u1' })
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
