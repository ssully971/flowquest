import { describe, expect, it } from 'vitest'

import { computeRoomElapsedMs, computeRoomRemainingMs } from './room-timer'

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
