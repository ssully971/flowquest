import { useEffect, useRef } from 'react'

import { useAuth } from '@/features/auth/useAuth'

import { notifyPillarsChanged } from './pillar-events'
import { IndexedDbPillarRepository } from './storage/indexed-db-pillar-repository'
import { pullAllPillars } from './storage/supabase-pillar-sync'

const repo = new IndexedDbPillarRepository()

/** À la connexion, tire une fois la liste distante des piliers (XP/niveau compris,
 * toujours justes car recomposés côté serveur) et la fusionne dans IndexedDB — même
 * principe que useTaskSync.ts. */
export function usePillarSync(): void {
  const { status, user } = useAuth()
  const pulledForUserRef = useRef<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !user) return
    if (pulledForUserRef.current === user.id) return
    pulledForUserRef.current = user.id

    void (async () => {
      const remote = await pullAllPillars(user.id)
      if (!remote || remote.length === 0) return
      await repo.putMany(remote)
      notifyPillarsChanged()
    })()
  }, [status, user])
}
