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

describe('backgrounds registry — fonds photo du lot 3', () => {
  it('ajoute 14 fonds photo (dégradés sombres/clairs, paysages, abstrait)', () => {
    const photoBackgrounds = BACKGROUNDS.filter((bg) => bg.id.startsWith('photo-'))
    expect(photoBackgrounds.length).toBe(14)
  })

  it('chaque fond photo fournit une vignette légère distincte du rendu plein écran', () => {
    const photoBackgrounds = BACKGROUNDS.filter((bg) => bg.id.startsWith('photo-'))
    for (const bg of photoBackgrounds) {
      expect(bg.Thumbnail).toBeDefined()
      expect(bg.Thumbnail).not.toBe(bg.Component)
    }
  })

  it('les libellés des fonds photo ne reprennent pas ceux des fonds en CSS déjà existants (évite la confusion)', () => {
    const cssLabels = new Set(
      BACKGROUNDS.filter((bg) => !bg.id.startsWith('photo-')).map((bg) => bg.label),
    )
    const photoLabels = BACKGROUNDS.filter((bg) => bg.id.startsWith('photo-')).map(
      (bg) => bg.label,
    )
    for (const label of photoLabels) {
      expect(cssLabels.has(label)).toBe(false)
    }
  })
})
