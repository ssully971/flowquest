import type { PomodoroDurationsMs } from './durations'

export const SESSION_GOAL_TYPES = ['none', 'count', 'duration'] as const
export type SessionGoalType = (typeof SESSION_GOAL_TYPES)[number]

export interface SessionGoalConfig {
  goalType: SessionGoalType
  goalCount: number
  goalMinutes: number
  durations: PomodoroDurationsMs
  sessionsBeforeLongBreak: number
}

export interface SessionGoalPlan {
  focusSessions: number
  shortBreaks: number
  longBreaks: number
  totalMs: number
}

/** Nombre de sessions de focus visées par l'objectif, quel que soit son type (lot 4 :
 * objectif de session choisi en nombre de sessions OU en durée totale de focus). */
export function getGoalFocusSessions(config: SessionGoalConfig): number {
  if (config.goalType === 'count') return Math.max(1, Math.round(config.goalCount))
  if (config.goalType === 'duration') {
    return Math.max(1, Math.ceil((config.goalMinutes * 60_000) / config.durations.focusMs))
  }
  return 0
}

/**
 * Calcule le plan du cycle pour un objectif donné (nombre de sessions et de pauses,
 * durée totale estimée) — affiché avant de démarrer et recalculé à chaque changement,
 * l'objectif restant modifiable en cours de session.
 */
export function computeSessionGoalPlan(config: SessionGoalConfig): SessionGoalPlan | null {
  if (config.goalType === 'none') return null

  const focusSessions = getGoalFocusSessions(config)
  const breaksCount = Math.max(0, focusSessions - 1)
  let longBreaks = 0
  let shortBreaks = 0
  for (let i = 1; i <= breaksCount; i++) {
    if (i % config.sessionsBeforeLongBreak === 0) longBreaks++
    else shortBreaks++
  }

  const totalMs =
    focusSessions * config.durations.focusMs +
    shortBreaks * config.durations.shortBreakMs +
    longBreaks * config.durations.longBreakMs

  return { focusSessions, shortBreaks, longBreaks, totalMs }
}

export function isGoalReached(completedFocusSessions: number, goalFocusSessions: number): boolean {
  return goalFocusSessions > 0 && completedFocusSessions >= goalFocusSessions
}

/** Formatage court d'une durée en heures/minutes pour le résumé du plan (ex. "2 h 10",
 * "45 min") — distinct de format.ts qui formate un minuteur en HH:MM:SS. */
export function formatPlanDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes.toString().padStart(2, '0')}`
}
