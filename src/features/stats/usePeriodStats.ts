import { useCallback, useEffect, useRef, useState } from 'react'

import { onTasksChanged } from '@/features/tasks/task-events'
import { getDb } from '@/shared/storage/db'

import { computePeriodStats } from './compute-stats'
import type { PeriodComparison, StatsPeriod } from './compute-stats'
import { onSessionRecorded } from './session-events'

/** Cartes « temps de focus / sessions / pause / tâches terminées » du §9, recalculées
 * pour la période choisie à chaque session enregistrée ou tâche modifiée. */
export function usePeriodStats(period: StatsPeriod): PeriodComparison | null {
  const [data, setData] = useState<PeriodComparison | null>(null)
  const unmountedRef = useRef(false)

  const refresh = useCallback(() => {
    void Promise.all([
      getDb().then((db) => db.getAll('focusSessions')),
      getDb().then((db) => db.getAll('tasks')),
    ]).then(([sessions, tasks]) => {
      if (!unmountedRef.current) setData(computePeriodStats(sessions, tasks, Date.now(), period))
    })
  }, [period])

  useEffect(() => {
    unmountedRef.current = false
    refresh()
    const unsubscribeSessions = onSessionRecorded(refresh)
    const unsubscribeTasks = onTasksChanged(refresh)
    return () => {
      unmountedRef.current = true
      unsubscribeSessions()
      unsubscribeTasks()
    }
  }, [refresh])

  return data
}
