import { useEffect, useRef, useState } from 'react'

import { getDb } from '@/shared/storage/db'
import type { FocusSessionRecord } from '@/shared/storage/db'

export interface UseGalaxySessionsParams {
  /** Ne charge rien tant que la vue Galaxie n'est pas réellement ouverte (LOT G4) —
   * jamais au démarrage de l'app, contrairement au reste des statistiques. */
  enabled: boolean
  /** Borne basse (inclusive) sur `startedAt`, ou `null` pour « tout » (aucune borne). */
  periodStartMs: number | null
}

export interface UseGalaxySessionsResult {
  /** Sessions de focus validées (complétées), triées du plus récent au plus ancien. */
  sessions: FocusSessionRecord[]
  isLoading: boolean
}

/**
 * Charge les sessions de focus validées via un curseur sur l'index `startedAt`
 * (ordre décroissant) plutôt qu'un `getAll()` qui matérialiserait toute la table d'un
 * coup — une requête par ligne, qui reste dans la même transaction IndexedDB d'un bout
 * à l'autre (nécessaire : un curseur IndexedDB s'invalide si on le fait attendre au-delà
 * d'un tick de l'event loop entre deux pas).
 */
export function useGalaxySessions({
  enabled,
  periodStartMs,
}: UseGalaxySessionsParams): UseGalaxySessionsResult {
  const [sessions, setSessions] = useState<FocusSessionRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const lastKeyRef = useRef<string | null>(null)

  // Armé pendant le rendu plutôt que dans un effet (évite setState synchrone en effet,
  // même technique que FadingQuote/usePhaseQuote au LOT G1) : dès que enabled/periodStartMs
  // change, on sait tout de suite qu'un chargement commence, sans attendre un aller-retour.
  const key = enabled ? String(periodStartMs) : null
  if (key !== lastKeyRef.current) {
    lastKeyRef.current = key
    if (key === null) {
      if (isLoading) setIsLoading(false)
    } else if (!isLoading) {
      setIsLoading(true)
    }
  }

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    void (async () => {
      const db = await getDb()
      const tx = db.transaction('focusSessions')
      const index = tx.store.index('startedAt')
      const range = periodStartMs !== null ? IDBKeyRange.lowerBound(periodStartMs) : undefined

      const collected: FocusSessionRecord[] = []
      let cursor = await index.openCursor(range, 'prev')
      while (cursor) {
        const record = cursor.value
        if (record.kind === 'focus' && record.completed) collected.push(record)
        cursor = await cursor.continue()
      }
      await tx.done

      if (!cancelled) {
        setSessions(collected)
        setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, periodStartMs])

  return { sessions, isLoading }
}
