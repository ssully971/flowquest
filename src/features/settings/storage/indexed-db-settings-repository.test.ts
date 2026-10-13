import { beforeEach, describe, expect, it } from 'vitest'

import { getDb } from '@/shared/storage/db'

import { IndexedDbSettingsRepository } from './indexed-db-settings-repository'

describe('IndexedDbSettingsRepository — persistance locale des réglages', () => {
  beforeEach(async () => {
    const db = await getDb()
    await db.delete('settings', 'current')
  })

  it('retourne null quand rien n’a encore été enregistré', async () => {
    const repo = new IndexedDbSettingsRepository()
    expect(await repo.load()).toBeNull()
  })

  it('relit exactement ce qui a été enregistré (aller-retour)', async () => {
    const repo = new IndexedDbSettingsRepository()
    const settings = {
      appearance: 'dark' as const,
      backgrounds: { home: 'aubergine' as const, focus: 'brume' as const },
    }

    await repo.save(settings, 1_700_000_000_000)
    const loaded = await repo.load()

    expect(loaded?.settings).toEqual(settings)
    expect(loaded?.updatedAt).toBe(1_700_000_000_000)
    expect(loaded?.schemaVersion).toBe(1)
  })
})
