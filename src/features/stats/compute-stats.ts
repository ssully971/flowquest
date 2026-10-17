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
 * aujourd'hui/cette semaine, série de jours (actuelle et la plus longue). Un jour ne
 * compte dans la série que si le temps de focus cumulé ce jour-là atteint l'objectif
 * quotidien (dailyGoalMinutes) — pas simplement une session, aussi courte soit-elle.
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

  const secondsByDay = new Map<number, number>()
  for (const session of completedFocus) {
    const day = startOfDay(session.startedAt)
    secondsByDay.set(day, (secondsByDay.get(day) ?? 0) + session.actualSeconds)
  }
  const goalSeconds = dailyGoalMinutes * 60
  const daysWithGoalMet = new Set(
    Array.from(secondsByDay.entries())
      .filter(([, seconds]) => seconds >= goalSeconds)
      .map(([day]) => day),
  )

  let currentStreakDays = 0
  let cursor = daysWithGoalMet.has(todayStart) ? todayStart : todayStart - DAY_MS
  while (daysWithGoalMet.has(cursor)) {
    currentStreakDays += 1
    cursor -= DAY_MS
  }

  const sortedDays = Array.from(daysWithGoalMet).sort((a, b) => a - b)
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

export interface DayFocus {
  /** Début du jour (minuit local), en epoch ms — clé stable pour une grille/un graphe. */
  dayStart: number
  focusSeconds: number
  goalMet: boolean
}

/**
 * Historique jour par jour du temps de focus, sur une fenêtre de `days` jours se
 * terminant aujourd'hui inclus — base commune au calendrier de régularité façon GitHub
 * et à la courbe de tendance (§9 du cahier des charges, périmètre restreint à cette
 * phase : pas de score de focus, pas de sélecteur de période au-delà de 7/30 jours).
 */
export function computeDailyFocus(
  sessions: FocusSessionRecord[],
  now: number = Date.now(),
  days: number,
  dailyGoalMinutes: number = DEFAULT_DAILY_GOAL_MINUTES,
): DayFocus[] {
  const completedFocus = sessions.filter((session) => session.kind === 'focus' && session.completed)
  const secondsByDay = new Map<number, number>()
  for (const session of completedFocus) {
    const day = startOfDay(session.startedAt)
    secondsByDay.set(day, (secondsByDay.get(day) ?? 0) + session.actualSeconds)
  }

  const goalSeconds = dailyGoalMinutes * 60
  const todayStart = startOfDay(now)
  const result: DayFocus[] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    const dayStart = todayStart - offset * DAY_MS
    const focusSeconds = secondsByDay.get(dayStart) ?? 0
    result.push({ dayStart, focusSeconds, goalMet: focusSeconds >= goalSeconds })
  }
  return result
}
