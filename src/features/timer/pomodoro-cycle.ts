import type { FocusSessionRecord } from '@/shared/storage/db'

import type { SegmentKind } from './engine/timer-engine'

export interface PomodoroCycleConfig {
  sessionsBeforeLongBreak: number
}

export interface PomodoroCycleState {
  segment: SegmentKind
  completedFocusCount: number
}

export function createPomodoroCycle(segment: SegmentKind = 'focus'): PomodoroCycleState {
  return { segment, completedFocusCount: 0 }
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * Numéro de session dérivé de l'historique réel (LOT E3), pas d'un compteur local : un
 * compteur purement en mémoire repart toujours à 0 à l'ouverture de l'app sur un nouvel
 * appareil ou après un rechargement, même si des sessions du jour existent déjà côté
 * serveur (bug constaté : la 3e session du jour sur l'ordinateur redevenait « session 1 »
 * sur la tablette, et sur l'ordinateur lui-même après rafraîchissement). Compte les
 * sessions de focus du jour (toute heure confondue, enregistrées ou non jusqu'au bout —
 * une session abandonnée a quand même « utilisé » son tour), remis à zéro à chaque pause
 * longue du jour : exactement ce que completedFocusCount représente une fois reconstruit.
 */
export function countFocusSessionsSinceLastLongBreak(
  sessions: FocusSessionRecord[],
  now: number = Date.now(),
): number {
  const todayStart = startOfDay(now)
  const todaysCycleSessions = sessions
    .filter(
      (session) =>
        (session.kind === 'focus' || session.kind === 'long_break') && session.startedAt >= todayStart,
    )
    .sort((a, b) => a.startedAt - b.startedAt)

  let count = 0
  for (const session of todaysCycleSessions) {
    if (session.kind === 'long_break') {
      count = 0
    } else {
      count += 1
    }
  }
  return count
}

export function advancePomodoroCycle(
  current: PomodoroCycleState,
  config: PomodoroCycleConfig,
): PomodoroCycleState {
  if (current.segment === 'focus') {
    const completedFocusCount = current.completedFocusCount + 1
    if (completedFocusCount >= config.sessionsBeforeLongBreak) {
      return { segment: 'long_break', completedFocusCount: 0 }
    }
    return { segment: 'short_break', completedFocusCount }
  }
  return { segment: 'focus', completedFocusCount: current.completedFocusCount }
}
