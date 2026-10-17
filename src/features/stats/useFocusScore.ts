import { useCallback, useEffect, useRef, useState } from 'react'

import { getDb } from '@/shared/storage/db'

import { computeFocusScore } from './compute-stats'
import type { FocusScoreComparison, StatsPeriod } from './compute-stats'
import { onSessionRecorded } from './session-events'

/** Carte « score de focus » (§9), recalculée pour la période choisie à chaque session
 * enregistrée. */
export function useFocusScore(period: StatsPeriod): FocusScoreComparison | null {
  const [data, setData] = useState<FocusScoreComparison | null>(null)
  const unmountedRef = useRef(false)

  const refresh = useCallback(() => {
    void getDb()
      .then((db) => db.getAll('focusSessions'))
      .then((sessions) => {
        if (!unmountedRef.current) setData(computeFocusScore(sessions, Date.now(), period))
      })
  }, [period])

  useEffect(() => {
    unmountedRef.current = false
    refresh()
    const unsubscribe = onSessionRecorded(refresh)
    return () => {
      unmountedRef.current = true
      unsubscribe()
    }
  }, [refresh])

  return data
}
