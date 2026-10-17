import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { notifyTasksChanged } from '@/features/tasks/task-events'
import { getDb } from '@/shared/storage/db'

import { usePeriodStats } from './usePeriodStats'

async function clearAll() {
  const db = await getDb()
  for (const key of await db.getAllKeys('focusSessions')) await db.delete('focusSessions', key)
  for (const key of await db.getAllKeys('tasks')) await db.delete('tasks', key)
}

describe('usePeriodStats — cartes de la période choisie (lot 5)', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('cumule les sessions et tâches existantes dès le premier rendu', async () => {
    const db = await getDb()
    const now = Date.now()
    await db.put('focusSessions', {
      id: 's1',
      kind: 'focus',
      plannedSeconds: 1500,
      actualSeconds: 1500,
      startedAt: now - 1000,
      endedAt: now,
      completed: true,
      taskId: null,
      syncedAt: null,
    })
    await db.put('tasks', {
      id: 't1',
      title: 'Tâche',
      position: 0,
      done: true,
      doneAt: now - 500,
      createdAt: now - 1000,
      updatedAt: now,
    })

    const { result } = renderHook(() => usePeriodStats('today'))

    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.current.focusSeconds).toBe(1500)
    expect(result.current?.current.tasksCompleted).toBe(1)
  })

  it('se met à jour quand une tâche est modifiée (onTasksChanged)', async () => {
    const { result } = renderHook(() => usePeriodStats('today'))
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.current.tasksCompleted).toBe(0)

    const db = await getDb()
    const now = Date.now()
    await db.put('tasks', {
      id: 't2',
      title: 'Nouvelle tâche',
      position: 0,
      done: true,
      doneAt: now,
      createdAt: now,
      updatedAt: now,
    })
    act(() => notifyTasksChanged())

    await waitFor(() => expect(result.current?.current.tasksCompleted).toBe(1))
  })
})
