import { beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

describe('feature-flags-admin — données du panneau Admin (lot I2, §1)', () => {
  beforeEach(() => {
    fromMock.mockReset()
    rpcMock.mockReset()
  })

  it('listFeatureFlags lit tous les drapeaux triés par clé', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ key: 'rooms' }], error: null })
    fromMock.mockReturnValue({ select: vi.fn().mockReturnValue({ order }) })
    const { listFeatureFlags } = await import('./feature-flags-admin')

    const result = await listFeatureFlags()

    expect(fromMock).toHaveBeenCalledWith('feature_flags')
    expect(order).toHaveBeenCalledWith('key')
    expect(result).toEqual([{ key: 'rooms' }])
  })

  it('listFeatureFlags retourne un tableau vide en cas d’erreur', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    fromMock.mockReturnValue({ select: vi.fn().mockReturnValue({ order }) })
    const { listFeatureFlags } = await import('./feature-flags-admin')

    expect(await listFeatureFlags()).toEqual([])
  })

  it('setFeatureFlag passe toujours par la RPC admin_set_feature_flag, jamais une écriture directe', async () => {
    rpcMock.mockResolvedValue({ data: { key: 'rooms', enabled: false }, error: null })
    const { setFeatureFlag } = await import('./feature-flags-admin')

    const result = await setFeatureFlag('rooms', false)

    expect(rpcMock).toHaveBeenCalledWith('admin_set_feature_flag', {
      flag_key: 'rooms',
      new_enabled: false,
      new_description: null,
    })
    expect(fromMock).not.toHaveBeenCalled()
    expect(result).toEqual({ key: 'rooms', enabled: false })
  })

  it('setFeatureFlag transmet la description quand elle est fournie', async () => {
    rpcMock.mockResolvedValue({ data: { key: 'maintenance' }, error: null })
    const { setFeatureFlag } = await import('./feature-flags-admin')

    await setFeatureFlag('maintenance', true, 'Retour en ligne dimanche soir.')

    expect(rpcMock).toHaveBeenCalledWith('admin_set_feature_flag', {
      flag_key: 'maintenance',
      new_enabled: true,
      new_description: 'Retour en ligne dimanche soir.',
    })
  })

  it('setFeatureFlag renvoie null en cas d’erreur', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'réservé aux administrateurs' } })
    const { setFeatureFlag } = await import('./feature-flags-admin')

    expect(await setFeatureFlag('rooms', false)).toBeNull()
  })
})
