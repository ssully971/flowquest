import { useCallback, useEffect, useState } from 'react'

import { getDb } from '@/shared/storage/db'

import { computeStats } from './compute-stats'
import type { DashboardStats } from './compute-stats'
import { onSessionRecorded } from './session-events'

export function useDashboardStats(): DashboardStats | null {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  const refresh = useCallback(() => {
    void getDb()
      .then((db) => db.getAll('focusSessions'))
      .then((sessions) => setStats(computeStats(sessions)))
  }, [])

  useEffect(() => {
    refresh()
    return onSessionRecorded(refresh)
  }, [refresh])

  return stats
}
