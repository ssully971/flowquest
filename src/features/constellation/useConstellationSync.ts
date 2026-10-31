import { useEffect, useRef } from 'react'

import { useAuth } from '@/features/auth/useAuth'

import { notifyConstellationChanged } from './constellation-events'
import { IndexedDbConstellationRepository } from './storage/constellation-repository'
import { pullLayout, pullTaskLinks } from './storage/supabase-constellation-sync'

const repo = new IndexedDbConstellationRepository()

/** À la connexion, tire une fois les liens et les positions du serveur (comme useTaskSync pour
 * les tâches). Les positions distantes ne remplacent les locales que si elles sont plus récentes. */
export function useConstellationSync(): void {
  const { status, user } = useAuth()
  const pulledForUserRef = useRef<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !user) return
    if (pulledForUserRef.current === user.id) return
    pulledForUserRef.current = user.id

    void (async () => {
      const [links, layout] = await Promise.all([pullTaskLinks(user.id), pullLayout(user.id)])
      if (links && links.length > 0) await repo.putLinks(links)
      if (layout) {
        const local = await repo.getLayout()
        if (!local || layout.updatedAt > local.updatedAt) await repo.putLayout(layout)
      }
      notifyConstellationChanged()
    })()
  }, [status, user])
}
