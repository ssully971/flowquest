import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { getDb } from '@/shared/storage/db'
import type { FocusSessionRecord } from '@/shared/storage/db'

import { useGalaxySessions } from './useGalaxySessions'

async function clearFocusSessions() {
  const db = await getDb()
  const keys = await db.getAllKeys('focusSessions')
  await Promise.all(keys.map((key) => db.delete('focusSessions', key)))
}

function session(
  overrides: Partial<FocusSessionRecord> & { id: string; startedAt: number },
): FocusSessionRecord {
  return {
    kind: 'focus',
    plannedSeconds: 1500,
    actualSeconds: 1500,
    endedAt: overrides.startedAt + 1500_000,
    completed: true,
    taskId: null,
    pillarId: null,
    syncedAt: null,
    ...overrides,
  }
}

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()

describe('useGalaxySessions — chargement paresseux et filtré (LOT G4)', () => {
  beforeEach(async () => {
    await clearFocusSessions()
  })

  it('ne charge rien tant que enabled est faux', async () => {
    const db = await getDb()
    await db.put('focusSessions', session({ id: 's1', startedAt: NOW }))

    const { result } = renderHook(() => useGalaxySessions({ enabled: false, periodStartMs: null }))
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(result.current.sessions).toHaveLength(0)
    expect(result.current.isLoading).toBe(false)
  })

  it('ne retient que les sessions de focus complétées', async () => {
    const db = await getDb()
    await db.put('focusSessions', session({ id: 'focus-done', startedAt: NOW, completed: true }))
    await db.put(
      'focusSessions',
      session({ id: 'focus-abandoned', startedAt: NOW - DAY, completed: false }),
    )
    await db.put(
      'focusSessions',
      session({ id: 'break', startedAt: NOW - 2 * DAY, kind: 'short_break', completed: true }),
    )

    const { result } = renderHook(() => useGalaxySessions({ enabled: true, periodStartMs: null }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.sessions.map((s) => s.id)).toEqual(['focus-done'])
  })

  it('trie du plus récent au plus ancien', async () => {
    const db = await getDb()
    await db.put('focusSessions', session({ id: 'older', startedAt: NOW - DAY }))
    await db.put('focusSessions', session({ id: 'newer', startedAt: NOW }))

    const { result } = renderHook(() => useGalaxySessions({ enabled: true, periodStartMs: null }))
    await waitFor(() => expect(result.current.sessions).toHaveLength(2))

    expect(result.current.sessions.map((s) => s.id)).toEqual(['newer', 'older'])
  })

  it('respecte la borne de période (periodStartMs)', async () => {
    const db = await getDb()
    await db.put('focusSessions', session({ id: 'recent', startedAt: NOW }))
    await db.put('focusSessions', session({ id: 'ancient', startedAt: NOW - 200 * DAY }))

    const { result } = renderHook(() =>
      useGalaxySessions({ enabled: true, periodStartMs: NOW - 30 * DAY }),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.sessions.map((s) => s.id)).toEqual(['recent'])
  })

  it('isLoading passe à vrai dès que enabled devient vrai, puis à faux une fois chargé', async () => {
    const db = await getDb()
    await db.put('focusSessions', session({ id: 's1', startedAt: NOW }))

    const { result, rerender } = renderHook(
      ({ enabled }) => useGalaxySessions({ enabled, periodStartMs: null }),
      { initialProps: { enabled: false } },
    )
    expect(result.current.isLoading).toBe(false)

    rerender({ enabled: true })
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.sessions).toHaveLength(1)
  })

  it('periodStartMs à null ne borne pas (tout l’historique)', async () => {
    const db = await getDb()
    await db.put('focusSessions', session({ id: 'recent', startedAt: NOW }))
    await db.put('focusSessions', session({ id: 'ancient', startedAt: NOW - 400 * DAY }))

    const { result } = renderHook(() => useGalaxySessions({ enabled: true, periodStartMs: null }))
    await waitFor(() => expect(result.current.sessions).toHaveLength(2))
  })
})
