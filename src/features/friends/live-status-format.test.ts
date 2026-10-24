import { describe, expect, it } from 'vitest'

import { formatElapsedMinutes, liveStateColor } from './live-status-format'

describe('formatElapsedMinutes — minutes écoulées (LOT F2)', () => {
  it('calcule les minutes écoulées depuis startedAt', () => {
    const now = Date.UTC(2026, 0, 1, 12, 12, 0)
    const startedAt = new Date(Date.UTC(2026, 0, 1, 12, 0, 0)).toISOString()
    expect(formatElapsedMinutes(startedAt, now)).toBe(12)
  })

  it('ne renvoie jamais une valeur négative', () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0)
    const startedAt = new Date(Date.UTC(2026, 0, 1, 12, 5, 0)).toISOString()
    expect(formatElapsedMinutes(startedAt, now)).toBe(0)
  })
})

describe('liveStateColor — couleur du point de statut (LOT F2)', () => {
  it('vert en focus', () => {
    expect(liveStateColor('focus')).toBe('#22C55E')
  })

  it('ambre en pause', () => {
    expect(liveStateColor('pause')).toBe('#F59E0B')
  })

  it('gris neutre sinon', () => {
    expect(liveStateColor('inactive')).toBe('#9CA3AF')
  })
})
