export type TimerMode = 'pomodoro' | 'countdown' | 'stopwatch'
export type SegmentKind = 'focus' | 'short_break' | 'long_break' | 'countdown' | 'stopwatch'
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed'

export interface TimerState {
  mode: TimerMode
  segment: SegmentKind
  durationMs: number | null
  startedAt: number | null
  pausedAt: number | null
  pausedTotalMs: number
  status: TimerStatus
}

export interface TimerSnapshot {
  status: TimerStatus
  elapsedMs: number
  remainingMs: number | null
  isFinished: boolean
  endedAt: number | null
}

export function createTimerState(
  mode: TimerMode,
  segment: SegmentKind,
  durationMs: number | null,
): TimerState {
  return {
    mode,
    segment,
    durationMs,
    startedAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
    status: 'idle',
  }
}

export function start(state: TimerState, now: number = Date.now()): TimerState {
  return {
    ...state,
    status: 'running',
    startedAt: now,
    pausedAt: null,
    pausedTotalMs: 0,
  }
}

export function pause(state: TimerState, now: number = Date.now()): TimerState {
  if (state.status !== 'running') return state
  return { ...state, status: 'paused', pausedAt: now }
}

export function resume(state: TimerState, now: number = Date.now()): TimerState {
  if (state.status !== 'paused' || state.pausedAt === null) return state
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
  }
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

export function getSnapshot(state: TimerState, now: number = Date.now()): TimerSnapshot {
  const elapsedMs = getElapsedMs(state, now)

  if (state.durationMs === null) {
    return { status: state.status, elapsedMs, remainingMs: null, isFinished: false, endedAt: null }
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
  }
}

export function settle(state: TimerState, now: number = Date.now()): TimerState {
  const snapshot = getSnapshot(state, now)
  if (!snapshot.isFinished || state.status === 'completed') return state
  return { ...state, status: 'completed' }
}
