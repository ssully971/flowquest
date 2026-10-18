import { beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

describe('support-admin — messages de support côté panneau Admin (§12)', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('listSupportMessages lit tous les messages, triés par date décroissante', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'm1' }], error: null })
    const select = vi.fn().mockReturnValue({ order })
    fromMock.mockReturnValue({ select })
    const { listSupportMessages } = await import('./support-admin')

    const result = await listSupportMessages()

    expect(fromMock).toHaveBeenCalledWith('support_messages')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual([{ id: 'm1' }])
  })

  it('listSupportMessages retourne un tableau vide en cas d’erreur', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    fromMock.mockReturnValue({ select: vi.fn().mockReturnValue({ order }) })
    const { listSupportMessages } = await import('./support-admin')

    expect(await listSupportMessages()).toEqual([])
  })

  it('setSupportMessageStatus met à jour le statut de la bonne ligne', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    fromMock.mockReturnValue({ update })
    const { setSupportMessageStatus } = await import('./support-admin')

    const result = await setSupportMessageStatus('m1', 'processed')

    expect(update).toHaveBeenCalledWith({ status: 'processed' })
    expect(eq).toHaveBeenCalledWith('id', 'm1')
    expect(result).toBe(true)
  })
})
