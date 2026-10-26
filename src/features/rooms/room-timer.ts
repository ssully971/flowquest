import type { RoomPhase, RoomState } from './types'

/**
 * Temps écoulé dans le salon, toujours dérivé de `startedAt`/`elapsedMsAtPause` plutôt
 * qu'accumulé localement (même principe que le moteur du minuteur individuel) : reste
 * exact même si l'onglet a été suspendu (iPad Safari) ou l'appareil changé.
 */
export function computeRoomElapsedMs(room: Pick<RoomState, 'status' | 'startedAt' | 'elapsedMsAtPause'>, now: number): number {
  if (room.status === 'paused') return room.elapsedMsAtPause ?? 0
  if (room.status === 'running' && room.startedAt) {
    return Math.max(0, now - new Date(room.startedAt).getTime())
  }
  return 0
}

export function computeRoomRemainingMs(
  room: Pick<RoomState, 'status' | 'startedAt' | 'elapsedMsAtPause' | 'durationMs'>,
  now: number,
): number {
  if (room.durationMs === null) return 0
  if (room.status === 'ended') return 0
  return Math.max(0, room.durationMs - computeRoomElapsedMs(room, now))
}

// ─── Vue d'horloge (LOT M2) : les 3 modes du salon ──────────────────────────

/** Phase d'un numéro donné en Pomodoro : focus aux rangs pairs ; après le n-ième focus,
 * pause longue si n est un multiple de « sessions avant pause longue », sinon pause
 * courte. Miroir exact de `_room_phase_for_index` côté SQL (migration 0049). */
export function phaseForIndex(index: number, sessionsBeforeLongBreak: number | null): RoomPhase {
  if (index % 2 === 0) return 'focus'
  const sessions = Math.max(sessionsBeforeLongBreak ?? 4, 1)
  return (Math.floor((index - 1) / 2) + 1) % sessions === 0 ? 'long_break' : 'short_break'
}

type DurationFields = Pick<
  RoomState,
  'mode' | 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes'
>

/** Durée d'une phase en ms (`null` en Chrono). Miroir de `_room_phase_duration_ms`. */
export function phaseDurationMs(room: DurationFields, phase: RoomPhase): number | null {
  if (room.mode === 'stopwatch') return null
  if (room.mode === 'countdown' || phase === 'focus') return (room.focusMinutes ?? 0) * 60_000
  if (phase === 'short_break') return (room.shortBreakMinutes ?? 5) * 60_000
  return (room.longBreakMinutes ?? 15) * 60_000
}

export interface RoomClockView {
  status: RoomState['status']
  phase: RoomPhase
  phaseIndex: number
  /** Durée de la phase affichée (`null` en Chrono). */
  durationMs: number | null
  /** Temps écoulé dans la phase affichée. */
  elapsedMs: number
  /** Temps restant (`null` en Chrono). */
  remainingMs: number | null
  /** Vrai quand le temps du salon est écoulé (Minuteur) alors que le serveur ne l'a pas
   * encore clôturé : l'écran doit se recharger. */
  isOver: boolean
}

type ViewFields = DurationFields &
  Pick<
    RoomState,
    | 'status'
    | 'phase'
    | 'phaseIndex'
    | 'sessionsBeforeLongBreak'
    | 'startedAt'
    | 'durationMs'
    | 'elapsedMsAtPause'
    | 'clockOffsetMs'
  >

/**
 * Ce que l'horloge du salon doit afficher à l'instant `now` (horloge locale). Dérivé
 * UNIQUEMENT de `startedAt` (heure serveur) corrigé de l'écart d'horloge, jamais d'un
 * compteur local : exact après suspension d'onglet, appareil à l'heure fausse ou perte de
 * connexion. En Pomodoro, les phases qui se sont enchaînées depuis la dernière réponse du
 * serveur sont déduites localement (même règle que `_room_tick`) : le changement de phase
 * est instantané, sans attendre l'aller-retour.
 */
export function computeRoomView(room: ViewFields, now: number): RoomClockView {
  let phase = room.phase
  let phaseIndex = room.phaseIndex
  let durationMs = room.durationMs ?? phaseDurationMs(room, phase)

  if (room.status === 'lobby') {
    const lobbyDuration = phaseDurationMs(room, 'focus')
    return {
      status: 'lobby',
      phase: 'focus',
      phaseIndex: 0,
      durationMs: lobbyDuration,
      elapsedMs: 0,
      remainingMs: lobbyDuration,
      isOver: false,
    }
  }
  if (room.status === 'ended') {
    return { status: 'ended', phase, phaseIndex, durationMs, elapsedMs: 0, remainingMs: 0, isOver: true }
  }

  let elapsed =
    room.status === 'paused'
      ? (room.elapsedMsAtPause ?? 0)
      : room.startedAt
        ? Math.max(0, now - room.clockOffsetMs - new Date(room.startedAt).getTime())
        : 0

  let isOver = false
  if (room.status === 'running' && durationMs !== null && durationMs > 0) {
    let guard = 0
    while (elapsed >= durationMs && guard < 500) {
      guard += 1
      if (room.mode === 'pomodoro') {
        elapsed -= durationMs
        phaseIndex += 1
        phase = phaseForIndex(phaseIndex, room.sessionsBeforeLongBreak)
        durationMs = phaseDurationMs(room, phase) ?? durationMs
      } else {
        elapsed = durationMs
        isOver = true
        break
      }
    }
  }

  return {
    status: room.status,
    phase,
    phaseIndex,
    durationMs,
    elapsedMs: elapsed,
    remainingMs: durationMs === null ? null : Math.max(0, durationMs - elapsed),
    isOver,
  }
}

/**
 * Repères du cycle Pomodoro d'un salon : nombre de focus terminés dans le cycle en cours
 * (pour les pastilles, de 0 à N) et au total depuis le démarrage (pour l'objectif de
 * session). Déduit du numéro de phase : le focus n°k est la phase 2(k−1).
 */
export function groupCycleProgress(
  phaseIndex: number,
  phase: RoomPhase,
  sessionsBeforeLongBreak: number | null,
): { completedInCycle: number; completedTotal: number } {
  const sessions = Math.max(sessionsBeforeLongBreak ?? 4, 1)
  // Focus entièrement terminés : avant un focus de rang pair k/2, après une pause (k+1)/2.
  const completedTotal = phase === 'focus' ? phaseIndex / 2 : (phaseIndex + 1) / 2
  const completedInCycle =
    phase === 'long_break' ? sessions : completedTotal % sessions
  return { completedInCycle, completedTotal }
}
