import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getCurrentUserId } from '@/features/auth/current-user'

import type { Graph } from './build-graph'
import { onConstellationChanged } from './constellation-events'
import { settleLayout } from './force-layout'
import type { Positions } from './force-layout'
import { IndexedDbConstellationRepository } from './storage/constellation-repository'
import { pushLayout } from './storage/supabase-constellation-sync'

const repo = new IndexedDbConstellationRepository()
const SAVE_DELAY_MS = 800

export interface UseConstellationLayoutResult {
  /** `null` tant que les positions enregistrées ne sont pas chargées. */
  positions: Positions | null
  /** Nouvelles positions (après stabilisation ou déplacement manuel) : fusionnées, enregistrées. */
  onPositionsChange: (positions: Positions) => void
}

/**
 * Positions des nœuds : celles enregistrées (IndexedDB, synchronisées si connecté), complétées
 * par un calcul déterministe pour les nœuds nouveaux. Les positions des nœuds masqués par un
 * filtre sont conservées, jamais perdues. L'enregistrement est différé (un déplacement émet
 * beaucoup d'événements, une seule écriture part).
 */
export function useConstellationLayout(graph: Graph): UseConstellationLayoutResult {
  const [saved, setSaved] = useState<Positions | null>(null)
  const savedRef = useRef<Positions | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      void repo.getLayout().then((layout) => {
        if (cancelled) return
        savedRef.current = layout?.positions ?? {}
        setSaved(savedRef.current)
      })
    load()
    // Un tirage distant (connexion) peut apporter des positions plus récentes.
    const unsubscribe = onConstellationChanged(() => {
      if (savedRef.current === null) load()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const persist = useCallback((positions: Positions) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      const layout = { positions, updatedAt: Date.now() }
      void repo.putLayout(layout)
      const userId = getCurrentUserId()
      if (userId) void pushLayout(userId, layout)
    }, SAVE_DELAY_MS)
  }, [])

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const positions = useMemo(() => (saved ? settleLayout(graph, saved) : null), [graph, saved])

  // Les nœuds nouveaux reçoivent leur position calculée, enregistrée telle quelle.
  useEffect(() => {
    if (!saved || !positions) return
    const missing = graph.nodes.some((node) => !saved[node.id])
    if (!missing) return
    const merged = { ...saved, ...positions }
    savedRef.current = merged
    persist(merged)
    // Pas de setSaved ici : l'état de la simulation à l'écran reste celui du canvas.
  }, [graph, saved, positions, persist])

  const onPositionsChange = useCallback(
    (next: Positions) => {
      const merged = { ...(savedRef.current ?? {}), ...next }
      savedRef.current = merged
      persist(merged)
    },
    [persist],
  )

  return { positions, onPositionsChange }
}
