import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CHANGELOG } from './changelog'

const orderMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

describe('fetchChangelogEntries — nouveautés gérées par le panneau Admin (§12), avec repli statique', () => {
  beforeEach(() => {
    fromMock.mockReset()
    orderMock.mockReset()
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: orderMock }) }),
    })
  })

  it('retourne les entrées publiées triées par date décroissante', async () => {
    orderMock.mockResolvedValue({
      data: [{ version: '0.4.0', released_at: '2026-11-01', body: 'Nouveautés' }],
      error: null,
    })
    const { fetchChangelogEntries } = await import('./changelog-db')

    const entries = await fetchChangelogEntries()

    expect(entries).toEqual([{ version: '0.4.0', date: '2026-11-01', text: 'Nouveautés' }])
  })

  it('se replie sur le tableau statique quand la base est vide', async () => {
    orderMock.mockResolvedValue({ data: [], error: null })
    const { fetchChangelogEntries } = await import('./changelog-db')

    expect(await fetchChangelogEntries()).toEqual(CHANGELOG)
  })

  it('se replie sur le tableau statique en cas d’erreur', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { fetchChangelogEntries } = await import('./changelog-db')

    expect(await fetchChangelogEntries()).toEqual(CHANGELOG)
  })
})
