import { describe, expect, it } from 'vitest'

import { normalizeBackgroundModeSelection } from './background-selection'

describe('normalizeBackgroundModeSelection — photos personnelles (bibliothèque)', () => {
  const FALLBACK = { dark: 'photo-aurore', light: 'photo-lueur', linked: false } as const

  it('accepte une photo de la bibliothèque (custom:<id>) pour chaque mode et thème', () => {
    expect(
      normalizeBackgroundModeSelection(
        { dark: 'custom:abc', light: 'custom:def', linked: false },
        FALLBACK,
      ),
    ).toEqual({ dark: 'custom:abc', light: 'custom:def', linked: false })
  })

  it('convertit l’ancien fond unique « custom » en photo « custom:legacy » (migration douce)', () => {
    expect(normalizeBackgroundModeSelection('custom', FALLBACK)).toEqual({
      dark: 'custom:legacy',
      light: 'custom:legacy',
      linked: true,
    })
    expect(
      normalizeBackgroundModeSelection(
        { dark: 'custom', light: 'photo-lueur', linked: false },
        FALLBACK,
      ),
    ).toEqual({ dark: 'custom:legacy', light: 'photo-lueur', linked: false })
  })

  it('refuse toujours un identifiant inconnu ou « custom: » vide', () => {
    expect(normalizeBackgroundModeSelection('inconnu', FALLBACK)).toEqual(FALLBACK)
    expect(
      normalizeBackgroundModeSelection({ dark: 'custom:', light: 'zzz', linked: true }, FALLBACK),
    ).toEqual({
      dark: 'photo-aurore',
      light: 'photo-lueur',
      linked: true,
    })
  })
})
