import { describe, expect, it } from 'vitest'

import {
  boundsOf,
  clampZoom,
  distanceToSegment,
  fitView,
  hitTestNode,
  MAX_ZOOM,
  MIN_ZOOM,
  screenToWorld,
  zoomAt,
} from './view-transform'

describe('view-transform', () => {
  it('le zoom garde fixe le point sous le curseur', () => {
    const view = { x: 40, y: -20, k: 1 }
    const before = screenToWorld(view, 300, 200)
    const zoomed = zoomAt(view, 300, 200, 1.5)
    const after = screenToWorld(zoomed, 300, 200)
    expect(zoomed.k).toBeCloseTo(1.5)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('borne le zoom', () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM)
    expect(clampZoom(0)).toBe(MIN_ZOOM)
    expect(zoomAt({ x: 0, y: 0, k: MAX_ZOOM }, 0, 0, 2).k).toBe(MAX_ZOOM)
  })

  it('cadre le contenu au centre de la zone visible', () => {
    const bounds = boundsOf([
      { x: -100, y: -50, r: 10 },
      { x: 300, y: 150, r: 10 },
    ])
    const view = fitView(bounds, 800, 600)
    const center = screenToWorld(view, 400, 300)
    expect(center.x).toBeCloseTo(100)
    expect(center.y).toBeCloseTo(50)
    // Tout le contenu tient à l'écran.
    const topLeft = { x: -110 * view.k + view.x, y: -60 * view.k + view.y }
    expect(topLeft.x).toBeGreaterThanOrEqual(0)
    expect(topLeft.y).toBeGreaterThanOrEqual(0)
  })

  it('un contenu vide ou minuscule ne donne ni NaN ni zoom démesuré', () => {
    expect(fitView(null, 800, 600)).toEqual({ x: 400, y: 300, k: 1 })
    expect(fitView(boundsOf([{ x: 0, y: 0, r: 1 }]), 800, 600).k).toBeLessThanOrEqual(1.6)
  })

  it('trouve le nœud le plus proche sous le pointeur, avec tolérance', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0, r: 10 },
      { id: 'b', x: 12, y: 0, r: 10 },
    ]
    expect(hitTestNode(nodes, 1, 0, 1)).toBe('a')
    expect(hitTestNode(nodes, 11, 0, 1)).toBe('b')
    expect(hitTestNode(nodes, 100, 100, 1)).toBeNull()
    expect(hitTestNode(nodes, 0, 14, 1)).toBe('a') // 10 + 6 de tolérance
  })

  it('distance point–segment', () => {
    expect(distanceToSegment(5, 3, 0, 0, 10, 0)).toBe(3)
    expect(distanceToSegment(-4, 3, 0, 0, 10, 0)).toBe(5) // au-delà de l'extrémité
    expect(distanceToSegment(1, 1, 2, 2, 2, 2)).toBeCloseTo(Math.SQRT2)
  })
})
