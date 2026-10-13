import { describe, expect, it } from 'vitest'

import { formatCountdown, formatElapsed } from './format'

describe('formatCountdown', () => {
  it('affiche la durée pleine tant que la première seconde n’est pas entièrement consommée', () => {
    expect(formatCountdown(25 * 60_000)).toBe('25:00')
    expect(formatCountdown(25 * 60_000 - 1)).toBe('25:00')
  })

  it('formate heures/minutes/secondes au-delà d’une heure', () => {
    expect(formatCountdown(90 * 60_000)).toBe('01:30:00')
  })

  it('ne descend jamais sous 00:00', () => {
    expect(formatCountdown(-500)).toBe('00:00')
  })
})

describe('formatElapsed', () => {
  it('compte les secondes pleines déjà écoulées', () => {
    expect(formatElapsed(0)).toBe('00:00')
    expect(formatElapsed(999)).toBe('00:00')
    expect(formatElapsed(1000)).toBe('00:01')
  })
})
