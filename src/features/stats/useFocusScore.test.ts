import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { getDb } from '@/shared/storage/db'

import { useFocusScore } from './useFocusScore'

async function clearFocusSessions() {
  const db = await getDb()
  for (const key of await db.getAllKeys('focusSessions')) await db.delete('focusSessions', key)
}

describe('useFocusScore — carte « score de focus » (lot 5)', () => {
  beforeEach(async () => {
    await clearFocusSessions()
  })

  it('calcule le score à partir des sessions enregistrées', async () => {
    const db = await getDb()
    const now = Date.now()
    await db.put('focusSessions', {
      id: 'score-1',
      kind: 'focus',
      plannedSeconds: 1500,
      actualSeconds: 1500,
      startedAt: now - 1000,
      endedAt: now,
      completed: true,
      taskId: null,
      pillarId: null,
      syncedAt: null,
    })

    const { result } = renderHook(() => useFocusScore('today'))

    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.current.completionRate).toBe(100)
  })

  it('renvoie un score à 0 sans aucune session', async () => {
    const { result } = renderHook(() => useFocusScore('week'))
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.current).toEqual({ score: 0, completionRate: 0, regularityRate: 0 })
  })
})
