import { useCallback, useEffect, useRef, useState } from 'react'

import { getDb } from '@/shared/storage/db'

import { computeStats } from './compute-stats'
import type { DashboardStats } from './compute-stats'
import { onSessionRecorded } from './session-events'

export function useDashboardStats(dailyGoalMinutes?: number): DashboardStats | null {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const unmountedRef = useRef(false)

  const refresh = useCallback(() => {
    void getDb()
      .then((db) => db.getAll('focusSessions'))
      .then((sessions) => {
        if (!unmountedRef.current) setStats(computeStats(sessions, Date.now(), dailyGoalMinutes))
      })
  }, [dailyGoalMinutes])

  useEffect(() => {
    unmountedRef.current = false
    refresh()
    const unsubscribe = onSessionRecorded(refresh)
    return () => {
      unmountedRef.current = true
      unsubscribe()
    }
  }, [refresh])

  return stats
}
