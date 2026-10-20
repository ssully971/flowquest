import { describe, expect, it } from 'vitest'

import { contrastRatio, isLowContrast } from './clock-color-contrast'

describe('clock-color-contrast — ratio WCAG et avertissement (LOT B10)', () => {
  it('calcule un contraste maximal (21:1) entre blanc et noir', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0)
  })

  it('calcule un contraste minimal (1:1) entre deux couleurs identiques', () => {
    expect(contrastRatio('#5A1FD1', '#5A1FD1')).toBeCloseTo(1, 5)
  })

  it('est symétrique (ordre des couleurs sans effet)', () => {
    expect(contrastRatio('#F2555A', '#1C1330')).toBeCloseTo(contrastRatio('#1C1330', '#F2555A'), 5)
  })

  it('signale un faible contraste contre un fond clair proche de la couleur', () => {
    // Jaune pâle sur la teinte --surface claire : contraste réellement faible.
    expect(isLowContrast('#E8C547', 'light')).toBe(true)
  })

  it('ne signale pas de faible contraste contre un fond sombre bien distinct', () => {
    expect(isLowContrast('#E8C547', 'dark')).toBe(false)
  })
})
