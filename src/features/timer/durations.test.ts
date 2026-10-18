import { describe, expect, it } from 'vitest'

import {
  getDefaultSegmentForMode,
  getDurationForSegment,
  getDurationMsForMode,
  POMODORO_DEFAULTS,
} from './durations'

const DURATIONS_MS = {
  focusMs: POMODORO_DEFAULTS.focusMs,
  shortBreakMs: POMODORO_DEFAULTS.shortBreakMs,
  longBreakMs: POMODORO_DEFAULTS.longBreakMs,
}

describe('getDefaultSegmentForMode — segment de départ propre à chaque mode (lot 4)', () => {
  it('pomodoro démarre sur focus', () => {
    expect(getDefaultSegmentForMode('pomodoro')).toBe('focus')
  })

  it('compte à rebours et chronomètre ont chacun leur propre segment', () => {
    expect(getDefaultSegmentForMode('countdown')).toBe('countdown')
    expect(getDefaultSegmentForMode('stopwatch')).toBe('stopwatch')
  })
})

describe('getDurationMsForMode — durée du segment selon le mode actif (lot 4)', () => {
  it('pomodoro réutilise la durée du segment du cycle', () => {
    expect(getDurationMsForMode('pomodoro', 'focus', DURATIONS_MS, 0)).toBe(
      getDurationForSegment('focus', DURATIONS_MS),
    )
    expect(getDurationMsForMode('pomodoro', 'short_break', DURATIONS_MS, 0)).toBe(
      getDurationForSegment('short_break', DURATIONS_MS),
    )
  })

  it('compte à rebours utilise la durée libre fournie, indépendamment du cycle pomodoro', () => {
    const twentyMinutesMs = 20 * 60_000
    expect(getDurationMsForMode('countdown', 'countdown', DURATIONS_MS, twentyMinutesMs)).toBe(
      twentyMinutesMs,
    )
  })

  it('chronomètre n’a pas de durée (illimité)', () => {
    expect(getDurationMsForMode('stopwatch', 'stopwatch', DURATIONS_MS, 0)).toBeNull()
  })
})
