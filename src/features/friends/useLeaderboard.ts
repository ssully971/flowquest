import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'

import { FriendsError, fetchWeeklyLeaderboard } from './friends-repository'
import type { Leaderboard } from './types'

function errorMessage(err: unknown): string {
  return err instanceof FriendsError ? err.message : 'Une erreur est survenue. Réessaie.'
}

/** Classement hebdomadaire (Mode Amis, LOT F2, §3) : semaine en cours (0) ou précédente
 * (1, seule autre valeur acceptée par weekly_leaderboard() — migration 0027). */
export function useLeaderboard() {
  const { status } = useAuth()
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0)
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (status !== 'authenticated') return Promise.resolve()
    return fetchWeeklyLeaderboard(weekOffset)
      .then((result) => {
        setLeaderboard(result)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        setLoadError(errorMessage(err))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [status, weekOffset])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { leaderboard, isLoading, loadError, weekOffset, setWeekOffset, refresh }
}
