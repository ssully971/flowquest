import { describe, expect, it } from 'vitest'

import { getGreeting } from './greeting'

function at(isoLocal: string): Date {
  return new Date(isoLocal)
}

describe('getGreeting', () => {
  it('salue par le prénom quand il est fourni', () => {
    expect(getGreeting(at('2026-10-14T09:00:00'), 'Sullivan').primary).toBe('Bonjour, Sullivan')
  })

  it('reste correct sans prénom', () => {
    expect(getGreeting(at('2026-10-14T09:00:00')).primary).toBe('Bonjour')
  })

  it('signale le début de semaine le lundi matin', () => {
    expect(getGreeting(at('2026-10-12T08:00:00'), 'Sullivan').primary).toBe(
      'La semaine commence, Sullivan',
    )
  })

  it('signale le week-end qui approche le vendredi après-midi', () => {
    expect(getGreeting(at('2026-10-16T17:00:00')).primary).toBe('Le week-end approche')
  })

  it('distingue après-midi, soirée et nuit', () => {
    expect(getGreeting(at('2026-10-14T14:00:00')).primary).toBe('Bon après-midi')
    expect(getGreeting(at('2026-10-14T20:00:00')).primary).toBe('Bonsoir')
    expect(getGreeting(at('2026-10-14T02:00:00')).primary).toBe('Encore debout ?')
  })
})
