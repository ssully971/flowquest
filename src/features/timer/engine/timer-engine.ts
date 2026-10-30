export type TimerMode = 'pomodoro' | 'countdown' | 'stopwatch'
export type SegmentKind = 'focus' | 'short_break' | 'long_break' | 'countdown' | 'stopwatch'
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed'

/** Garde anti-oubli : tous les 4 h de focus effectif, le Chrono et le Minuteur s'arrêtent et
 * demandent « Tu es toujours là ? » (voir applyGuard). Même intervalle pour le cumul Pomodoro. */
export const GUARD_INTERVAL_MS = 4 * 60 * 60 * 1000

export interface TimerState {
  mode: TimerMode
  segment: SegmentKind
  durationMs: number | null
  startedAt: number | null
  pausedAt: number | null
  pausedTotalMs: number
  status: TimerStatus
  /** Nombre de pauses MANUELLES de cette phase (la pause automatique de la garde de 4 h n'en
   * est pas une). Absent dans un état enregistré avant ce champ : compté comme 0. */
  pauseCount?: number
  /** Temps de focus effectif (ms) auquel la garde de 4 h se déclenche pour cette phase
   * (Chrono / Minuteur). Absent : GUARD_INTERVAL_MS. Chaque « Je suis là » le repousse de 4 h. */
  guardLimitMs?: number
  /** Vrai quand la garde a figé le temps et attend « Je suis là ». */
  guardPending?: boolean
  /** Pomodoro : focus cumulé (ms) AVANT cette phase depuis le démarrage ou la dernière
   * confirmation. À 4 h, le focus suivant n'est pas relancé sans confirmation. */
  guardCarryMs?: number
}

export interface TimerSnapshot {
  status: TimerStatus
  elapsedMs: number
  remainingMs: number | null
  isFinished: boolean
  endedAt: number | null
  /** La garde de 4 h a figé le temps : « Tu es toujours là ? » attend une réponse. */
  guardPending: boolean
}

export function createTimerState(
  mode: TimerMode,
  segment: SegmentKind,
  durationMs: number | null,
  guardCarryMs = 0,
): TimerState {
  return {
    mode,
    segment,
    durationMs,
    startedAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    status: 'idle',
    pauseCount: 0,
    guardCarryMs,
  }
}

export function start(state: TimerState, now: number = Date.now()): TimerState {
  return {
    ...state,
    status: 'running',
    startedAt: now,
    pausedAt: null,
    pausedTotalMs: 0,
    pauseCount: 0,
    guardLimitMs: undefined,
    guardPending: false,
  }
}

export function pause(state: TimerState, now: number = Date.now()): TimerState {
  if (state.status !== 'running') return state
  return { ...state, status: 'paused', pausedAt: now, pauseCount: (state.pauseCount ?? 0) + 1 }
}

export function resume(state: TimerState, now: number = Date.now()): TimerState {
  if (state.status !== 'paused' || state.pausedAt === null) return state
  // Figé par la garde de 4 h : seul « Je suis là » (confirmPresence) relance le temps.
  if (state.guardPending) return state
  return {
    ...state,
    status: 'running',
    pausedTotalMs: state.pausedTotalMs + Math.max(0, now - state.pausedAt),
    pausedAt: null,
  }
}

export function reset(state: TimerState): TimerState {
  return {
    ...state,
    status: 'idle',
    startedAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    pauseCount: 0,
    guardLimitMs: undefined,
    guardPending: false,
  }
}

/** La garde de 4 h concerne le Chrono et le Minuteur (le Pomodoro s'arrête entre deux phases,
 * voir guardCarryMs). */
function isGuarded(state: TimerState): boolean {
  return state.segment === 'stopwatch' || state.segment === 'countdown'
}

/**
 * Garde anti-oubli : si le temps de focus effectif d'une phase qui tourne a atteint sa limite
 * (4 h, 8 h…), l'état est celui d'une pause posée à l'instant EXACT du franchissement — quel que
 * soit le moment où on le calcule (onglet suspendu, application fermée puis rouverte). Le
 * Minuteur plus court que la limite n'est jamais concerné. Fonction pure : renvoie le même objet
 * s'il n'y a rien à figer.
 */
export function applyGuard(state: TimerState, now: number = Date.now()): TimerState {
  if (!isGuarded(state) || state.status !== 'running' || state.startedAt === null) return state
  const limitMs = state.guardLimitMs ?? GUARD_INTERVAL_MS
  if (state.durationMs !== null && limitMs >= state.durationMs) return state
  const crossedAt = state.startedAt + state.pausedTotalMs + limitMs
  if (now < crossedAt) return state
  return {
    ...state,
    status: 'paused',
    pausedAt: crossedAt,
    guardPending: true,
    guardLimitMs: limitMs,
  }
}

/** « Je suis là » : le temps d'absence est compté comme pause, le temps repart et le prochain
 * contrôle est dans 4 h de focus. Sans effet si rien n'attend de confirmation. */
export function confirmPresence(state: TimerState, now: number = Date.now()): TimerState {
  const guarded = applyGuard(state, now)
  if (!guarded.guardPending || guarded.pausedAt === null) return guarded
  return {
    ...guarded,
    status: 'running',
    pausedTotalMs: guarded.pausedTotalMs + Math.max(0, now - guarded.pausedAt),
    pausedAt: null,
    guardPending: false,
    guardLimitMs: (guarded.guardLimitMs ?? GUARD_INTERVAL_MS) + GUARD_INTERVAL_MS,
  }
}

/** Temps de pause total d'une phase à l'instant `now` (pauses terminées + pause en cours). */
export function getPausedMs(state: TimerState, now: number = Date.now()): number {
  const guarded = applyGuard(state, now)
  const trailing = guarded.pausedAt !== null ? Math.max(0, now - guarded.pausedAt) : 0
  return guarded.pausedTotalMs + trailing
}

function getElapsedMs(state: TimerState, now: number): number {
  if (state.startedAt === null) return 0
  const effectiveNow = state.pausedAt !== null ? state.pausedAt : now
  return Math.max(0, effectiveNow - state.startedAt - state.pausedTotalMs)
}

export function getEndedAt(state: TimerState): number | null {
  if (state.startedAt === null || state.durationMs === null) return null
  return state.startedAt + state.pausedTotalMs + state.durationMs
}

export function getSnapshot(rawState: TimerState, now: number = Date.now()): TimerSnapshot {
  const state = applyGuard(rawState, now)
  const elapsedMs = getElapsedMs(state, now)
  const guardPending = state.guardPending === true

  if (state.durationMs === null) {
    return {
      status: state.status,
      elapsedMs,
      remainingMs: null,
      isFinished: false,
      endedAt: null,
      guardPending,
    }
  }

  const overdue = state.status === 'running' && elapsedMs >= state.durationMs
  const isFinished = state.status === 'completed' || overdue
  const status: TimerStatus = overdue ? 'completed' : state.status

  return {
    status,
    elapsedMs: Math.min(elapsedMs, state.durationMs),
    remainingMs: Math.max(0, state.durationMs - elapsedMs),
    isFinished,
    endedAt: isFinished ? getEndedAt(state) : null,
    guardPending,
  }
}

export function settle(rawState: TimerState, now: number = Date.now()): TimerState {
  const state = applyGuard(rawState, now)
  const snapshot = getSnapshot(state, now)
  if (!snapshot.isFinished || state.status === 'completed') return state
  return { ...state, status: 'completed' }
}
