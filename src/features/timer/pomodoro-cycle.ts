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
