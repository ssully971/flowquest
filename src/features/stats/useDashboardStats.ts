import { useCallback, useEffect, useRef, useState } from 'react'

import { getDb } from '@/shared/storage/db'

import { computeStats } from './compute-stats'
import type { DashboardStats } from './compute-stats'
import { onSessionRecorded } from './session-events'
import { useStreakFreezes } from './useStreakFreezes'

export function useDashboardStats(dailyGoalMinutes?: number): DashboardStats | null {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const freezes = useStreakFreezes(dailyGoalMinutes)
  const frozenDays = freezes?.frozenDays
  const unmountedRef = useRef(false)

  const refresh = useCallback(() => {
    void getDb()
      .then((db) => db.getAll('focusSessions'))
      .then((sessions) => {
        if (!unmountedRef.current)
          setStats(computeStats(sessions, Date.now(), dailyGoalMinutes, frozenDays))
      })
  }, [dailyGoalMinutes, frozenDays])

  useEffect(() => {
    unmountedRef.current = false
    refresh()
    const unsubscribe = onSessionRecorded(refresh)
    return () => {
      unmountedRef.current = true
      unsubscribe()
    }
  }, [refresh])

  return stats ? { ...stats, freezes: freezes?.view } : null
}
