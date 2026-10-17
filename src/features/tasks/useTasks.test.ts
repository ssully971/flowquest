import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setCurrentUserId } from '@/features/auth/current-user'
import { getDb } from '@/shared/storage/db'

const upsertMock = vi.fn()
const deleteEqMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: upsertMock,
      delete: () => ({ eq: deleteEqMock }),
    }),
  },
}))

async function clearTasks() {
  const db = await getDb()
  const keys = await db.getAllKeys('tasks')
  await Promise.all(keys.map((key) => db.delete('tasks', key)))
  const queueKeys = await db.getAllKeys('syncQueue')
  await Promise.all(queueKeys.map((key) => db.delete('syncQueue', key)))
}

describe('useTasks — CRUD local-first, synchro seulement si connecté', () => {
  beforeEach(async () => {
    upsertMock.mockReset()
    deleteEqMock.mockReset()
    upsertMock.mockResolvedValue({ error: null })
    deleteEqMock.mockResolvedValue({ error: null })
    setCurrentUserId(null)
    await clearTasks()
  })

  it('ajoute une tâche et la relit depuis IndexedDB', async () => {
    const { useTasks } = await import('./useTasks')
    const { result } = renderHook(() => useTasks())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      await result.current.addTask('Réviser la pharmacologie')
    })

    await waitFor(() => expect(result.current.tasks).toHaveLength(1))
    expect(result.current.tasks[0].title).toBe('Réviser la pharmacologie')
    expect(result.current.tasks[0].done).toBe(false)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('synchronise vers Supabase seulement si un utilisateur est connecté', async () => {
    const { useTasks } = await import('./useTasks')
    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    setCurrentUserId('user-1')
    await act(async () => {
      await result.current.addTask('Tâche synchronisée')
    })

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1))
    expect(upsertMock.mock.calls[0][0].user_id).toBe('user-1')
  })

  it('coche une tâche (toggleDone) et enregistre la date de complétion', async () => {
    const { useTasks } = await import('./useTasks')
    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.addTask('À cocher')
    })
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))
    const id = result.current.tasks[0].id

    await act(async () => {
      await result.current.toggleDone(id)
    })

    await waitFor(() => expect(result.current.tasks[0].done).toBe(true))
    expect(result.current.tasks[0].doneAt).not.toBeNull()
  })

  it('renomme une tâche', async () => {
    const { useTasks } = await import('./useTasks')
    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.addTask('Ancien titre')
    })
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))
    const id = result.current.tasks[0].id

    await act(async () => {
      await result.current.renameTask(id, 'Nouveau titre')
    })

    await waitFor(() => expect(result.current.tasks[0].title).toBe('Nouveau titre'))
  })

  it('supprime une tâche', async () => {
    const { useTasks } = await import('./useTasks')
    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.addTask('À supprimer')
    })
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))
    const id = result.current.tasks[0].id

    await act(async () => {
      await result.current.removeTask(id)
    })

    await waitFor(() => expect(result.current.tasks).toHaveLength(0))
  })

  it('supprime la tâche côté Supabase quand connecté, jamais en mode invité', async () => {
    const { useTasks } = await import('./useTasks')
    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    setCurrentUserId('user-1')
    await act(async () => {
      await result.current.addTask('À supprimer, connecté')
    })
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))
    const id = result.current.tasks[0].id
    upsertMock.mockClear()

    await act(async () => {
      await result.current.removeTask(id)
    })

    await waitFor(() => expect(deleteEqMock).toHaveBeenCalledWith('id', id))
  })

  it('réordonne les tâches selon la liste d’ids fournie', async () => {
    const { useTasks } = await import('./useTasks')
    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.addTask('Première')
      await result.current.addTask('Deuxième')
      await result.current.addTask('Troisième')
    })
    await waitFor(() => expect(result.current.tasks).toHaveLength(3))

    const [first, second, third] = result.current.tasks
    await act(async () => {
      await result.current.reorderTasks([third.id, first.id, second.id])
    })

    await waitFor(() => {
      expect(result.current.tasks.map((t) => t.title)).toEqual([
        'Troisième',
        'Première',
        'Deuxième',
      ])
    })
  })

  it('ajoute une sous-tâche liée à son parent (lot 6, §8)', async () => {
    const { useTasks } = await import('./useTasks')
    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.addTask('Parent')
    })
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))
    const parentId = result.current.tasks[0].id

    await act(async () => {
      await result.current.addTask('Sous-tâche', parentId)
    })

    await waitFor(() => expect(result.current.tasks).toHaveLength(2))
    const subtask = result.current.tasks.find((t) => t.title === 'Sous-tâche')
    expect(subtask?.parentId).toBe(parentId)
  })

  it('supprimer une tâche parente supprime aussi ses sous-tâches', async () => {
    const { useTasks } = await import('./useTasks')
    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.addTask('Parent')
    })
    const parentId = result.current.tasks[0].id
    await act(async () => {
      await result.current.addTask('Sous-tâche 1', parentId)
      await result.current.addTask('Sous-tâche 2', parentId)
    })
    await waitFor(() => expect(result.current.tasks).toHaveLength(3))

    await act(async () => {
      await result.current.removeTask(parentId)
    })

    await waitFor(() => expect(result.current.tasks).toHaveLength(0))
  })
})
