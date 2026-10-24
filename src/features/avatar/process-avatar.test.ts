import { describe, expect, it } from 'vitest'

import { clampPan, computeCropRect } from './process-avatar'

describe('computeCropRect — géométrie du cadrage (LOT F1)', () => {
  it('image carrée, zoom 1, sans déplacement : prend l’image entière', () => {
    const rect = computeCropRect({
      naturalWidth: 256,
      naturalHeight: 256,
      viewportSize: 256,
      zoom: 1,
      panX: 0,
      panY: 0,
    })
    expect(rect.sx).toBeCloseTo(0)
    expect(rect.sy).toBeCloseTo(0)
    expect(rect.sw).toBeCloseTo(256)
    expect(rect.sh).toBeCloseTo(256)
  })

  it('image large (paysage), zoom 1 : recadre le carré central (comme object-fit: cover)', () => {
    const rect = computeCropRect({
      naturalWidth: 400,
      naturalHeight: 200,
      viewportSize: 256,
      zoom: 1,
      panX: 0,
      panY: 0,
    })
    expect(rect.sy).toBeCloseTo(0)
    expect(rect.sh).toBeCloseTo(200)
    expect(rect.sw).toBeCloseTo(200)
    expect(rect.sx).toBeCloseTo(100) // (400 - 200) / 2
  })

  it('image haute (portrait), zoom 1 : recadre le carré central horizontalement centré', () => {
    const rect = computeCropRect({
      naturalWidth: 200,
      naturalHeight: 400,
      viewportSize: 256,
      zoom: 1,
      panX: 0,
      panY: 0,
    })
    expect(rect.sx).toBeCloseTo(0)
    expect(rect.sw).toBeCloseTo(200)
    expect(rect.sh).toBeCloseTo(200)
    expect(rect.sy).toBeCloseTo(100)
  })

  it('zoom 2 sur une image carrée : la zone source se réduit de moitié, centrée', () => {
    const rect = computeCropRect({
      naturalWidth: 256,
      naturalHeight: 256,
      viewportSize: 256,
      zoom: 2,
      panX: 0,
      panY: 0,
    })
    expect(rect.sw).toBeCloseTo(128)
    expect(rect.sh).toBeCloseTo(128)
    expect(rect.sx).toBeCloseTo(64)
    expect(rect.sy).toBeCloseTo(64)
  })

  it('un déplacement positif (panX/panY) déplace la zone source dans le sens opposé', () => {
    const rect = computeCropRect({
      naturalWidth: 256,
      naturalHeight: 256,
      viewportSize: 256,
      zoom: 2,
      panX: 20,
      panY: -10,
    })
    // panX positif = l'image affichée se déplace vers la droite => la zone qu'on
    // extrait du haut-gauche de l'image source se déplace vers la gauche.
    expect(rect.sx).toBeLessThan(64)
    expect(rect.sy).toBeGreaterThan(64)
  })
})

describe('clampPan — jamais de vide visible dans le cadre carré (LOT F1)', () => {
  it('zoom 1 sur une image carrée (aucun débordement) : le déplacement est toujours ramené à 0', () => {
    const clamped = clampPan({
      naturalWidth: 256,
      naturalHeight: 256,
      viewportSize: 256,
      zoom: 1,
      panX: 50,
      panY: -50,
    })
    expect(clamped.panX).toBeCloseTo(0)
    expect(clamped.panY).toBeCloseTo(0)
  })

  it('zoom 2 sur une image carrée : borne le déplacement à la moitié du débordement', () => {
    const clamped = clampPan({
      naturalWidth: 256,
      naturalHeight: 256,
      viewportSize: 256,
      zoom: 2,
      panX: 1000,
      panY: -1000,
    })
    // débordement = 512 - 256 = 256, borne = 128
    expect(clamped).toEqual({ panX: 128, panY: -128 })
  })

  it('une valeur déjà dans les bornes reste inchangée', () => {
    const clamped = clampPan({
      naturalWidth: 256,
      naturalHeight: 256,
      viewportSize: 256,
      zoom: 2,
      panX: 30,
      panY: -40,
    })
    expect(clamped).toEqual({ panX: 30, panY: -40 })
  })
})
