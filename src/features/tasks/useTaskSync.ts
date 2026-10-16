import { useEffect, useRef } from 'react'

import { useAuth } from '@/features/auth/useAuth'

import { IndexedDbTaskRepository } from './storage/indexed-db-task-repository'
import { pullAllTasks } from './storage/supabase-task-sync'
import { notifyTasksChanged } from './task-events'

const repo = new IndexedDbTaskRepository()

/**
 * À la connexion, tire une fois la liste distante des tâches et la fusionne dans
 * IndexedDB (remplace par id — jamais de doublon). Permet de retrouver ses tâches sur
 * un nouvel appareil.
 */
export function useTaskSync(): void {
  const { status, user } = useAuth()
  const pulledForUserRef = useRef<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !user) return
    if (pulledForUserRef.current === user.id) return
    pulledForUserRef.current = user.id

    void (async () => {
      const remote = await pullAllTasks(user.id)
      if (!remote || remote.length === 0) return
      await repo.putMany(remote)
      notifyTasksChanged()
    })()
  }, [status, user])
}
