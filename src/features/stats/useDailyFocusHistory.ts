import { useCallback, useEffect, useRef, useState } from 'react'

import { getDb } from '@/shared/storage/db'

import { computeDailyFocus } from './compute-stats'
import type { DayFocus } from './compute-stats'
import { onSessionRecorded } from './session-events'

/** Historique jour par jour (§9 du cahier des charges : calendrier de régularité et
 * tendance de focus), sur une fenêtre fixe de `days` jours se terminant aujourd'hui. */
export function useDailyFocusHistory(days: number, dailyGoalMinutes?: number): DayFocus[] | null {
  const [history, setHistory] = useState<DayFocus[] | null>(null)
  const unmountedRef = useRef(false)

  const refresh = useCallback(() => {
    void getDb()
      .then((db) => db.getAll('focusSessions'))
      .then((sessions) => {
        if (!unmountedRef.current) {
          setHistory(computeDailyFocus(sessions, Date.now(), days, dailyGoalMinutes))
        }
      })
  }, [days, dailyGoalMinutes])

  useEffect(() => {
    unmountedRef.current = false
    refresh()
    const unsubscribe = onSessionRecorded(refresh)
    return () => {
      unmountedRef.current = true
      unsubscribe()
    }
  }, [refresh])

  return history
}
