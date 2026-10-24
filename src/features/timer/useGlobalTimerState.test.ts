import { describe, expect, it } from 'vitest'

import { deriveLiveState } from './useGlobalTimerState'

describe('deriveLiveState — statut simplifié focus/pause/inactif (LOT F2)', () => {
  it('aucun état persisté : inactif', () => {
    expect(deriveLiveState(null)).toEqual({ liveState: 'inactive', startedAt: null, durationMs: null })
  })

  it('jamais démarré (startedAt null) : inactif', () => {
    expect(
      deriveLiveState({
        mode: 'pomodoro',
        segment: 'focus',
        durationMs: 1500000,
        startedAt: null,
        pausedAt: null,
        pausedTotalMs: 0,
        status: 'idle',
      }),
    ).toEqual({ liveState: 'inactive', startedAt: null, durationMs: null })
  })

  it('segment focus, en cours : focus', () => {
    const result = deriveLiveState({
      mode: 'pomodoro',
      segment: 'focus',
      durationMs: 1500000,
      startedAt: 1000,
      pausedAt: null,
      pausedTotalMs: 0,
      status: 'running',
    })
    expect(result).toEqual({ liveState: 'focus', startedAt: 1000, durationMs: 1500000 })
  })

  it('segment pause courte, en cours : pause', () => {
    const result = deriveLiveState({
      mode: 'pomodoro',
      segment: 'short_break',
      durationMs: 300000,
      startedAt: 1000,
      pausedAt: null,
      pausedTotalMs: 0,
      status: 'running',
    })
    expect(result.liveState).toBe('pause')
  })

  it('segment pause longue, en cours : pause', () => {
    const result = deriveLiveState({
      mode: 'pomodoro',
      segment: 'long_break',
      durationMs: 600000,
      startedAt: 1000,
      pausedAt: null,
      pausedTotalMs: 0,
      status: 'running',
    })
    expect(result.liveState).toBe('pause')
  })

  it('minuteur explicitement en pause (quel que soit le segment) : pause', () => {
    const result = deriveLiveState({
      mode: 'pomodoro',
      segment: 'focus',
      durationMs: 1500000,
      startedAt: 1000,
      pausedAt: 2000,
      pausedTotalMs: 0,
      status: 'paused',
    })
    expect(result.liveState).toBe('pause')
  })

  it('segment terminé (status completed) : inactif', () => {
    const result = deriveLiveState({
      mode: 'pomodoro',
      segment: 'focus',
      durationMs: 1500000,
      startedAt: 1000,
      pausedAt: null,
      pausedTotalMs: 0,
      status: 'completed',
    })
    expect(result.liveState).toBe('inactive')
  })

  it('compte à rebours / chronomètre en cours comptent comme focus', () => {
    expect(
      deriveLiveState({
        mode: 'countdown',
        segment: 'countdown',
        durationMs: 1200000,
        startedAt: 1000,
        pausedAt: null,
        pausedTotalMs: 0,
        status: 'running',
      }).liveState,
    ).toBe('focus')
    expect(
      deriveLiveState({
        mode: 'stopwatch',
        segment: 'stopwatch',
        durationMs: null,
        startedAt: 1000,
        pausedAt: null,
        pausedTotalMs: 0,
        status: 'running',
      }).liveState,
    ).toBe('focus')
  })
})
