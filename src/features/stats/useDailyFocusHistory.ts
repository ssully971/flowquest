import { useCallback, useEffect, useRef, useState } from 'react'

import { getDb } from '@/shared/storage/db'

import { computeDailyFocus } from './compute-stats'
import type { DayFocus } from './compute-stats'
import { onSessionRecorded } from './session-events'

/** Historique jour par jour (§9 du cahier des charges : calendrier de régularité et
 * tendance de focus), sur une fenêtre fixe de `days` jours se terminant à `now` (par
 * défaut aujourd'hui — un autre ancrage permet d'afficher une année civile passée). */
export function useDailyFocusHistory(
  days: number,
  dailyGoalMinutes?: number,
  now?: number,
): DayFocus[] | null {
  const [history, setHistory] = useState<DayFocus[] | null>(null)
  const unmountedRef = useRef(false)

  const refresh = useCallback(() => {
    void getDb()
      .then((db) => db.getAll('focusSessions'))
      .then((sessions) => {
        if (!unmountedRef.current) {
          // Date.now() seulement ici (hors rendu) : un défaut de paramètre serait évalué
          // pendant le rendu, ce que les règles de pureté de React interdisent.
          setHistory(computeDailyFocus(sessions, now ?? Date.now(), days, dailyGoalMinutes))
        }
      })
  }, [days, dailyGoalMinutes, now])

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
