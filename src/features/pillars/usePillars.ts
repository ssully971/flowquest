import { useCallback, useEffect, useRef, useState } from 'react'

import { getCurrentUserId } from '@/features/auth/current-user'
import type { PillarRecord } from '@/shared/storage/db'
import { strings } from '@/shared/i18n'

import { PILLAR_COLORS } from './pillar-colors'
import { notifyPillarsChanged, onPillarsChanged } from './pillar-events'
import { IndexedDbPillarRepository } from './storage/indexed-db-pillar-repository'
import { pushPillar } from './storage/supabase-pillar-sync'

const repo = new IndexedDbPillarRepository()

/** Limite en base (voir pillars_enforce_max_active dans la migration) — vérifiée ici
 * aussi pour une UX immédiate, sans aller-retour serveur. */
export const MAX_ACTIVE_PILLARS = 8

/**
 * Dédoublonnage du pilier « Général » (lot 4, §2) : plusieurs composants montés en même
 * temps (PillarsPage et GalaxyView, désormais sur la même page) appellent chacun
 * `usePillars()`, donc chacun son propre effet de bootstrap — sans ce verrou partagé au
 * niveau du module, les deux liraient `repo.listAll()` vide avant que l'un des deux n'ait
 * fini d'insérer, et créeraient chacun leur « Général » en double. La promesse n'est
 * mémorisée que pendant qu'elle est en vol (remise à `null` une fois résolue) : elle ne
 * déduplique que les appels concurrents d'un même montage, jamais les montages suivants
 * (ex. après un changement de compte, où la base a pu être vidée entre-temps).
 */
let bootstrapPromise: Promise<void> | null = null

function ensureDefaultPillar(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise
  bootstrapPromise = (async () => {
    try {
      const current = await repo.listAll()
      if (current.length > 0) return
      const pillar: PillarRecord = {
        id: crypto.randomUUID(),
        name: strings.pillars.defaultName,
        color: PILLAR_COLORS[0],
        currentXp: 0,
        level: 1,
        createdAt: Date.now(),
        archivedAt: null,
        goalLevel: null,
        goalDeadline: null,
      }
      await repo.put(pillar)
      pushIfAuthenticated(pillar)
      notifyPillarsChanged()
    } finally {
      bootstrapPromise = null
    }
  })()
  return bootstrapPromise
}

export interface UsePillarsResult {
  /** Tous les piliers, actifs et archivés. */
  pillars: PillarRecord[]
  activePillars: PillarRecord[]
  isLoading: boolean
  addPillar: (name: string, color: string) => Promise<PillarRecord | null>
  renamePillar: (id: string, name: string) => Promise<void>
  recolorPillar: (id: string, color: string) => Promise<void>
  archivePillar: (id: string) => Promise<void>
  unarchivePillar: (id: string) => Promise<void>
  setGoal: (id: string, goalLevel: number, goalDeadline: number | null) => Promise<void>
  clearGoal: (id: string) => Promise<void>
}

function pushIfAuthenticated(pillar: PillarRecord): void {
  const userId = getCurrentUserId()
  if (userId) void pushPillar(userId, pillar)
}

export function usePillars(): UsePillarsResult {
  const [pillars, setPillars] = useState<PillarRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const unmountedRef = useRef(false)
  const bootstrapAttemptedRef = useRef(false)

  const refresh = useCallback(() => {
    void repo.listAll().then((loaded) => {
      if (!unmountedRef.current) {
        setPillars(loaded)
        setIsLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    unmountedRef.current = false
    refresh()
    const unsubscribe = onPillarsChanged(refresh)
    return () => {
      unmountedRef.current = true
      unsubscribe()
    }
  }, [refresh])

  // Pilier « Général » créé à la toute première utilisation seulement (jamais recréé
  // après coup) : on ne regarde jamais `pillars` (filtré par le rendu courant) mais une
  // relecture fraîche de TOUT l'historique local, piliers archivés compris, pour qu'un
  // utilisateur qui aurait archivé son seul pilier n'en voie pas resurgir un nouveau.
  // ensureDefaultPillar() ci-dessus déduplique les appels concurrents de plusieurs
  // instances de ce hook montées en même temps.
  useEffect(() => {
    if (isLoading || bootstrapAttemptedRef.current) return
    bootstrapAttemptedRef.current = true
    void ensureDefaultPillar()
  }, [isLoading])

  const addPillar = useCallback(async (name: string, color: string) => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const current = await repo.listAll()
    const activeCount = current.filter((pillar) => pillar.archivedAt === null).length
    if (activeCount >= MAX_ACTIVE_PILLARS) return null

    const pillar: PillarRecord = {
      id: crypto.randomUUID(),
      name: trimmed,
      color,
      currentXp: 0,
      level: 1,
      createdAt: Date.now(),
      archivedAt: null,
      goalLevel: null,
      goalDeadline: null,
    }
    await repo.put(pillar)
    pushIfAuthenticated(pillar)
    notifyPillarsChanged()
    return pillar
  }, [])

  const renamePillar = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const current = await repo.listAll()
    const pillar = current.find((item) => item.id === id)
    if (!pillar) return
    const updated: PillarRecord = { ...pillar, name: trimmed }
    await repo.put(updated)
    pushIfAuthenticated(updated)
    notifyPillarsChanged()
  }, [])

  const recolorPillar = useCallback(async (id: string, color: string) => {
    const current = await repo.listAll()
    const pillar = current.find((item) => item.id === id)
    if (!pillar) return
    const updated: PillarRecord = { ...pillar, color }
    await repo.put(updated)
    pushIfAuthenticated(updated)
    notifyPillarsChanged()
  }, [])

  const setArchived = useCallback(async (id: string, archived: boolean) => {
    const current = await repo.listAll()
    const pillar = current.find((item) => item.id === id)
    if (!pillar) return
    if (!archived) {
      const activeCount = current.filter(
        (item) => item.archivedAt === null && item.id !== id,
      ).length
      if (activeCount >= MAX_ACTIVE_PILLARS) return
    }
    const updated: PillarRecord = { ...pillar, archivedAt: archived ? Date.now() : null }
    await repo.put(updated)
    pushIfAuthenticated(updated)
    notifyPillarsChanged()
  }, [])

  const archivePillar = useCallback((id: string) => setArchived(id, true), [setArchived])
  const unarchivePillar = useCallback((id: string) => setArchived(id, false), [setArchived])

  // Objectif de niveau (lot 4, §4) : niveau visé et date limite optionnelle. `setGoal`
  // remplace l'objectif précédent le cas échéant (un seul objectif actif par pilier,
  // jamais un historique).
  const setGoal = useCallback(async (id: string, goalLevel: number, goalDeadline: number | null) => {
    if (!Number.isFinite(goalLevel) || goalLevel < 1) return
    const current = await repo.listAll()
    const pillar = current.find((item) => item.id === id)
    if (!pillar) return
    const updated: PillarRecord = { ...pillar, goalLevel: Math.floor(goalLevel), goalDeadline }
    await repo.put(updated)
    pushIfAuthenticated(updated)
    notifyPillarsChanged()
  }, [])

  const clearGoal = useCallback(async (id: string) => {
    const current = await repo.listAll()
    const pillar = current.find((item) => item.id === id)
    if (!pillar) return
    const updated: PillarRecord = { ...pillar, goalLevel: null, goalDeadline: null }
    await repo.put(updated)
    pushIfAuthenticated(updated)
    notifyPillarsChanged()
  }, [])

  return {
    pillars,
    activePillars: pillars.filter((pillar) => pillar.archivedAt === null),
    isLoading,
    addPillar,
    renamePillar,
    recolorPillar,
    archivePillar,
    unarchivePillar,
    setGoal,
    clearGoal,
  }
}
