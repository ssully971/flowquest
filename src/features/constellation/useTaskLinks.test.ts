import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setCurrentUserId } from '@/features/auth/current-user'
import { getDb } from '@/shared/storage/db'

const upsertMock = vi.fn()
const deleteEqMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { from: () => ({ upsert: upsertMock, delete: () => ({ eq: deleteEqMock }) }) },
}))

async function clear() {
  const db = await getDb()
  for (const store of ['taskLinks', 'syncQueue', 'tasks'] as const) {
    const keys = await db.getAllKeys(store)
    await Promise.all(keys.map((key) => db.delete(store, key)))
  }
}

describe('useTaskLinks', () => {
  beforeEach(async () => {
    upsertMock.mockReset().mockResolvedValue({ error: null })
    deleteEqMock.mockReset().mockResolvedValue({ error: null })
    setCurrentUserId(null)
    await clear()
  })

  it('crée un lien, refuse le doublon et le supprime', async () => {
    const { useTaskLinks } = await import('./useTaskLinks')
    const { result } = renderHook(() => useTaskLinks())

    let rejection: string | null = 'x'
    await act(async () => {
      rejection = await result.current.addLink('b', 'a', 'related')
    })
    expect(rejection).toBeNull()
    await waitFor(() => expect(result.current.links).toHaveLength(1))
    expect(result.current.links[0]).toMatchObject({
      fromTaskId: 'a',
      toTaskId: 'b',
      kind: 'related',
    })
    expect(upsertMock).not.toHaveBeenCalled() // invité : rien à synchroniser

    await act(async () => {
      rejection = await result.current.addLink('a', 'b', 'related')
    })
    expect(rejection).toBe('duplicate')

    await act(async () => {
      await result.current.removeLink(result.current.links[0].id)
    })
    await waitFor(() => expect(result.current.links).toHaveLength(0))
  })

  it('synchronise création et suppression seulement si connecté', async () => {
    const { useTaskLinks } = await import('./useTaskLinks')
    const { result } = renderHook(() => useTaskLinks())
    setCurrentUserId('user-1')

    await act(async () => {
      await result.current.addLink('a', 'b', 'depends_on')
    })
    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1))
    expect(upsertMock.mock.calls[0][0]).toMatchObject({
      user_id: 'user-1',
      from_task_id: 'a',
      to_task_id: 'b',
      kind: 'depends_on',
    })

    await act(async () => {
      await result.current.removeLink(result.current.links[0]?.id ?? '')
    })
    await waitFor(() => expect(deleteEqMock).toHaveBeenCalled())
  })

  it('supprimer une tâche supprime ses liens locaux', async () => {
    const { useTaskLinks } = await import('./useTaskLinks')
    const { useTasks } = await import('@/features/tasks/useTasks')
    const links = renderHook(() => useTaskLinks())
    const tasks = renderHook(() => useTasks())
    await waitFor(() => expect(tasks.result.current.isLoading).toBe(false))

    await act(async () => {
      await tasks.result.current.addTask('A')
      await tasks.result.current.addTask('B')
    })
    await waitFor(() => expect(tasks.result.current.tasks).toHaveLength(2))
    const [a, b] = tasks.result.current.tasks
    await act(async () => {
      await links.result.current.addLink(a.id, b.id, 'related')
    })
    await waitFor(() => expect(links.result.current.links).toHaveLength(1))

    await act(async () => {
      await tasks.result.current.removeTask(a.id)
    })
    await waitFor(() => expect(links.result.current.links).toHaveLength(0))
  })
})
