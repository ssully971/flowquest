import { beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

describe('quotes-admin — données du panneau Admin (§12)', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('listAllQuotes lit toutes les citations, triées par date décroissante', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'q1' }], error: null })
    const select = vi.fn().mockReturnValue({ order })
    fromMock.mockReturnValue({ select })
    const { listAllQuotes } = await import('./quotes-admin')

    const result = await listAllQuotes()

    expect(fromMock).toHaveBeenCalledWith('quotes')
    expect(select).toHaveBeenCalledWith('*')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual([{ id: 'q1' }])
  })

  it('listAllQuotes retourne un tableau vide en cas d’erreur', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    fromMock.mockReturnValue({ select: vi.fn().mockReturnValue({ order }) })
    const { listAllQuotes } = await import('./quotes-admin')

    expect(await listAllQuotes()).toEqual([])
  })

  it('createQuote insère la citation et renvoie la ligne créée', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'q2' }, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    fromMock.mockReturnValue({ insert })
    const { createQuote } = await import('./quotes-admin')

    const result = await createQuote({ text: 'Citation', author: 'Auteur', category: 'focus' })

    expect(insert).toHaveBeenCalledWith({ text: 'Citation', author: 'Auteur', category: 'focus' })
    expect(result).toEqual({ id: 'q2' })
  })

  it('setQuoteActive met à jour le champ active de la bonne ligne', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    fromMock.mockReturnValue({ update })
    const { setQuoteActive } = await import('./quotes-admin')

    const result = await setQuoteActive('q1', false)

    expect(update).toHaveBeenCalledWith({ active: false })
    expect(eq).toHaveBeenCalledWith('id', 'q1')
    expect(result).toBe(true)
  })

  it('deleteQuote supprime la bonne ligne', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const deleteFn = vi.fn().mockReturnValue({ eq })
    fromMock.mockReturnValue({ delete: deleteFn })
    const { deleteQuote } = await import('./quotes-admin')

    const result = await deleteQuote('q1')

    expect(deleteFn).toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('id', 'q1')
    expect(result).toBe(true)
  })
})
