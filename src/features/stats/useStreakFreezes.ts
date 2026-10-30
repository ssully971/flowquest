import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { getDb } from '@/shared/storage/db'
import { supabase } from '@/shared/supabase/client'

import { DEFAULT_DAILY_GOAL_MINUTES, startOfDay } from './compute-stats'
import { onSessionRecorded } from './session-events'
import {
  advanceFreezeState,
  getFreezeView,
  groupFocusSecondsByDay,
  initFreezeState,
} from './streak-freezes'
import type { FreezeState, FreezeView } from './streak-freezes'
import {
  loadLocalFreezeState,
  saveLocalFreezeState,
  syncRemoteFreezeState,
} from './streak-freezes-storage'

export interface StreakFreezes {
  view: FreezeView
  /** Jours couverts par un gel, en clés « minuit local » (pour computeStats). */
  frozenDays: ReadonlySet<number>
}

/** Appels de synchro regroupés : AppShell et le panneau montent le hook en même temps,
 * un seul aller-retour réseau est émis pour la même clé. */
const inflight = new Map<string, Promise<FreezeState | null>>()

function dedupe(key: string, run: () => Promise<FreezeState | null>): Promise<FreezeState | null> {
  const pending = inflight.get(key)
  if (pending) return pending
  const promise = run().finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}

/**
 * Gels de série : serveur (RPC idempotente) pour un compte connecté, IndexedDB pour un
 * invité. `null` pendant le chargement.
 */
export function useStreakFreezes(
  dailyGoalMinutes: number = DEFAULT_DAILY_GOAL_MINUTES,
): StreakFreezes | null {
  const { status, user } = useAuth()
  const remote = status === 'authenticated' && !!user && !!supabase
  const [freezes, setFreezes] = useState<StreakFreezes | null>(null)
  const unmountedRef = useRef(false)

  const refresh = useCallback(() => {
    void (async () => {
      const db = await getDb()
      const sessions = await db.getAll('focusSessions')
      const now = Date.now()
      const todayStart = startOfDay(now)
      const secondsByDay = groupFocusSecondsByDay(sessions)
      const goalSeconds = dailyGoalMinutes * 60

      const state = await dedupe(
        `${remote ? user?.id : 'guest'}:${dailyGoalMinutes}:${todayStart}`,
        async () => {
          if (remote) return syncRemoteFreezeState(dailyGoalMinutes)
          const stored = await loadLocalFreezeState()
          const base = stored ?? initFreezeState(secondsByDay, todayStart, goalSeconds)
          const next = advanceFreezeState(base, secondsByDay, todayStart, goalSeconds)
          await saveLocalFreezeState(next)
          return next
        },
      )
      if (unmountedRef.current) return

      const resolved: FreezeState = state ?? {
        processedThrough: todayStart,
        stock: 0,
        accountedSeconds: 0,
        alive: false,
        usedDays: [],
      }
      const todaySeconds = secondsByDay.get(todayStart) ?? 0
      setFreezes({
        view: getFreezeView(resolved, todaySeconds),
        frozenDays: new Set(resolved.usedDays),
      })
    })()
  }, [dailyGoalMinutes, remote, user?.id])

  useEffect(() => {
    unmountedRef.current = false
    refresh()
    const unsubscribe = onSessionRecorded(refresh)
    return () => {
      unmountedRef.current = true
      unsubscribe()
    }
  }, [refresh])

  return freezes
}
