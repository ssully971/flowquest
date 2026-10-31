import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getCurrentUserId } from '@/features/auth/current-user'
import type { TaskRecord } from '@/shared/storage/db'

import { notifyConstellationChanged } from '@/features/constellation/constellation-events'
import { IndexedDbConstellationRepository } from '@/features/constellation/storage/constellation-repository'
import { IndexedDbTaskRepository } from './storage/indexed-db-task-repository'
import { deleteTaskRemote, pushTask } from './storage/supabase-task-sync'
import { notifyTasksChanged, onTasksChanged } from './task-events'

const repo = new IndexedDbTaskRepository()
const constellationRepo = new IndexedDbConstellationRepository()

export interface TaskDetailsUpdate {
  emoji?: string | null
  color?: string | null
  etaMinutes?: number | null
  pillarId?: string | null
}

export interface UseTasksResult {
  /** Tâches actives (non archivées). */
  tasks: TaskRecord[]
  /** Tâches archivées, de la plus récemment archivée à la plus ancienne. */
  archivedTasks: TaskRecord[]
  isLoading: boolean
  addTask: (title: string, parentId?: string | null, pillarId?: string | null) => Promise<void>
  /** Renvoie true si cette tâche était la dernière non terminée (confettis, §8). */
  toggleDone: (id: string) => Promise<boolean>
  renameTask: (id: string, title: string) => Promise<void>
  removeTask: (id: string) => Promise<void>
  /** Annulation d'une suppression (LOT H1, §5, réglage « confirmer avant de supprimer »
   * désactivé) : remet exactement les mêmes enregistrements (même id, sous-tâches
   * comprises), plutôt que de recréer des tâches avec de nouveaux id via addTask. */
  restoreTasks: (records: TaskRecord[]) => Promise<void>
  reorderTasks: (orderedIds: string[]) => Promise<void>
  /** Archive une tâche et ses sous-tâches (même horodatage) : masquées, restaurables. */
  archiveTask: (id: string) => Promise<void>
  /** Archive toutes les tâches terminées (et leurs sous-tâches). Renvoie le nombre archivé. */
  archiveCompleted: () => Promise<number>
  /** Restaure une tâche archivée avec les sous-tâches archivées en même temps qu'elle. */
  unarchiveTask: (id: string) => Promise<void>
  updateTaskDetails: (id: string, update: TaskDetailsUpdate) => Promise<void>
}

function pushIfAuthenticated(task: TaskRecord): void {
  const userId = getCurrentUserId()
  if (userId) void pushTask(userId, task)
}

export function useTasks(): UseTasksResult {
  const [allTasks, setAllTasks] = useState<TaskRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const unmountedRef = useRef(false)

  const refresh = useCallback(() => {
    void repo.listAll().then((loaded) => {
      if (!unmountedRef.current) {
        setAllTasks(loaded)
        setIsLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    unmountedRef.current = false
    refresh()
    const unsubscribe = onTasksChanged(refresh)
    return () => {
      unmountedRef.current = true
      unsubscribe()
    }
  }, [refresh])

  const tasks = useMemo(() => allTasks.filter((task) => !task.archivedAt), [allTasks])
  const archivedTasks = useMemo(
    () =>
      allTasks
        .filter((task) => task.archivedAt)
        .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
    [allTasks],
  )

  const addTask = useCallback(async (title: string, parentId: string | null = null, pillarId: string | null = null) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const current = await repo.listAll()
    const siblingCount = current.filter((t) => t.parentId === parentId).length
    const task: TaskRecord = {
      id: crypto.randomUUID(),
      title: trimmed,
      emoji: null,
      color: null,
      etaMinutes: null,
      parentId,
      pillarId,
      position: siblingCount,
      done: false,
      doneAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await repo.put(task)
    pushIfAuthenticated(task)
    notifyTasksChanged()
  }, [])

  const toggleDone = useCallback(async (id: string) => {
    const current = await repo.listAll()
    const task = current.find((t) => t.id === id)
    if (!task) return false
    const willBeDone = !task.done
    const updated: TaskRecord = {
      ...task,
      done: willBeDone,
      doneAt: willBeDone ? Date.now() : null,
      updatedAt: Date.now(),
    }
    await repo.put(updated)
    pushIfAuthenticated(updated)
    notifyTasksChanged()
    const isLastRemaining =
      willBeDone && current.filter((t) => t.id !== id && !t.archivedAt).every((t) => t.done)
    return isLastRemaining
  }, [])

  const renameTask = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const current = await repo.listAll()
    const task = current.find((t) => t.id === id)
    if (!task) return
    const updated: TaskRecord = { ...task, title: trimmed, updatedAt: Date.now() }
    await repo.put(updated)
    pushIfAuthenticated(updated)
    notifyTasksChanged()
  }, [])

  const updateTaskDetails = useCallback(async (id: string, update: TaskDetailsUpdate) => {
    const current = await repo.listAll()
    const task = current.find((t) => t.id === id)
    if (!task) return
    const updated: TaskRecord = { ...task, ...update, updatedAt: Date.now() }
    await repo.put(updated)
    pushIfAuthenticated(updated)
    notifyTasksChanged()
  }, [])

  const removeTask = useCallback(async (id: string) => {
    const current = await repo.listAll()
    // Les sous-tâches n'ont qu'un seul niveau (pas de petits-enfants) : supprimer un
    // parent supprime ses enfants directs, en local comme côté Supabase (parent_id ON
    // DELETE CASCADE côté serveur, mais IndexedDB ne connaît pas les contraintes SQL).
    const idsToRemove = [id, ...current.filter((t) => t.parentId === id).map((t) => t.id)]
    await Promise.all(idsToRemove.map((taskId) => repo.remove(taskId)))
    // Les liens de la constellation suivent leurs tâches (cascade SQL côté serveur).
    await constellationRepo.removeLinksOfTasks(idsToRemove)
    notifyConstellationChanged()
    const userId = getCurrentUserId()
    if (userId) idsToRemove.forEach((taskId) => void deleteTaskRemote(taskId))
    notifyTasksChanged()
  }, [])

  const restoreTasks = useCallback(async (records: TaskRecord[]) => {
    if (records.length === 0) return
    await repo.putMany(records)
    records.forEach(pushIfAuthenticated)
    notifyTasksChanged()
  }, [])

  const reorderTasks = useCallback(async (orderedIds: string[]) => {
    const current = await repo.listAll()
    const byId = new Map(current.map((task) => [task.id, task]))
    const updated: TaskRecord[] = []
    orderedIds.forEach((id, index) => {
      const task = byId.get(id)
      if (!task) return
      updated.push({ ...task, position: index, updatedAt: Date.now() })
    })
    await repo.putMany(updated)
    updated.forEach(pushIfAuthenticated)
    notifyTasksChanged()
  }, [])

  const archiveIds = useCallback(async (rootIds: string[]) => {
    const current = await repo.listAll()
    const roots = new Set(rootIds)
    const stamp = Date.now()
    const updated = current
      .filter((t) => !t.archivedAt && (roots.has(t.id) || (t.parentId && roots.has(t.parentId))))
      .map((t) => ({ ...t, archivedAt: stamp, updatedAt: stamp }))
    if (updated.length === 0) return 0
    await repo.putMany(updated)
    updated.forEach(pushIfAuthenticated)
    notifyTasksChanged()
    return updated.length
  }, [])

  const archiveTask = useCallback(
    async (id: string) => {
      await archiveIds([id])
    },
    [archiveIds],
  )

  const archiveCompleted = useCallback(async () => {
    const current = await repo.listAll()
    const doneRoots = current.filter((t) => t.done && !t.archivedAt && !t.parentId).map((t) => t.id)
    // Une sous-tâche terminée sous un parent non terminé reste visible : on n'archive que
    // les parents terminés (avec leurs enfants) et les sous-tâches terminées isolées.
    const parents = new Set(current.filter((t) => !t.parentId).map((t) => t.id))
    const orphanDone = current
      .filter((t) => t.done && !t.archivedAt && t.parentId && !parents.has(t.parentId))
      .map((t) => t.id)
    return archiveIds([...doneRoots, ...orphanDone])
  }, [archiveIds])

  const unarchiveTask = useCallback(async (id: string) => {
    const current = await repo.listAll()
    const root = current.find((t) => t.id === id)
    if (!root?.archivedAt) return
    const stamp = root.archivedAt
    const now = Date.now()
    const updated = current
      .filter((t) => t.id === id || (t.parentId === id && t.archivedAt === stamp))
      .map((t) => ({ ...t, archivedAt: null, updatedAt: now }))
    await repo.putMany(updated)
    updated.forEach(pushIfAuthenticated)
    notifyTasksChanged()
  }, [])

  return {
    tasks,
    archivedTasks,
    archiveTask,
    archiveCompleted,
    unarchiveTask,
    isLoading,
    addTask,
    toggleDone,
    renameTask,
    removeTask,
    restoreTasks,
    reorderTasks,
    updateTaskDetails,
  }
}
