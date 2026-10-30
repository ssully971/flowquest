import { GUARD_INTERVAL_MS } from './engine/timer-engine'
import type { SegmentKind, TimerState } from './engine/timer-engine'

/**
 * Garde anti-oubli du Pomodoro (le Chrono et le Minuteur sont gérés par le moteur lui-même,
 * voir applyGuard) : le focus cumulé depuis le démarrage — ou la dernière confirmation —
 * voyage de phase en phase (TimerState.guardCarryMs). Quand il atteint 4 h, le focus SUIVANT
 * n'est pas relancé tout seul : à la fin de la pause en cours, « Tu es toujours là ? » attend
 * « Je suis là » ; sans réponse, rien ne démarre et rien n'est compté.
 */

/** Focus cumulé après une phase terminée : seules les phases de focus comptent. */
export function carryAfterSegment(
  carryMs: number,
  segment: SegmentKind,
  elapsedMs: number,
): number {
  return segment === 'focus' ? carryMs + Math.max(0, elapsedMs) : carryMs
}

/** La phase qui vient de se terminer est une pause et 4 h de focus sont atteintes (ou dépassées) :
 * il faut demander avant de relancer un focus. */
export function mustAskBeforeNextFocus(finished: SegmentKind, nextCarryMs: number): boolean {
  return (
    (finished === 'short_break' || finished === 'long_break') && nextCarryMs >= GUARD_INTERVAL_MS
  )
}

/** Le focus en attente (inactif) a déjà 4 h cumulées : la confirmation est due. Dérivé de l'état
 * enregistré, donc toujours exact après un rechargement. */
export function isPomodoroPresenceDue(state: TimerState): boolean {
  return (
    state.mode === 'pomodoro' &&
    state.segment === 'focus' &&
    state.status === 'idle' &&
    (state.guardCarryMs ?? 0) >= GUARD_INTERVAL_MS
  )
}
