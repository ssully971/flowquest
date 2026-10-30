import { xpForActualSeconds } from '@/features/pillars/pillar-xp'
import type { FocusSessionRecord, TaskRecord } from '@/shared/storage/db'

import { getPausedMs, getSnapshot } from './engine/timer-engine'
import type { TimerState } from './engine/timer-engine'
import { startOfDay } from './pomodoro-cycle'

export interface CycleSummary {
  focusSeconds: number
  sessionsCount: number
  /** Nombre de PHASES de pause (courte/longue) du cycle Pomodoro. */
  pausesCount: number
  completedTasksCount: number
  /** Temps de pause total (s) : pauses manuelles + absence, plus les phases de pause du cycle. */
  pausedSeconds: number
  /** Pauses MANUELLES (bouton Pause) faites pendant les phases de focus. */
  manualPauseCount: number
  /** XP de pilier gagnée par les sessions de focus avec un pilier. */
  xpGained: number
}

function xpOf(session: FocusSessionRecord): number {
  return session.kind === 'focus' && session.pillarId
    ? xpForActualSeconds(session.actualSeconds)
    : 0
}

/**
 * Bilan du cycle qui vient de se terminer (LOT E6) : mêmes bornes que
 * countFocusSessionsSinceLastLongBreak (sessions du jour, depuis la dernière pause
 * longue), mais sur l'historique complet du cycle plutôt que son seul décompte.
 *
 * Les tâches validées sont comptées via TaskRecord.doneAt plutôt que via
 * FocusSessionRecord.taskId : ce dernier n'est jamais renseigné par recordSession
 * (aucune tâche active n'est liée à une session), alors que doneAt est fiable — posé à
 * Date.now() au moment où la tâche est cochée (voir useTasks.ts).
 */
export function computeCycleSummary(
  sessions: FocusSessionRecord[],
  tasks: TaskRecord[],
  now: number = Date.now(),
): CycleSummary {
  const todayStart = startOfDay(now)
  const todaysSessions = sessions
    .filter((session) => session.startedAt >= todayStart)
    .sort((a, b) => a.startedAt - b.startedAt)

  let cutoffIndex = 0
  for (let index = 0; index < todaysSessions.length; index++) {
    if (todaysSessions[index].kind === 'long_break') cutoffIndex = index + 1
  }
  const cycleSessions = todaysSessions.slice(cutoffIndex)
  const cycleStart = cycleSessions.length > 0 ? cycleSessions[0].startedAt : now

  const focusSessions = cycleSessions.filter((session) => session.kind === 'focus')
  const pauseSessions = cycleSessions.filter((session) => session.kind !== 'focus')
  const focusSeconds = focusSessions.reduce((sum, session) => sum + session.actualSeconds, 0)
  const completedTasksCount = tasks.filter(
    (task) => task.done && task.doneAt !== null && task.doneAt >= cycleStart,
  ).length

  return {
    focusSeconds,
    sessionsCount: focusSessions.length,
    pausesCount: pauseSessions.length,
    completedTasksCount,
    pausedSeconds:
      focusSessions.reduce((sum, session) => sum + (session.pausedSeconds ?? 0), 0) +
      pauseSessions.reduce((sum, session) => sum + session.actualSeconds, 0),
    manualPauseCount: focusSessions.reduce((sum, session) => sum + (session.pauseCount ?? 0), 0),
    xpGained: focusSessions.reduce((sum, session) => sum + xpOf(session), 0),
  }
}

/**
 * Bilan d'UNE session Chrono / Minuteur qu'on vient de terminer (le bilan de cycle ci-dessus
 * regroupe les phases d'un Pomodoro) : temps de focus réel, temps de pause (pauses manuelles et
 * absence après la garde de 4 h), nombre de pauses manuelles, tâches cochées depuis le début de
 * la session et XP de pilier si un pilier était actif.
 */
export function summarizeSoloSession(
  state: TimerState,
  endedAt: number,
  tasks: TaskRecord[],
  pillarActive: boolean,
): CycleSummary {
  const focusSeconds = Math.round(getSnapshot(state, endedAt).elapsedMs / 1000)
  const startedAt = state.startedAt ?? endedAt
  return {
    focusSeconds,
    sessionsCount: 1,
    pausesCount: 0,
    completedTasksCount: tasks.filter(
      (task) => task.done && task.doneAt !== null && task.doneAt >= startedAt,
    ).length,
    pausedSeconds: Math.round(getPausedMs(state, endedAt) / 1000),
    manualPauseCount: state.pauseCount ?? 0,
    xpGained: pillarActive ? xpForActualSeconds(focusSeconds) : 0,
  }
}
