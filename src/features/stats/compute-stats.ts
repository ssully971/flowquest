import type { FocusSessionRecord } from '@/shared/storage/db'

export interface DashboardStats {
  todayFocusSeconds: number
  weekFocusSeconds: number
  currentStreakDays: number
  longestStreakDays: number
  dailyGoalMinutes: number
}

const DAY_MS = 24 * 60 * 60 * 1000
export const DEFAULT_DAILY_GOAL_MINUTES = 120

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * Calcule les statistiques de base (§9 du cahier des charges, périmètre restreint à
 * cette phase) à partir de l'historique local de sessions : temps de focus
 * aujourd'hui/cette semaine, série de jours (actuelle et la plus longue).
 */
export function computeStats(
  sessions: FocusSessionRecord[],
  now: number = Date.now(),
  dailyGoalMinutes: number = DEFAULT_DAILY_GOAL_MINUTES,
): DashboardStats {
  const completedFocus = sessions.filter((session) => session.kind === 'focus' && session.completed)

  const todayStart = startOfDay(now)
  const todayFocusSeconds = completedFocus
    .filter((session) => session.startedAt >= todayStart)
    .reduce((sum, session) => sum + session.actualSeconds, 0)

  const weekStart = todayStart - 6 * DAY_MS
  const weekFocusSeconds = completedFocus
    .filter((session) => session.startedAt >= weekStart)
    .reduce((sum, session) => sum + session.actualSeconds, 0)

  const daysWithFocus = new Set(completedFocus.map((session) => startOfDay(session.startedAt)))

  let currentStreakDays = 0
  let cursor = daysWithFocus.has(todayStart) ? todayStart : todayStart - DAY_MS
  while (daysWithFocus.has(cursor)) {
    currentStreakDays += 1
    cursor -= DAY_MS
  }

  const sortedDays = Array.from(daysWithFocus).sort((a, b) => a - b)
  let longestStreakDays = 0
  let runningStreak = 0
  let previousDay: number | null = null
  for (const day of sortedDays) {
    runningStreak = previousDay !== null && day - previousDay === DAY_MS ? runningStreak + 1 : 1
    longestStreakDays = Math.max(longestStreakDays, runningStreak)
    previousDay = day
  }

  return {
    todayFocusSeconds,
    weekFocusSeconds,
    currentStreakDays,
    longestStreakDays,
    dailyGoalMinutes,
  }
}
