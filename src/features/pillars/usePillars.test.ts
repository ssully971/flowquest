import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setCurrentUserId } from '@/features/auth/current-user'
import type { PillarRecord } from '@/shared/storage/db'
import { getDb } from '@/shared/storage/db'

const upsertMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: () => ({ upsert: upsertMock }),
  },
}))

async function clearPillars() {
  const db = await getDb()
  const keys = await db.getAllKeys('pillars')
  await Promise.all(keys.map((key) => db.delete('pillars', key)))
  const queueKeys = await db.getAllKeys('syncQueue')
  await Promise.all(queueKeys.map((key) => db.delete('syncQueue', key)))
}

async function seedPillars(count: number, overrides: Partial<PillarRecord> = {}) {
  const db = await getDb()
  for (let index = 0; index < count; index++) {
    const pillar: PillarRecord = {
      id: `seed-${index}`,
      name: `Pilier ${index}`,
      color: '#4A9FE8',
      currentXp: 0,
      level: 1,
      createdAt: Date.now() + index,
      archivedAt: null,
      ...overrides,
    }
    await db.put('pillars', pillar)
  }
}

describe('usePillars — bootstrap du pilier par défaut (LOT G3)', () => {
  beforeEach(async () => {
    upsertMock.mockReset()
    upsertMock.mockResolvedValue({ error: null })
    setCurrentUserId(null)
    await clearPillars()
  })

  it('crée « Général » à la toute première utilisation', async () => {
    const { usePillars } = await import('./usePillars')
    const { result } = renderHook(() => usePillars())

    await waitFor(() => expect(result.current.activePillars).toHaveLength(1))
    expect(result.current.activePillars[0].name).toBe('Général')
    expect(result.current.activePillars[0].currentXp).toBe(0)
    expect(result.current.activePillars[0].level).toBe(1)
  })

  it('ne recrée jamais « Général » si l’utilisateur a archivé son seul pilier', async () => {
    await seedPillars(1, { name: 'Mon pilier', archivedAt: Date.now() })
    const { usePillars } = await import('./usePillars')
    const { result } = renderHook(() => usePillars())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // Laisse le temps à l'effet de bootstrap de potentiellement s'exécuter (il ne doit
    // rien faire ici).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    expect(result.current.pillars).toHaveLength(1)
    expect(result.current.activePillars).toHaveLength(0)
  })
})

describe('usePillars — CRUD', () => {
  beforeEach(async () => {
    upsertMock.mockReset()
    upsertMock.mockResolvedValue({ error: null })
    setCurrentUserId(null)
    await clearPillars()
  })

  it('ajoute un pilier et le relit depuis IndexedDB', async () => {
    const { usePillars } = await import('./usePillars')
    const { result } = renderHook(() => usePillars())
    await waitFor(() => expect(result.current.activePillars).toHaveLength(1)) // Général

    await act(async () => {
      await result.current.addPillar('Sport', '#5FB86B')
    })

    await waitFor(() => expect(result.current.activePillars).toHaveLength(2))
    const sport = result.current.activePillars.find((pillar) => pillar.name === 'Sport')
    expect(sport?.color).toBe('#5FB86B')
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('synchronise vers Supabase seulement si connecté, sans jamais inclure current_xp/level', async () => {
    const { usePillars } = await import('./usePillars')
    const { result } = renderHook(() => usePillars())
    // Attend que le bootstrap du pilier « Général » soit totalement retombé (pas
    // seulement isLoading) avant de brancher l'utilisateur, pour ne pas faire courir son
    // propre push contre celui de ce test (flushQueue() s'auto-ignore si déjà en cours).
    await waitFor(() => expect(result.current.activePillars).toHaveLength(1))

    setCurrentUserId('user-1')
    await act(async () => {
      await result.current.addPillar('Études', '#E8C547')
    })

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1))
    const payload = upsertMock.mock.calls[0][0]
    expect(payload.user_id).toBe('user-1')
    expect(payload.name).toBe('Études')
    expect(payload).not.toHaveProperty('current_xp')
    expect(payload).not.toHaveProperty('level')
  })

  it('refuse un 9e pilier actif (maximum 8)', async () => {
    await seedPillars(8)
    const { usePillars } = await import('./usePillars')
    const { result } = renderHook(() => usePillars())
    await waitFor(() => expect(result.current.activePillars).toHaveLength(8))

    const created = await act(async () => result.current.addPillar('Trop', '#C77DD9'))
    expect(created).toBeNull()
    expect(result.current.activePillars).toHaveLength(8)
  })

  it('renomme et recolore un pilier', async () => {
    await seedPillars(1, { name: 'Avant' })
    const { usePillars } = await import('./usePillars')
    const { result } = renderHook(() => usePillars())
    await waitFor(() => expect(result.current.activePillars).toHaveLength(1))
    const id = result.current.activePillars[0].id

    await act(async () => {
      await result.current.renamePillar(id, 'Après')
      await result.current.recolorPillar(id, '#F2924A')
    })

    expect(result.current.activePillars[0].name).toBe('Après')
    expect(result.current.activePillars[0].color).toBe('#F2924A')
  })

  it('archive puis désarchive un pilier', async () => {
    await seedPillars(1, { name: 'Travail' })
    const { usePillars } = await import('./usePillars')
    const { result } = renderHook(() => usePillars())
    await waitFor(() => expect(result.current.activePillars).toHaveLength(1))
    const id = result.current.activePillars[0].id

    await act(async () => {
      await result.current.archivePillar(id)
    })
    expect(result.current.activePillars).toHaveLength(0)
    expect(result.current.pillars.find((pillar) => pillar.id === id)?.archivedAt).not.toBeNull()

    await act(async () => {
      await result.current.unarchivePillar(id)
    })
    expect(result.current.activePillars).toHaveLength(1)
  })

  it('refuse de désarchiver si 8 piliers actifs existent déjà', async () => {
    await seedPillars(8)
    await seedPillars(1, { id: 'archived-one', archivedAt: Date.now() })
    const { usePillars } = await import('./usePillars')
    const { result } = renderHook(() => usePillars())
    await waitFor(() => expect(result.current.activePillars).toHaveLength(8))

    await act(async () => {
      await result.current.unarchivePillar('archived-one')
    })
    expect(result.current.activePillars).toHaveLength(8)
    expect(result.current.pillars.find((pillar) => pillar.id === 'archived-one')?.archivedAt).not.toBe(
      null,
    )
  })
})
