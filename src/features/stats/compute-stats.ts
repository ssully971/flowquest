import type { FocusSessionRecord, TaskRecord } from '@/shared/storage/db'

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

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365]

/** Prochain palier de série (lot 4, panneau de détail) : le plus petit palier connu
 * strictement supérieur à la série actuelle, ou le prochain multiple de 100 au-delà. */
export function getNextStreakMilestone(currentStreakDays: number): number {
  const next = STREAK_MILESTONES.find((milestone) => milestone > currentStreakDays)
  return next ?? Math.ceil((currentStreakDays + 1) / 100) * 100
}

export interface DayFocus {
  /** Début du jour (minuit local), en epoch ms — clé stable pour une grille/un graphe. */
  dayStart: number
  focusSeconds: number
  sessionsCount: number
  goalMet: boolean
}

/**
 * Historique jour par jour du temps de focus, sur une fenêtre de `days` jours se
 * terminant aujourd'hui inclus — base commune au calendrier de régularité façon GitHub
 * et à la courbe de tendance (§9 du cahier des charges).
 */
export function computeDailyFocus(
  sessions: FocusSessionRecord[],
  now: number = Date.now(),
  days: number,
  dailyGoalMinutes: number = DEFAULT_DAILY_GOAL_MINUTES,
): DayFocus[] {
  const completedFocus = sessions.filter((session) => session.kind === 'focus' && session.completed)
  const secondsByDay = new Map<number, number>()
  const countByDay = new Map<number, number>()
  for (const session of completedFocus) {
    const day = startOfDay(session.startedAt)
    secondsByDay.set(day, (secondsByDay.get(day) ?? 0) + session.actualSeconds)
    countByDay.set(day, (countByDay.get(day) ?? 0) + 1)
  }

  const goalSeconds = dailyGoalMinutes * 60
  const todayStart = startOfDay(now)
  const result: DayFocus[] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    const dayStart = todayStart - offset * DAY_MS
    const focusSeconds = secondsByDay.get(dayStart) ?? 0
    const sessionsCount = countByDay.get(dayStart) ?? 0
    result.push({ dayStart, focusSeconds, sessionsCount, goalMet: focusSeconds >= goalSeconds })
  }
  return result
}

export const STATS_PERIODS = ['today', 'week', 'month', '3months', '6months', 'year', 'all'] as const
export type StatsPeriod = (typeof STATS_PERIODS)[number]

/** Longueur en jours de chaque période du §9 (fenêtres glissantes, cohérentes avec
 * computeDailyFocus/computeStats) — `null` pour « depuis le début » (pas de borne basse,
 * pas de période précédente comparable). */
const PERIOD_DAYS: Record<StatsPeriod, number | null> = {
  today: 1,
  week: 7,
  month: 30,
  '3months': 90,
  '6months': 182,
  year: 365,
  all: null,
}

export interface PeriodStats {
  focusSeconds: number
  sessionsCount: number
  pauseSeconds: number
  tasksCompleted: number
}

export interface PeriodComparison {
  current: PeriodStats
  /** `null` pour « depuis le début » : aucune période précédente de même longueur n'a de sens. */
  previous: PeriodStats | null
}

function sumPeriodStats(
  sessions: FocusSessionRecord[],
  tasks: TaskRecord[],
  windowStart: number | null,
  windowEnd: number,
): PeriodStats {
  const inWindow = (timestamp: number) =>
    (windowStart === null || timestamp >= windowStart) && timestamp <= windowEnd

  const completedFocus = sessions.filter(
    (session) => session.kind === 'focus' && session.completed && inWindow(session.startedAt),
  )
  const completedBreaks = sessions.filter(
    (session) =>
      (session.kind === 'short_break' || session.kind === 'long_break') &&
      session.completed &&
      inWindow(session.startedAt),
  )
  const completedTasks = tasks.filter((task) => task.done && task.doneAt !== null && inWindow(task.doneAt))

  return {
    focusSeconds: completedFocus.reduce((sum, session) => sum + session.actualSeconds, 0),
    sessionsCount: completedFocus.length,
    pauseSeconds: completedBreaks.reduce((sum, session) => sum + session.actualSeconds, 0),
    tasksCompleted: completedTasks.length,
  }
}

/**
 * Cartes « temps de focus / nombre de sessions / temps de pause / tâches terminées »
 * du §9, pour la période choisie, comparées à la période précédente de même longueur
 * (flèche + pourcentage affichés côté UI via percentChange).
 */
export function computePeriodStats(
  sessions: FocusSessionRecord[],
  tasks: TaskRecord[],
  now: number,
  period: StatsPeriod,
): PeriodComparison {
  const todayStart = startOfDay(now)
  const days = PERIOD_DAYS[period]

  if (days === null) {
    return { current: sumPeriodStats(sessions, tasks, null, now), previous: null }
  }

  const windowStart = todayStart - (days - 1) * DAY_MS
  const previousWindowEnd = windowStart - 1
  const previousWindowStart = windowStart - days * DAY_MS

  return {
    current: sumPeriodStats(sessions, tasks, windowStart, now),
    previous: sumPeriodStats(sessions, tasks, previousWindowStart, previousWindowEnd),
  }
}

/** Variation en % entre deux valeurs, pour la flèche de comparaison du §9. `null` quand
 * la période précédente est à 0 et la courante ne l'est pas : la variation serait
 * infinie, donc non significative à afficher en pourcentage. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}
