import { useCallback, useState } from 'react'

import { DEFAULT_DAILY_GOAL_MINUTES } from './compute-stats'

// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const STORAGE_KEY = 'flowquest.dailyGoalMinutes'
export const MIN_DAILY_GOAL_MINUTES = 15
export const MAX_DAILY_GOAL_MINUTES = 480
export const DAILY_GOAL_STEP_MINUTES = 15

function clamp(minutes: number): number {
  return Math.min(MAX_DAILY_GOAL_MINUTES, Math.max(MIN_DAILY_GOAL_MINUTES, minutes))
}

function readStored(): number {
  if (typeof window === 'undefined') return DEFAULT_DAILY_GOAL_MINUTES
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DAILY_GOAL_MINUTES
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? clamp(parsed) : DEFAULT_DAILY_GOAL_MINUTES
  } catch {
    return DEFAULT_DAILY_GOAL_MINUTES
  }
}

export interface UseDailyGoalResult {
  dailyGoalMinutes: number
  setDailyGoalMinutes: (minutes: number) => void
}

export function useDailyGoal(): UseDailyGoalResult {
  const [dailyGoalMinutes, setDailyGoalMinutesState] = useState<number>(readStored)

  const setDailyGoalMinutes = useCallback((minutes: number) => {
    const next = clamp(minutes)
    setDailyGoalMinutesState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // Stockage indisponible (navigation privée) : le choix ne survit pas au rechargement.
    }
  }, [])

  return { dailyGoalMinutes, setDailyGoalMinutes }
}
