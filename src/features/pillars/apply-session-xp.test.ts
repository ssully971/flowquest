import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'
import type { PillarRecord } from '@/shared/storage/db'

const maybeSingleMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }),
  },
}))

async function clearPillars() {
  const db = await getDb()
  const keys = await db.getAllKeys('pillars')
  await Promise.all(keys.map((key) => db.delete('pillars', key)))
}

async function seedPillar(overrides: Partial<PillarRecord> = {}): Promise<PillarRecord> {
  const pillar: PillarRecord = {
    id: 'pillar-1',
    name: 'Travail',
    color: '#4A9FE8',
    currentXp: 0,
    level: 1,
    createdAt: Date.now(),
    archivedAt: null,
    ...overrides,
  }
  const db = await getDb()
  await db.put('pillars', pillar)
  return pillar
}

describe('applySessionXp', () => {
  beforeEach(async () => {
    maybeSingleMock.mockReset()
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    await clearPillars()
  })

  it('crédite l’XP (1 min réelle = 10 XP) sans changer de niveau', async () => {
    await seedPillar({ currentXp: 100 })
    const { applySessionXp } = await import('./apply-session-xp')

    const result = await applySessionXp('pillar-1', 5 * 60) // 5 min
    expect(result).toEqual({
      pillarId: 'pillar-1',
      pillarName: 'Travail',
      previousLevel: 1,
      newLevel: 1,
      leveledUp: false,
    })

    const db = await getDb()
    const pillar = await db.get('pillars', 'pillar-1')
    expect(pillar?.currentXp).toBe(150) // 100 + 5*10
  })

  it('détecte un passage de niveau', async () => {
    await seedPillar({ currentXp: 595, level: 1 })
    const { applySessionXp } = await import('./apply-session-xp')

    const result = await applySessionXp('pillar-1', 60) // +10 XP → 605, seuil niveau 2 = 600
    expect(result?.leveledUp).toBe(true)
    expect(result?.previousLevel).toBe(1)
    expect(result?.newLevel).toBe(2)
  })

  it('renvoie null pour un pilier introuvable (supprimé entre-temps)', async () => {
    const { applySessionXp } = await import('./apply-session-xp')
    const result = await applySessionXp('does-not-exist', 60)
    expect(result).toBeNull()
  })
})

describe('reconcilePillarFromServer', () => {
  beforeEach(async () => {
    maybeSingleMock.mockReset()
    await clearPillars()
  })

  it('remplace la valeur optimiste locale par la valeur serveur', async () => {
    await seedPillar({ currentXp: 999, level: 5 }) // valeur optimiste volontairement fausse
    maybeSingleMock.mockResolvedValue({
      data: {
        id: 'pillar-1',
        name: 'Travail',
        color: '#4A9FE8',
        current_xp: 620,
        level: 2,
        created_at: new Date().toISOString(),
        archived_at: null,
      },
      error: null,
    })

    const { reconcilePillarFromServer } = await import('./apply-session-xp')
    await reconcilePillarFromServer('pillar-1')

    const db = await getDb()
    const pillar = await db.get('pillars', 'pillar-1')
    expect(pillar?.currentXp).toBe(620)
    expect(pillar?.level).toBe(2)
  })

  it('ne fait rien en mode invité (pullOnePillar renvoie null)', async () => {
    await seedPillar({ currentXp: 42 })
    maybeSingleMock.mockResolvedValue({ data: null, error: null })

    const { reconcilePillarFromServer } = await import('./apply-session-xp')
    await reconcilePillarFromServer('pillar-1')

    const db = await getDb()
    const pillar = await db.get('pillars', 'pillar-1')
    expect(pillar?.currentXp).toBe(42)
  })
})
