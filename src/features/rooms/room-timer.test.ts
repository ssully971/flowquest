import { describe, expect, it } from 'vitest'

import { computeRoomElapsedMs, computeRoomRemainingMs, computeRoomView, phaseForIndex } from './room-timer'

describe('computeRoomElapsedMs — LOT F3', () => {
  it('renvoie elapsedMsAtPause tel quel en pause', () => {
    const elapsed = computeRoomElapsedMs(
      { status: 'paused', startedAt: null, elapsedMsAtPause: 42_000 },
      Date.now(),
    )
    expect(elapsed).toBe(42_000)
  })

  it('calcule depuis startedAt en cours de route', () => {
    const startedAt = new Date(Date.now() - 10_000).toISOString()
    const elapsed = computeRoomElapsedMs({ status: 'running', startedAt, elapsedMsAtPause: null }, Date.now())
    expect(elapsed).toBeGreaterThanOrEqual(9_900)
    expect(elapsed).toBeLessThanOrEqual(10_100)
  })

  it('renvoie 0 en lobby ou en fin de salon', () => {
    expect(computeRoomElapsedMs({ status: 'lobby', startedAt: null, elapsedMsAtPause: null }, Date.now())).toBe(0)
    expect(computeRoomElapsedMs({ status: 'ended', startedAt: null, elapsedMsAtPause: null }, Date.now())).toBe(0)
  })
})

describe('computeRoomRemainingMs — LOT F3', () => {
  it('décroît avec le temps pendant que le salon tourne', () => {
    const startedAt = new Date(Date.now() - 5_000).toISOString()
    const remaining = computeRoomRemainingMs(
      { status: 'running', startedAt, elapsedMsAtPause: null, durationMs: 60_000 },
      Date.now(),
    )
    expect(remaining).toBeGreaterThanOrEqual(54_900)
    expect(remaining).toBeLessThanOrEqual(55_100)
  })

  it('ne descend jamais sous 0', () => {
    const startedAt = new Date(Date.now() - 120_000).toISOString()
    const remaining = computeRoomRemainingMs(
      { status: 'running', startedAt, elapsedMsAtPause: null, durationMs: 60_000 },
      Date.now(),
    )
    expect(remaining).toBe(0)
  })

  it('vaut 0 une fois le salon terminé', () => {
    const remaining = computeRoomRemainingMs(
      { status: 'ended', startedAt: null, elapsedMsAtPause: 60_000, durationMs: 60_000 },
      Date.now(),
    )
    expect(remaining).toBe(0)
  })

  it('reflète la pause (durée totale moins le temps déjà écoulé)', () => {
    const remaining = computeRoomRemainingMs(
      { status: 'paused', startedAt: null, elapsedMsAtPause: 20_000, durationMs: 60_000 },
      Date.now(),
    )
    expect(remaining).toBe(40_000)
  })
})

describe('phaseForIndex — enchaînement Pomodoro (LOT M2, miroir du SQL)', () => {
  it('alterne focus / pause, pause longue après N focus', () => {
    // N = 4 : F S F S F S F L F ...
    const phases = Array.from({ length: 9 }, (_, i) => phaseForIndex(i, 4))
    expect(phases).toEqual([
      'focus', 'short_break', 'focus', 'short_break', 'focus', 'short_break', 'focus', 'long_break', 'focus',
    ])
  })

  it('pause longue après chaque 2e focus quand N = 2', () => {
    expect([1, 3, 5, 7].map((i) => phaseForIndex(i, 2))).toEqual([
      'short_break', 'long_break', 'short_break', 'long_break',
    ])
  })

  it('retombe sur 4 sessions par défaut', () => {
    expect(phaseForIndex(7, null)).toBe('long_break')
  })
})

describe('computeRoomView — horloge du salon, 3 modes (LOT M2)', () => {
  const NOW = Date.UTC(2026, 0, 15, 12, 0, 0)
  const base = {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 2,
    clockOffsetMs: 0,
    elapsedMsAtPause: null,
  }
  const startedAgo = (ms: number) => new Date(NOW - ms).toISOString()

  it('Minuteur : décompte depuis startedAt, jamais sous 0, isOver quand le temps est écoulé', () => {
    const room = {
      ...base, mode: 'countdown' as const, status: 'running' as const, phase: 'focus' as const, phaseIndex: 0,
      durationMs: 25 * 60_000, startedAt: startedAgo(10 * 60_000),
    }
    const view = computeRoomView(room, NOW)
    expect(view.remainingMs).toBe(15 * 60_000)
    expect(view.isOver).toBe(false)
    const over = computeRoomView({ ...room, startedAt: startedAgo(26 * 60_000) }, NOW)
    expect(over.remainingMs).toBe(0)
    expect(over.isOver).toBe(true)
  })

  it('Chrono : pas de durée, le temps écoulé monte', () => {
    const room = {
      ...base, mode: 'stopwatch' as const, focusMinutes: null, status: 'running' as const,
      phase: 'focus' as const, phaseIndex: 0, durationMs: null, startedAt: startedAgo(90_000),
    }
    const view = computeRoomView(room, NOW)
    expect(view.durationMs).toBeNull()
    expect(view.remainingMs).toBeNull()
    expect(view.elapsedMs).toBe(90_000)
    expect(view.isOver).toBe(false)
  })

  it('Pomodoro : déduit localement les phases enchaînées depuis la dernière réponse du serveur', () => {
    const room = {
      ...base, mode: 'pomodoro' as const, status: 'running' as const, phase: 'focus' as const, phaseIndex: 0,
      durationMs: 25 * 60_000, startedAt: startedAgo((25 + 5 + 10) * 60_000),
    }
    const view = computeRoomView(room, NOW)
    expect(view.phase).toBe('focus')
    expect(view.phaseIndex).toBe(2)
    expect(view.elapsedMs).toBe(10 * 60_000)
    expect(view.remainingMs).toBe(15 * 60_000)
    // Après le 2e focus (N = 2) : pause longue de 15 min.
    const long = computeRoomView({ ...room, startedAt: startedAgo((25 + 5 + 25 + 2) * 60_000) }, NOW)
    expect(long.phase).toBe('long_break')
    expect(long.durationMs).toBe(15 * 60_000)
  })

  it('en pause : fige sur elapsedMsAtPause, quel que soit le temps qui passe', () => {
    const room = {
      ...base, mode: 'pomodoro' as const, status: 'paused' as const, phase: 'focus' as const, phaseIndex: 0,
      durationMs: 25 * 60_000, startedAt: startedAgo(99 * 60_000), elapsedMsAtPause: 7 * 60_000,
    }
    const view = computeRoomView(room, NOW)
    expect(view.elapsedMs).toBe(7 * 60_000)
    expect(view.phaseIndex).toBe(0)
  })

  it('corrige un appareil à l’heure fausse grâce à l’écart d’horloge serveur', () => {
    const room = {
      ...base, mode: 'countdown' as const, status: 'running' as const, phase: 'focus' as const, phaseIndex: 0,
      durationMs: 25 * 60_000, startedAt: startedAgo(10 * 60_000),
      clockOffsetMs: 5 * 60_000, // l'appareil avance de 5 min
    }
    // Horloge locale = heure serveur + 5 min : sans correction, 15 min écoulées au lieu de 10.
    expect(computeRoomView(room, NOW + 5 * 60_000).elapsedMs).toBe(10 * 60_000)
  })

  it('lobby : durée complète annoncée, rien d’écoulé', () => {
    const room = {
      ...base, mode: 'pomodoro' as const, status: 'lobby' as const, phase: 'focus' as const, phaseIndex: 0,
      durationMs: null, startedAt: null,
    }
    const view = computeRoomView(room, NOW)
    expect(view.remainingMs).toBe(25 * 60_000)
    expect(view.elapsedMs).toBe(0)
  })
})
