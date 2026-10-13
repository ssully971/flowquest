import type { SegmentKind } from './engine/timer-engine'

export const POMODORO_DEFAULTS = {
  focusMs: 25 * 60_000,
  shortBreakMs: 5 * 60_000,
  longBreakMs: 10 * 60_000,
  sessionsBeforeLongBreak: 4,
} as const

export function getDurationForSegment(segment: SegmentKind): number {
  switch (segment) {
    case 'focus':
      return POMODORO_DEFAULTS.focusMs
    case 'short_break':
      return POMODORO_DEFAULTS.shortBreakMs
    case 'long_break':
      return POMODORO_DEFAULTS.longBreakMs
    case 'countdown':
    case 'stopwatch':
      throw new Error(`Durée non définie pour le segment ${segment}`)
  }
}
