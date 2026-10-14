import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'

const upsertMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: upsertMock,
    }),
  },
}))

describe('file d’attente hors ligne — jamais de perte silencieuse', () => {
  beforeEach(async () => {
    upsertMock.mockReset()
    const db = await getDb()
    const keys = await db.getAllKeys('syncQueue')
    await Promise.all(keys.map((key) => db.delete('syncQueue', key)))
  })

  it('garde une écriture en file si la synchronisation échoue (hors ligne)', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'network error' } })
    const { enqueueWrite, flushQueue, pendingWriteCount } = await import('./offline-queue')

    await enqueueWrite('user_settings', {
      user_id: 'user-1',
      schema_version: 1,
      settings: {},
      updated_at: new Date().toISOString(),
    })
    await flushQueue()

    expect(await pendingWriteCount()).toBe(1)
  })

  it('retire une écriture de la file une fois synchronisée avec succès', async () => {
    upsertMock.mockResolvedValue({ error: null })
    const { enqueueWrite, flushQueue, pendingWriteCount } = await import('./offline-queue')

    await enqueueWrite('user_settings', {
      user_id: 'user-1',
      schema_version: 1,
      settings: {},
      updated_at: new Date().toISOString(),
    })
    await flushQueue()

    expect(await pendingWriteCount()).toBe(0)
  })

  it('rejoue la file dans l’ordre et s’arrête à la première erreur (sans perdre les suivantes)', async () => {
    upsertMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValue({ error: { message: 'down' } })
    const { enqueueWrite, flushQueue, pendingWriteCount } = await import('./offline-queue')

    await enqueueWrite('user_settings', {
      user_id: 'user-1',
      schema_version: 1,
      settings: {},
      updated_at: new Date().toISOString(),
    })
    await enqueueWrite('user_settings', {
      user_id: 'user-1',
      schema_version: 1,
      settings: { appearance: 'dark' },
      updated_at: new Date().toISOString(),
    })
    await flushQueue()
    await flushQueue()

    // La première réussit (retirée), la seconde échoue (reste en file).
    expect(await pendingWriteCount()).toBe(1)
  })
})
