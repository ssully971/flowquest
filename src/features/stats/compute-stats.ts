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

/** Décale un début de jour de `days` jours CALENDAIRES (minuit local → minuit local). Ne
 * jamais soustraire `n * DAY_MS` : un jour de changement d'heure dure 23 h ou 25 h, et le
 * résultat ne tomberait plus sur minuit (clés de jour introuvables, séries cassées). */
function shiftDays(dayStart: number, days: number): number {
  const date = new Date(dayStart)
  date.setDate(date.getDate() + days)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

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
 *
 * Le temps compté est toujours actualSeconds (temps réellement passé, dérivé des
 * horodatages par le moteur — LOT E7), pour TOUTE session de focus enregistrée, que la
 * session soit allée à son terme ou ait été arrêtée en cours de route : un Pomodoro de
 * 25 min arrêté à 18 min crédite bien 18 min, jamais 0. `completed` reste réservé aux
 * métriques qui mesurent spécifiquement le taux d'achèvement (score de focus).
 */
export function computeStats(
  sessions: FocusSessionRecord[],
  now: number = Date.now(),
  dailyGoalMinutes: number = DEFAULT_DAILY_GOAL_MINUTES,
): DashboardStats {
  const focusSessions = sessions.filter((session) => session.kind === 'focus')

  const todayStart = startOfDay(now)
  const todayFocusSeconds = focusSessions
    .filter((session) => session.startedAt >= todayStart)
    .reduce((sum, session) => sum + session.actualSeconds, 0)

  const weekStart = shiftDays(todayStart, -6)
  const weekFocusSeconds = focusSessions
    .filter((session) => session.startedAt >= weekStart)
    .reduce((sum, session) => sum + session.actualSeconds, 0)

  const secondsByDay = new Map<number, number>()
  for (const session of focusSessions) {
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
  let cursor = daysWithGoalMet.has(todayStart) ? todayStart : shiftDays(todayStart, -1)
  while (daysWithGoalMet.has(cursor)) {
    currentStreakDays += 1
    cursor = shiftDays(cursor, -1)
  }

  const sortedDays = Array.from(daysWithGoalMet).sort((a, b) => a - b)
  let longestStreakDays = 0
  let runningStreak = 0
  let previousDay: number | null = null
  for (const day of sortedDays) {
    runningStreak = previousDay !== null && shiftDays(previousDay, 1) === day ? runningStreak + 1 : 1
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
  const focusSessions = sessions.filter((session) => session.kind === 'focus')
  const secondsByDay = new Map<number, number>()
  const countByDay = new Map<number, number>()
  for (const session of focusSessions) {
    const day = startOfDay(session.startedAt)
    secondsByDay.set(day, (secondsByDay.get(day) ?? 0) + session.actualSeconds)
    countByDay.set(day, (countByDay.get(day) ?? 0) + 1)
  }

  const goalSeconds = dailyGoalMinutes * 60
  const todayStart = startOfDay(now)
  const result: DayFocus[] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    const dayStart = shiftDays(todayStart, -offset)
    const focusSeconds = secondsByDay.get(dayStart) ?? 0
    const sessionsCount = countByDay.get(dayStart) ?? 0
    result.push({ dayStart, focusSeconds, sessionsCount, goalMet: focusSeconds >= goalSeconds })
  }
  return result
}

export interface WeekFocus {
  /** Lundi de la semaine (minuit local), en epoch ms. */
  weekStart: number
  focusSeconds: number
  sessionsCount: number
}

/**
 * Regroupe un historique jour par jour en semaines (lundi à dimanche) — utilisé par la
 * courbe de tendance (§9) sur les longues périodes, où une barre par jour serait
 * illisible (ex. un an = 365 barres).
 */
export function aggregateWeeklyFocus(days: DayFocus[]): WeekFocus[] {
  const byWeek = new Map<number, WeekFocus>()
  for (const day of days) {
    const weekday = new Date(day.dayStart).getDay() // 0 = dimanche
    const mondayOffset = (weekday + 6) % 7
    const weekStart = shiftDays(day.dayStart, -mondayOffset)
    const existing = byWeek.get(weekStart) ?? { weekStart, focusSeconds: 0, sessionsCount: 0 }
    existing.focusSeconds += day.focusSeconds
    existing.sessionsCount += day.sessionsCount
    byWeek.set(weekStart, existing)
  }
  return Array.from(byWeek.values()).sort((a, b) => a.weekStart - b.weekStart)
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

/** Fenêtre (en jours) à afficher pour la tendance de focus sur la période choisie (§9 :
 * « courbe sur la période choisie »), avec un minimum de 7 jours (un seul point n'a pas
 * de courbe) et un plafond d'un an pour « depuis le début » (historique potentiellement
 * illimité). */
export function getTrendWindowDays(period: StatsPeriod): number {
  const days = PERIOD_DAYS[period]
  return days === null ? 365 : Math.max(7, days)
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

  const focusSessions = sessions.filter(
    (session) => session.kind === 'focus' && inWindow(session.startedAt),
  )
  const breakSessions = sessions.filter(
    (session) =>
      (session.kind === 'short_break' || session.kind === 'long_break') &&
      inWindow(session.startedAt),
  )
  const completedTasks = tasks.filter((task) => task.done && task.doneAt !== null && inWindow(task.doneAt))

  return {
    focusSeconds: focusSessions.reduce((sum, session) => sum + session.actualSeconds, 0),
    sessionsCount: focusSessions.length,
    pauseSeconds: breakSessions.reduce((sum, session) => sum + session.actualSeconds, 0),
    tasksCompleted: completedTasks.length,
  }
}

/** Bornes d'une fenêtre glissante de `days` jours se terminant aujourd'hui, et de la
 * fenêtre précédente de même longueur immédiatement avant — base commune à toutes les
 * comparaisons « vs période précédente » du §9. */
function getRollingWindow(
  todayStart: number,
  days: number,
): { start: number; previousStart: number; previousEnd: number } {
  const start = shiftDays(todayStart, -(days - 1))
  return { start, previousStart: shiftDays(start, -days), previousEnd: start - 1 }
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

  const { start, previousStart, previousEnd } = getRollingWindow(todayStart, days)

  return {
    current: sumPeriodStats(sessions, tasks, start, now),
    previous: sumPeriodStats(sessions, tasks, previousStart, previousEnd),
  }
}

/** Variation en % entre deux valeurs, pour la flèche de comparaison du §9. `null` quand
 * la période précédente est à 0 et la courante ne l'est pas : la variation serait
 * infinie, donc non significative à afficher en pourcentage. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

export interface FocusScore {
  /** Taux de complétion × régularité, arrondi, de 0 à 100. */
  score: number
  /** Part des sessions de focus lancées (terminées ou abandonnées) qui sont allées
   * jusqu'au bout, arrondie, de 0 à 100. */
  completionRate: number
  /** Part des jours de la période avec au moins une session de focus lancée, arrondie,
   * de 0 à 100. */
  regularityRate: number
}

export interface FocusScoreComparison {
  current: FocusScore
  /** `null` pour « depuis le début » : aucune période précédente comparable. */
  previous: FocusScore | null
}

const EMPTY_FOCUS_SCORE: FocusScore = { score: 0, completionRate: 0, regularityRate: 0 }

function computeFocusScoreForWindow(
  sessions: FocusSessionRecord[],
  windowStart: number | null,
  windowEnd: number,
  totalDays: number,
): FocusScore {
  const inWindow = (timestamp: number) =>
    (windowStart === null || timestamp >= windowStart) && timestamp <= windowEnd
  const startedFocus = sessions.filter((session) => session.kind === 'focus' && inWindow(session.startedAt))
  if (startedFocus.length === 0 || totalDays <= 0) return EMPTY_FOCUS_SCORE

  const completionRate =
    (startedFocus.filter((session) => session.completed).length / startedFocus.length) * 100

  const activeDays = new Set(startedFocus.map((session) => startOfDay(session.startedAt))).size
  const regularityRate = Math.min(100, (activeDays / totalDays) * 100)

  return {
    score: Math.round((completionRate / 100) * (regularityRate / 100) * 100),
    completionRate: Math.round(completionRate),
    regularityRate: Math.round(regularityRate),
  }
}

/**
 * Score de focus (§9, définition validée) : taux de sessions de focus lancées qui sont
 * allées jusqu'au bout, pondéré par la régularité (part des jours de la période avec au
 * moins une session). Pour « depuis le début », la période part de la toute première
 * session de focus jamais lancée plutôt que d'une fenêtre fixe.
 */
export function computeFocusScore(
  sessions: FocusSessionRecord[],
  now: number,
  period: StatsPeriod,
): FocusScoreComparison {
  const todayStart = startOfDay(now)
  const days = PERIOD_DAYS[period]

  if (days === null) {
    const focusStartTimes = sessions
      .filter((session) => session.kind === 'focus')
      .map((session) => session.startedAt)
    if (focusStartTimes.length === 0) return { current: EMPTY_FOCUS_SCORE, previous: null }

    const earliestDay = startOfDay(Math.min(...focusStartTimes))
    const totalDays = Math.round((todayStart - earliestDay) / DAY_MS) + 1
    return {
      current: computeFocusScoreForWindow(sessions, earliestDay, now, totalDays),
      previous: null,
    }
  }

  const { start, previousStart, previousEnd } = getRollingWindow(todayStart, days)

  return {
    current: computeFocusScoreForWindow(sessions, start, now, days),
    previous: computeFocusScoreForWindow(sessions, previousStart, previousEnd, days),
  }
}
