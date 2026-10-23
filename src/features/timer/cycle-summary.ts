import type { FocusSessionRecord, TaskRecord } from '@/shared/storage/db'

import { startOfDay } from './pomodoro-cycle'

export interface CycleSummary {
  focusSeconds: number
  sessionsCount: number
  pausesCount: number
  completedTasksCount: number
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
  }
}
