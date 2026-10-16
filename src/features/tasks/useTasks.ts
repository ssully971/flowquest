import { useCallback, useEffect, useRef, useState } from 'react'

import { getCurrentUserId } from '@/features/auth/current-user'
import type { TaskRecord } from '@/shared/storage/db'

import { IndexedDbTaskRepository } from './storage/indexed-db-task-repository'
import { deleteTaskRemote, pushTask } from './storage/supabase-task-sync'
import { notifyTasksChanged, onTasksChanged } from './task-events'

const repo = new IndexedDbTaskRepository()

export interface UseTasksResult {
  tasks: TaskRecord[]
  isLoading: boolean
  addTask: (title: string) => Promise<void>
  toggleDone: (id: string) => Promise<void>
  renameTask: (id: string, title: string) => Promise<void>
  removeTask: (id: string) => Promise<void>
  reorderTasks: (orderedIds: string[]) => Promise<void>
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

  const addTask = useCallback(async (title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const current = await repo.listAll()
    const task: TaskRecord = {
      id: crypto.randomUUID(),
      title: trimmed,
      position: current.length,
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
    if (!task) return
    const updated: TaskRecord = {
      ...task,
      done: !task.done,
      doneAt: !task.done ? Date.now() : null,
      updatedAt: Date.now(),
    }
    await repo.put(updated)
    pushIfAuthenticated(updated)
    notifyTasksChanged()
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

  const removeTask = useCallback(async (id: string) => {
    await repo.remove(id)
    const userId = getCurrentUserId()
    if (userId) void deleteTaskRemote(id)
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

  return { tasks, isLoading, addTask, toggleDone, renameTask, removeTask, reorderTasks }
}
