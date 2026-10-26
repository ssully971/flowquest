import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

describe('journal-admin — Journal filtrable (lot I2, §3)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('appelle admin_list_log avec la limite et une recherche nulle par défaut', async () => {
    rpcMock.mockResolvedValue({ data: [{ id: 'log-1' }], error: null })
    const { listAdminLog } = await import('./journal-admin')

    const result = await listAdminLog(50, null)

    expect(rpcMock).toHaveBeenCalledWith('admin_list_log', { p_limit: 50, p_search: null })
    expect(result).toEqual([{ id: 'log-1' }])
  })

  it('élague les espaces superflus et transmet une chaîne vide comme recherche nulle', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const { listAdminLog } = await import('./journal-admin')

    await listAdminLog(50, '  rooms  ')
    expect(rpcMock).toHaveBeenCalledWith('admin_list_log', { p_limit: 50, p_search: 'rooms' })

    await listAdminLog(50, '   ')
    expect(rpcMock).toHaveBeenLastCalledWith('admin_list_log', { p_limit: 50, p_search: null })
  })

  it('renvoie un tableau vide en cas d’erreur', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { listAdminLog } = await import('./journal-admin')

    expect(await listAdminLog(50, null)).toEqual([])
  })
})
