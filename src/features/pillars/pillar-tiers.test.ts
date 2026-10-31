import { describe, expect, it } from 'vitest'

import { hoursToReachLevel } from './pillar-xp'
import { nextTier, PILLAR_TIERS, tierForLevel } from './pillar-tiers'

describe('pillar-tiers', () => {
  it('attribue le bon palier aux bornes', () => {
    expect(tierForLevel(1).id).toBe('novice')
    expect(tierForLevel(2).id).toBe('novice')
    expect(tierForLevel(3).id).toBe('initie')
    expect(tierForLevel(4).id).toBe('initie')
    expect(tierForLevel(5).id).toBe('apprenti')
    expect(tierForLevel(11).id).toBe('adepte')
    expect(tierForLevel(12).id).toBe('expert')
    expect(tierForLevel(25).id).toBe('legende')
    expect(tierForLevel(99).id).toBe('legende')
    expect(tierForLevel(0).id).toBe('novice')
  })

  it('propose le palier suivant, puis plus rien au sommet', () => {
    expect(nextTier(1)?.id).toBe('initie')
    expect(nextTier(5)?.id).toBe('adepte')
    expect(nextTier(25)).toBeNull()
  })

  it('l’apparence croît avec le palier (taille, halo, branches)', () => {
    for (let i = 1; i < PILLAR_TIERS.length; i++) {
      expect(PILLAR_TIERS[i].star.scale).toBeGreaterThan(PILLAR_TIERS[i - 1].star.scale)
      expect(PILLAR_TIERS[i].star.halo).toBeGreaterThanOrEqual(PILLAR_TIERS[i - 1].star.halo)
      expect(PILLAR_TIERS[i].star.points).toBeGreaterThanOrEqual(PILLAR_TIERS[i - 1].star.points)
    }
  })

  it('les paliers demandent de plus en plus d’heures (3 h, 10 h, 28 h, 66 h, 153 h, 300 h)', () => {
    expect(PILLAR_TIERS.slice(1).map((tier) => hoursToReachLevel(tier.minLevel))).toEqual([
      3, 10, 28, 66, 153, 300,
    ])
  })
})
