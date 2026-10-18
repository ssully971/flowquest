import { useCallback, useEffect, useRef, useState } from 'react'

import { getCurrentUserId } from '@/features/auth/current-user'
import type { TaskRecord } from '@/shared/storage/db'

import { IndexedDbTaskRepository } from './storage/indexed-db-task-repository'
import { deleteTaskRemote, pushTask } from './storage/supabase-task-sync'
import { notifyTasksChanged, onTasksChanged } from './task-events'

const repo = new IndexedDbTaskRepository()

export interface TaskDetailsUpdate {
  emoji?: string | null
  color?: string | null
  etaMinutes?: number | null
}

export interface UseTasksResult {
  tasks: TaskRecord[]
  isLoading: boolean
  addTask: (title: string, parentId?: string | null) => Promise<void>
  /** Renvoie true si cette tâche était la dernière non terminée (confettis, §8). */
  toggleDone: (id: string) => Promise<boolean>
  renameTask: (id: string, title: string) => Promise<void>
  removeTask: (id: string) => Promise<void>
  reorderTasks: (orderedIds: string[]) => Promise<void>
  updateTaskDetails: (id: string, update: TaskDetailsUpdate) => Promise<void>
}

function pushIfAuthenticated(task: TaskRecord): void {
  const userId = getCurrentUserId()
  if (userId) void pushTask(userId, task)
}

export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const unmountedRef = useRef(false)

  const refresh = useCallback(() => {
    void repo.listAll().then((loaded) => {
      if (!unmountedRef.current) {
        setTasks(loaded)
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

  const addTask = useCallback(async (title: string, parentId: string | null = null) => {
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
    const isLastRemaining = willBeDone && current.filter((t) => t.id !== id).every((t) => t.done)
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
    const userId = getCurrentUserId()
    if (userId) idsToRemove.forEach((taskId) => void deleteTaskRemote(taskId))
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

  return {
    tasks,
    isLoading,
    addTask,
    toggleDone,
    renameTask,
    removeTask,
    reorderTasks,
    updateTaskDetails,
  }
}
