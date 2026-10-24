import { describe, expect, it } from 'vitest'

import { colorForIdentity, initialsForIdentity } from './avatar-colors'

describe('colorForIdentity — couleur par défaut déterministe (LOT F1)', () => {
  it('renvoie toujours la même couleur pour la même graine', () => {
    expect(colorForIdentity('user-123')).toBe(colorForIdentity('user-123'))
  })

  it('renvoie une couleur CSS valide (#rrggbb)', () => {
    expect(colorForIdentity('user-123')).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('deux graines différentes ne tombent pas toujours sur la même couleur', () => {
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(colorForIdentity))
    expect(colors.size).toBeGreaterThan(1)
  })
})

describe('initialsForIdentity — jamais de case vide (LOT F1)', () => {
  it('utilise les deux premières lettres du nom affiché si présent', () => {
    expect(initialsForIdentity('Sullivan Huriez', 'ssully')).toBe('SH')
  })

  it('retombe sur le pseudo si aucun nom affiché', () => {
    expect(initialsForIdentity(null, 'ssully')).toBe('SS')
  })

  it('un seul mot : prend ses deux premières lettres', () => {
    expect(initialsForIdentity('Flow', 'ssully')).toBe('FL')
  })

  it('ne renvoie jamais une chaîne vide', () => {
    expect(initialsForIdentity('', '')).toBe('?')
  })
})
