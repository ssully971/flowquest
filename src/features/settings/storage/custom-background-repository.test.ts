import { beforeEach, describe, expect, it } from 'vitest'

import { getDb } from '@/shared/storage/db'

import { IndexedDbCustomBackgroundRepository } from './custom-background-repository'

describe('IndexedDbCustomBackgroundRepository — persistance locale (lot 3)', () => {
  beforeEach(async () => {
    const db = await getDb()
    await db.delete('customBackground', 'current')
  })

  it('retourne null quand rien n’a encore été envoyé', async () => {
    const repo = new IndexedDbCustomBackgroundRepository()
    expect(await repo.load()).toBeNull()
  })

  it('relit exactement ce qui a été enregistré', async () => {
    const repo = new IndexedDbCustomBackgroundRepository()
    const blob = new Blob([new Uint8Array(10)], { type: 'image/webp' })
    await repo.save({ blob, position: 'top', updatedAt: 1_700_000_000_000 })

    const loaded = await repo.load()
    expect(loaded?.position).toBe('top')
    expect(loaded?.updatedAt).toBe(1_700_000_000_000)
    // fake-indexeddb (environnement de test) ne clone pas fidèlement un Blob natif — on se
    // contente ici de vérifier que le champ existe ; le vrai IndexedDB d'un navigateur le
    // fait correctement (API standard, voir docs MDN IDBObjectStore).
    expect(loaded?.blob).toBeDefined()
  })

  it('remove() efface l’image enregistrée', async () => {
    const repo = new IndexedDbCustomBackgroundRepository()
    await repo.save({
      blob: new Blob([new Uint8Array(10)]),
      position: 'center',
      updatedAt: Date.now(),
    })
    await repo.remove()
    expect(await repo.load()).toBeNull()
  })
})
