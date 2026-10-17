import type { SegmentKind, TimerMode } from './engine/timer-engine'

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

/** Segment de départ propre à chaque mode (lot 4 : trois modes de minuteur) — le cycle
 * pomodoro part de 'focus', les deux autres modes n'ont qu'un seul segment. */
export function getDefaultSegmentForMode(mode: TimerMode): SegmentKind {
  switch (mode) {
    case 'pomodoro':
      return 'focus'
    case 'countdown':
      return 'countdown'
    case 'stopwatch':
      return 'stopwatch'
  }
}

/** Durée du segment selon le mode actif : cycle pomodoro (focus/pauses), durée libre
 * choisie en réglages pour le compte à rebours, ou `null` (illimité) pour le chronomètre. */
export function getDurationMsForMode(
  mode: TimerMode,
  segment: SegmentKind,
  pomodoroDurations: PomodoroDurationsMs,
  countdownMs: number,
): number | null {
  switch (mode) {
    case 'pomodoro':
      return getDurationForSegment(segment, pomodoroDurations)
    case 'countdown':
      return countdownMs
    case 'stopwatch':
      return null
  }
}
