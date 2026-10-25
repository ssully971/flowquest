import { describe, expect, it } from 'vitest'

import { deterministicUnit } from './galaxy-hash'

describe('deterministicUnit', () => {
  it('est stable et dans [0, 1)', () => {
    const a = deterministicUnit('twinkle-phase-1')
    const b = deterministicUnit('twinkle-phase-1')
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(1)
  })
})
