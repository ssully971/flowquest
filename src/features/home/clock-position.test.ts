import { describe, expect, it } from 'vitest'

import {
  clampUnit,
  movePosition,
  positionFromRects,
  positionKeyForWidth,
  sanitizeAmbientPositions,
  stepPosition,
} from './clock-position'

describe('clock-position — position de l’horloge Ambiant en pourcentages', () => {
  it('une position pour l’écran compact (< 640 px) et une pour l’écran large', () => {
    expect(positionKeyForWidth(390)).toBe('compact')
    expect(positionKeyForWidth(639)).toBe('compact')
    expect(positionKeyForWidth(640)).toBe('wide')
    expect(positionKeyForWidth(1440)).toBe('wide')
  })

  it('positionFromRects : part de l’espace libre, bornée à la région (contenue dans l’écran)', () => {
    const region = { left: 0, top: 0, width: 1000, height: 600 }
    expect(positionFromRects(region, { left: 0, top: 0, width: 200, height: 100 })).toEqual({
      x: 0,
      y: 0,
    })
    expect(positionFromRects(region, { left: 800, top: 500, width: 200, height: 100 })).toEqual({
      x: 1,
      y: 1,
    })
    expect(positionFromRects(region, { left: 400, top: 250, width: 200, height: 100 })).toEqual({
      x: 0.5,
      y: 0.5,
    })
    // Une carte qui déborde est ramenée contre le bord.
    expect(positionFromRects(region, { left: 950, top: -40, width: 200, height: 100 })).toEqual({
      x: 1,
      y: 0,
    })
  })

  it('une région plus petite que la carte : centrée, jamais de division par zéro', () => {
    const region = { left: 0, top: 0, width: 100, height: 100 }
    expect(positionFromRects(region, { left: 0, top: 0, width: 300, height: 300 })).toEqual({
      x: 0.5,
      y: 0.5,
    })
  })

  it('movePosition : déplace en pixels, sans jamais sortir de la région', () => {
    expect(movePosition({ x: 0.5, y: 0.5 }, 100, -50, 400, 200)).toEqual({ x: 0.75, y: 0.25 })
    expect(movePosition({ x: 0.9, y: 0.1 }, 1000, -1000, 400, 200)).toEqual({ x: 1, y: 0 })
    expect(movePosition({ x: 0.3, y: 0.3 }, 50, 50, 0, 0)).toEqual({ x: 0.3, y: 0.3 })
  })

  it('stepPosition : flèches au clavier, grand pas avec Maj, rien pour une autre touche', () => {
    const start = { x: 0.5, y: 0.5 }
    expect(stepPosition(start, 'ArrowRight', false)).toEqual({ x: 0.52, y: 0.5 })
    expect(stepPosition(start, 'ArrowLeft', true)?.x).toBeCloseTo(0.4, 5)
    expect(stepPosition(start, 'ArrowDown', false)?.y).toBeCloseTo(0.52, 5)
    expect(stepPosition({ x: 1, y: 0 }, 'ArrowRight', false)).toEqual({ x: 1, y: 0 })
    expect(stepPosition({ x: 0, y: 0 }, 'ArrowUp', true)).toEqual({ x: 0, y: 0 })
    expect(stepPosition(start, 'a', false)).toBeNull()
  })

  it('sanitizeAmbientPositions : écarte toute valeur invalide et borne le reste', () => {
    expect(sanitizeAmbientPositions(undefined)).toEqual({ compact: null, wide: null })
    expect(sanitizeAmbientPositions('x')).toEqual({ compact: null, wide: null })
    expect(
      sanitizeAmbientPositions({ compact: { x: 2, y: -1 }, wide: { x: 'a', y: 0.3 } }),
    ).toEqual({ compact: { x: 1, y: 0 }, wide: null })
    expect(clampUnit(Number.NaN)).toBe(0)
  })
})
