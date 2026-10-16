import { describe, expect, it } from 'vitest'

import { BACKGROUNDS, BACKGROUND_IDS, getBackgroundDefinition } from './registry'
import type { BackgroundCategory } from './registry'

const ALL_CATEGORIES: BackgroundCategory[] = [
  'gradients',
  'abstract',
  'scenic',
  'nature',
  'urban',
  'interior',
  'animated',
]

describe('backgrounds registry — bibliothèque par catégories (§7.1 du cahier des charges)', () => {
  it('chaque catégorie du cahier des charges a au moins un fond', () => {
    for (const category of ALL_CATEGORIES) {
      const inCategory = BACKGROUNDS.filter((bg) => bg.category === category)
      expect(inCategory.length).toBeGreaterThan(0)
    }
  })

  it('tous les identifiants de fonds sont uniques', () => {
    const ids = BACKGROUNDS.map((bg) => bg.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('BACKGROUND_IDS contient exactement les identifiants de BACKGROUNDS', () => {
    expect(BACKGROUND_IDS).toEqual(BACKGROUNDS.map((bg) => bg.id))
  })

  it('getBackgroundDefinition retrouve un fond par son identifiant', () => {
    const def = getBackgroundDefinition('silhouettes')
    expect(def.label).toBe('Silhouettes')
    expect(def.category).toBe('urban')
  })

  it('getBackgroundDefinition retombe sur le premier fond pour un identifiant inconnu', () => {
    const def = getBackgroundDefinition('inexistant' as never)
    expect(def).toBe(BACKGROUNDS[0])
  })
})
