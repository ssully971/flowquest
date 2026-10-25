import { describe, expect, it } from 'vitest'

import { deterministicPosition, deterministicUnit } from './galaxy-hash'

describe('deterministicPosition — positions stables, jamais aléatoires (LOT G4)', () => {
  it('renvoie toujours la même position pour la même clé', () => {
    const a = deterministicPosition('session-123')
    const b = deterministicPosition('session-123')
    expect(a).toEqual(b)
  })

  it('renvoie des positions différentes pour des clés différentes', () => {
    const a = deterministicPosition('session-1')
    const b = deterministicPosition('session-2')
    expect(a).not.toEqual(b)
  })

  it('reste toujours dans [0, 1) sur x et y', () => {
    for (const key of ['a', 'b', 'session-999', 'cluster:2026-01:pillar-1', '']) {
      const { x, y } = deterministicPosition(key)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThan(1)
    }
  })

  it('x et y ne sont pas identiques (le PRNG avance bien entre les deux tirages)', () => {
    const { x, y } = deterministicPosition('distinct-check')
    expect(x).not.toBe(y)
  })
})

describe('deterministicUnit', () => {
  it('est stable et dans [0, 1)', () => {
    const a = deterministicUnit('twinkle-phase-1')
    const b = deterministicUnit('twinkle-phase-1')
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(1)
  })
})
