import { useCallback, useEffect, useRef, useState } from 'react'

import { getCurrentUserId } from '@/features/auth/current-user'
import type { TaskLinkRecord } from '@/shared/storage/db'

import { notifyConstellationChanged, onConstellationChanged } from './constellation-events'
import { validateNewLink, canonicalLink } from './link-rules'
import type { LinkRejection, TaskLinkKind } from './link-rules'
import { IndexedDbConstellationRepository } from './storage/constellation-repository'
import { deleteTaskLinkRemote, pushTaskLink } from './storage/supabase-constellation-sync'

const repo = new IndexedDbConstellationRepository()

export interface UseTaskLinksResult {
  links: TaskLinkRecord[]
  /** `null` si créé, sinon la raison du refus (lien sur soi-même, doublon, boucle). */
  addLink: (
    fromTaskId: string,
    toTaskId: string,
    kind: TaskLinkKind,
  ) => Promise<LinkRejection | null>
  /** Rétablit un lien supprimé à l'identique (annulation). */
  restoreLink: (link: TaskLinkRecord) => Promise<void>
  removeLink: (id: string) => Promise<void>
}

export function useTaskLinks(): UseTaskLinksResult {
  const [links, setLinks] = useState<TaskLinkRecord[]>([])
  const unmountedRef = useRef(false)

  const refresh = useCallback(() => {
    void repo.listLinks().then((loaded) => {
      if (!unmountedRef.current) setLinks(loaded)
    })
  }, [])

  useEffect(() => {
    unmountedRef.current = false
    refresh()
    const unsubscribe = onConstellationChanged(refresh)
    return () => {
      unmountedRef.current = true
      unsubscribe()
    }
  }, [refresh])

  const addLink = useCallback(async (fromTaskId: string, toTaskId: string, kind: TaskLinkKind) => {
    // Relit le stockage plutôt que l'état React : deux ajouts rapprochés ne se masquent pas.
    const current = await repo.listLinks()
    const rejection = validateNewLink(current, fromTaskId, toTaskId, kind)
    if (rejection) return rejection
    const link: TaskLinkRecord = {
      id: crypto.randomUUID(),
      ...canonicalLink(fromTaskId, toTaskId, kind),
      createdAt: Date.now(),
    }
    await repo.putLink(link)
    const userId = getCurrentUserId()
    if (userId) void pushTaskLink(userId, link)
    notifyConstellationChanged()
    return null
  }, [])

  const restoreLink = useCallback(async (link: TaskLinkRecord) => {
    await repo.putLink(link)
    const userId = getCurrentUserId()
    if (userId) void pushTaskLink(userId, link)
    notifyConstellationChanged()
  }, [])

  const removeLink = useCallback(async (id: string) => {
    await repo.removeLink(id)
    if (getCurrentUserId()) void deleteTaskLinkRemote(id)
    notifyConstellationChanged()
  }, [])

  return { links, addLink, restoreLink, removeLink }
}
