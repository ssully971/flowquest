import { describe, expect, it } from 'vitest'

import {
  minimapToWorld,
  minimapTransform,
  viewCenteredOn,
  viewportWorldRect,
  worldToMinimap,
} from './minimap'

describe('minimap', () => {
  const bounds = { minX: -200, minY: -100, maxX: 200, maxY: 100 }

  it('cadre le contenu dans la mini-carte, centré', () => {
    const t = minimapTransform(bounds, 156, 100)
    const topLeft = worldToMinimap(t, -200, -100)
    const bottomRight = worldToMinimap(t, 200, 100)
    expect(topLeft.x).toBeGreaterThanOrEqual(0)
    expect(bottomRight.x).toBeLessThanOrEqual(156)
    expect(worldToMinimap(t, 0, 0)).toEqual({ x: 78, y: 50 })
  })

  it('monde → mini-carte → monde revient au point de départ', () => {
    const t = minimapTransform(bounds, 156, 100)
    const p = worldToMinimap(t, 37, -12)
    const back = minimapToWorld(t, p.x, p.y)
    expect(back.x).toBeCloseTo(37)
    expect(back.y).toBeCloseTo(-12)
  })

  it('contenu absent : pas de NaN', () => {
    const t = minimapTransform(null, 156, 100)
    expect(Number.isFinite(t.scale)).toBe(true)
  })

  it('rectangle de la vue en coordonnées du monde, et recentrage sans changer le zoom', () => {
    const view = { x: 100, y: 50, k: 2 }
    expect(viewportWorldRect(view, 800, 600)).toEqual({ x: -50, y: -25, w: 400, h: 300 })
    const centered = viewCenteredOn(view, 10, 20, 800, 600)
    expect(centered.k).toBe(2)
    // Le point (10, 20) est maintenant au centre de l'écran.
    expect(10 * centered.k + centered.x).toBe(400)
    expect(20 * centered.k + centered.y).toBe(300)
  })
})
