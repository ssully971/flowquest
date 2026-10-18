import { beforeEach, describe, expect, it, vi } from 'vitest'

import { QUOTES } from './quotes'

const eqMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

describe('fetchQuotePool — citations gérées par le panneau Admin (§12), avec repli statique', () => {
  beforeEach(() => {
    fromMock.mockReset()
    eqMock.mockReset()
    fromMock.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: eqMock }) })
  })

  it('retourne les citations actives de la base quand elle en contient', async () => {
    eqMock.mockResolvedValue({
      data: [{ text: 'Une citation', author: 'Quelqu’un', category: 'focus' }],
      error: null,
    })
    const { fetchQuotePool } = await import('./quote-pool')

    const pool = await fetchQuotePool()

    expect(pool).toEqual([{ text: 'Une citation', author: 'Quelqu’un', category: 'focus' }])
  })

  it('se replie sur le tableau statique quand la base est vide', async () => {
    eqMock.mockResolvedValue({ data: [], error: null })
    const { fetchQuotePool } = await import('./quote-pool')

    expect(await fetchQuotePool()).toEqual(QUOTES)
  })

  it('se replie sur le tableau statique en cas d’erreur', async () => {
    eqMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { fetchQuotePool } = await import('./quote-pool')

    expect(await fetchQuotePool()).toEqual(QUOTES)
  })

  it('utilise « focus » par défaut si une citation a une catégorie inattendue', async () => {
    eqMock.mockResolvedValue({
      data: [{ text: 'Une citation', author: null, category: 'autre' }],
      error: null,
    })
    const { fetchQuotePool } = await import('./quote-pool')

    const pool = await fetchQuotePool()
    expect(pool).toEqual([{ text: 'Une citation', author: '', category: 'focus' }])
  })
})
