import { describe, expect, it } from 'vitest'

import { isGuestLocked } from './feature-access'

describe('isGuestLocked — règle unique de verrouillage du mode invité', () => {
  it('verrouille un invité quand Supabase est configuré', () => {
    expect(isGuestLocked('guest', true)).toBe(true)
  })

  it('ne verrouille rien sans Supabase (déploiement 100 % local)', () => {
    expect(isGuestLocked('guest', false)).toBe(false)
  })

  it('ne verrouille rien pendant le chargement de la session (pas de flash de cadenas)', () => {
    expect(isGuestLocked('loading', true)).toBe(false)
  })

  it('ne verrouille jamais un compte connecté', () => {
    expect(isGuestLocked('authenticated', true)).toBe(false)
    expect(isGuestLocked('authenticated', false)).toBe(false)
  })
})
