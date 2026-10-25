import { describe, expect, it } from 'vitest'

import { createArmAngleResolver, spiralStarPosition } from './galaxy-layout'

describe('createArmAngleResolver — un bras par pilier, régulièrement répartis (lot 4, §3)', () => {
  it('répartit les bras régulièrement sur 360°', () => {
    const angleFor = createArmAngleResolver(['p1', 'p2', 'p3'])
    const a1 = angleFor('p1')
    const a2 = angleFor('p2')
    const a3 = angleFor('p3')
    const grey = angleFor(null)
    const angles = [a1, a2, a3, grey].sort((a, b) => a - b)
    // 4 bras (3 piliers + 1 gris) espacés de 2π/4 = π/2.
    expect(angles[1] - angles[0]).toBeCloseTo(Math.PI / 2, 5)
    expect(angles[2] - angles[1]).toBeCloseTo(Math.PI / 2, 5)
    expect(angles[3] - angles[2]).toBeCloseTo(Math.PI / 2, 5)
  })

  it('le bras gris est toujours distinct des bras de piliers', () => {
    const angleFor = createArmAngleResolver(['p1', 'p2'])
    expect(angleFor(null)).not.toBeCloseTo(angleFor('p1'), 5)
    expect(angleFor(null)).not.toBeCloseTo(angleFor('p2'), 5)
  })

  it('un pilier inconnu (supprimé) retombe sur le bras gris', () => {
    const angleFor = createArmAngleResolver(['p1'])
    expect(angleFor('gone')).toBe(angleFor(null))
  })

  it('l’angle d’un pilier ne dépend pas du sous-ensemble filtré, seulement de son rang dans la liste complète', () => {
    const allPillars = ['p1', 'p2', 'p3']
    const angleFor = createArmAngleResolver(allPillars)
    // Même si la vue affiche seulement un sous-ensemble (filtre actif), la liste complète
    // passée au résolveur reste la même : p2 garde toujours le même angle.
    expect(angleFor('p2')).toBe(createArmAngleResolver(allPillars)('p2'))
  })
})

describe('spiralStarPosition — rayon croissant, aspect naturel (lot 4, §3)', () => {
  it('le rayon croît avec l’index le long du bras (ordre chronologique)', () => {
    const angle = 0
    const distances = [0, 1, 2, 3, 4].map((index) => {
      const { x, y } = spiralStarPosition(angle, index, `k${index}`)
      return Math.hypot(x - 0.5, y - 0.5)
    })
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThan(distances[i - 1])
    }
  })

  it('le rayon reste borné dans [0, 0.5) même pour un index très grand', () => {
    const { x, y } = spiralStarPosition(0, 10_000, 'far')
    const distance = Math.hypot(x - 0.5, y - 0.5)
    expect(distance).toBeLessThan(0.5)
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x).toBeLessThan(1)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y).toBeLessThan(1)
  })

  it('est parfaitement déterministe : mêmes paramètres → même position, à chaque appel', () => {
    const a = spiralStarPosition(1.2, 7, 'session-abc')
    const b = spiralStarPosition(1.2, 7, 'session-abc')
    expect(a).toEqual(b)
  })

  it('un léger décalage déterministe distingue deux étoiles au même index logique (clés différentes)', () => {
    const a = spiralStarPosition(0, 3, 'session-a')
    const b = spiralStarPosition(0, 3, 'session-b')
    expect(a).not.toEqual(b)
    // Mais le décalage reste « léger » : les deux restent proches du même rayon/angle de
    // base plutôt que de se retrouver n'importe où.
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    expect(distance).toBeLessThan(0.05)
  })

  it('deux étoiles consécutives sur le même bras restent toujours à une distance minimale (pas de chevauchement)', () => {
    const angle = 0.4
    for (let index = 0; index < 50; index++) {
      const current = spiralStarPosition(angle, index, `seq-${index}`)
      const next = spiralStarPosition(angle, index + 1, `seq-${index + 1}`)
      const distance = Math.hypot(next.x - current.x, next.y - current.y)
      // Garantie documentée dans galaxy-layout.ts : pas radial moins le pire cas de
      // décalage opposé des deux étoiles ≈ 0.04, plus que le diamètre de deux étoiles au
      // rayon maximal (7.5px chacune) dans un conteneur ~400px (15/400 ≈ 0.0375).
      expect(distance).toBeGreaterThan(0.0375)
    }
  })
})
