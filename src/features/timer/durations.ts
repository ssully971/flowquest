import type { SegmentKind } from './engine/timer-engine'

export const POMODORO_DEFAULTS = {
  focusMs: 25 * 60_000,
  shortBreakMs: 5 * 60_000,
  longBreakMs: 10 * 60_000,
  sessionsBeforeLongBreak: 4,
} as const

export interface PomodoroDurationsMs {
  focusMs: number
  shortBreakMs: number
  longBreakMs: number
}

export function getDurationForSegment(
  segment: SegmentKind,
  durations: PomodoroDurationsMs = POMODORO_DEFAULTS,
): number {
  switch (segment) {
    case 'focus':
      return durations.focusMs
    case 'short_break':
      return durations.shortBreakMs
    case 'long_break':
      return durations.longBreakMs
    case 'countdown':
    case 'stopwatch':
      throw new Error(`Durée non définie pour le segment ${segment}`)
  }
}
