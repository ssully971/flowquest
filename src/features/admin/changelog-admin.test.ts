import { beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

describe('changelog-admin — données du panneau Admin (§12)', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('listAllChangelogEntries lit toutes les entrées, triées par date décroissante', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'c1' }], error: null })
    const select = vi.fn().mockReturnValue({ order })
    fromMock.mockReturnValue({ select })
    const { listAllChangelogEntries } = await import('./changelog-admin')

    const result = await listAllChangelogEntries()

    expect(fromMock).toHaveBeenCalledWith('changelog')
    expect(order).toHaveBeenCalledWith('released_at', { ascending: false })
    expect(result).toEqual([{ id: 'c1' }])
  })

  it('createChangelogEntry insère l’entrée et renvoie la ligne créée', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'c2' }, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    fromMock.mockReturnValue({ insert })
    const { createChangelogEntry } = await import('./changelog-admin')

    const result = await createChangelogEntry({
      version: '0.4.0',
      released_at: '2026-11-01',
      body: 'Texte',
    })

    expect(insert).toHaveBeenCalledWith({
      version: '0.4.0',
      released_at: '2026-11-01',
      body: 'Texte',
    })
    expect(result).toEqual({ id: 'c2' })
  })

  it('setChangelogEntryActive met à jour le champ active de la bonne ligne', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    fromMock.mockReturnValue({ update })
    const { setChangelogEntryActive } = await import('./changelog-admin')

    const result = await setChangelogEntryActive('c1', false)

    expect(update).toHaveBeenCalledWith({ active: false })
    expect(eq).toHaveBeenCalledWith('id', 'c1')
    expect(result).toBe(true)
  })

  it('deleteChangelogEntry supprime la bonne ligne', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const deleteFn = vi.fn().mockReturnValue({ eq })
    fromMock.mockReturnValue({ delete: deleteFn })
    const { deleteChangelogEntry } = await import('./changelog-admin')

    const result = await deleteChangelogEntry('c1')

    expect(deleteFn).toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('id', 'c1')
    expect(result).toBe(true)
  })
})
