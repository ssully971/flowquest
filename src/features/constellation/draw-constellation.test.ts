import { describe, expect, it } from 'vitest'

import {
  DIM_OPACITY,
  displayRadius,
  drawConstellation,
  LABEL_ZOOM,
  readPalette,
} from './draw-constellation'
import type { DrawEdge, DrawNode, DrawOptions } from './draw-constellation'

interface Call {
  op: string
  alpha: number
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  args: unknown[]
}

/** Contexte 2D factice qui enregistre chaque opération avec l'état courant. */
function recorder() {
  const calls: Call[] = []
  const state = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1 }
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop as keyof typeof target]
      return (...args: unknown[]) => {
        calls.push({
          op: prop,
          alpha: target.globalAlpha,
          fillStyle: String(target.fillStyle),
          strokeStyle: String(target.strokeStyle),
          lineWidth: target.lineWidth,
          args,
        })
      }
    },
    set(target, prop: string, value) {
      ;(target as Record<string, unknown>)[prop] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

const palette = {
  background: '#0e0c14',
  edge: '#3a3647',
  edgeUser: '#8a8499',
  label: '#8a8499',
  labelStrong: '#eeeaf4',
  highlight: '#c9a7ff',
  font: 'sans-serif',
}

const node = (overrides: Partial<DrawNode>): DrawNode => ({
  id: 'n',
  x: 0,
  y: 0,
  r: 10,
  kind: 'task',
  label: 'Tâche',
  color: '#4A9FE8',
  brightness: 1,
  done: true,
  archived: false,
  ...overrides,
})

const edge = (overrides: Partial<DrawEdge>): DrawEdge => ({
  id: 'e',
  kind: 'related',
  from: { x: 0, y: 0, r: 8 },
  to: { x: 50, y: 0, r: 8 },
  ...overrides,
})

function render(overrides: Partial<DrawOptions>) {
  const { ctx, calls } = recorder()
  drawConstellation(ctx, {
    width: 400,
    height: 300,
    dpr: 1,
    view: { x: 0, y: 0, k: 1 },
    nodes: [],
    edges: [],
    palette,
    ...overrides,
  })
  return calls
}

describe('drawConstellation — graphe sobre', () => {
  it('aucune lueur : jamais de dégradé radial, sur aucun type de nœud', () => {
    const calls = render({
      nodes: [
        node({ id: 'p', kind: 'pillar', r: 20 }),
        node({ id: 'a', done: true }),
        node({ id: 'b', done: false }),
        node({ id: 'g', kind: 'group', groupCount: 5 }),
      ],
    })
    expect(
      calls.some(
        (call) => call.op === 'createRadialGradient' || call.op === 'createLinearGradient',
      ),
    ).toBe(false)
    expect(calls.some((call) => call.op === 'shadowBlur')).toBe(false)
  })

  it('une tâche terminée est un disque plein cerclé d’un liseré de 2 px couleur du fond', () => {
    const calls = render({ nodes: [node({ done: true })] })
    const fill = calls.find((call) => call.op === 'fill')!
    expect(fill.fillStyle).toBe('#4A9FE8')
    const rim = calls.filter((call) => call.op === 'stroke').at(-1)!
    expect(rim.strokeStyle).toBe(palette.background)
    expect(rim.lineWidth).toBe(2)
  })

  it('une tâche à faire est un disque couleur du fond, contour 1,5 px couleur du pilier', () => {
    const calls = render({ nodes: [node({ done: false, brightness: 0.9 })] })
    expect(calls.find((call) => call.op === 'fill')!.fillStyle).toBe(palette.background)
    const outline = calls.find((call) => call.op === 'stroke')!
    expect(outline.strokeStyle).toBe('#4A9FE8')
    expect(outline.lineWidth).toBe(1.5)
  })

  it('un pilier est un disque plein avec un anneau fin à 35 %, sans étoile à branches', () => {
    const calls = render({ nodes: [node({ id: 'p', kind: 'pillar', r: 14 })] })
    const ring = calls.find((call) => call.op === 'stroke')!
    expect(ring.strokeStyle).toBe('#4A9FE859') // 35 % de 255 = 89 = 0x59
    const arcs = calls.filter((call) => call.op === 'arc')
    expect(arcs[0].args[2]).toBe(11 + 5) // anneau : rayon + 5
    expect(arcs[1].args[2]).toBe(11) // disque
    // Pas d'étoile à branches : aucun tracé polygonal.
    expect(calls.some((call) => call.op === 'lineTo' || call.op === 'closePath')).toBe(false)
  })

  it('les rayons dessinés sont plafonnés : tâche à 9, pilier à 11 × 1,4 au plus', () => {
    expect(displayRadius({ kind: 'task', r: 19 })).toBe(9)
    expect(displayRadius({ kind: 'task', r: 5 })).toBe(5)
    expect(displayRadius({ kind: 'pillar', r: 14 })).toBe(11)
    expect(displayRadius({ kind: 'pillar', r: 14 * 2.2 })).toBeCloseTo(11 * 1.4)
  })

  it('une tâche archivée est à 45 % d’opacité', () => {
    const calls = render({ nodes: [node({ archived: true })] })
    expect(calls.find((call) => call.op === 'fill')!.alpha).toBe(0.45)
  })

  it('estompe à 28 % tout ce qui est hors du voisinage actif, garde le voisinage net', () => {
    const calls = render({
      nodes: [node({ id: 'a' }), node({ id: 'b', x: 50 }), node({ id: 'far', x: 300 })],
      edges: [edge({ id: 'e1' }), edge({ id: 'e2', to: { x: 300, y: 0, r: 8 } })],
      highlight: { activeId: 'a', nodeIds: new Set(['a', 'b']), edgeIds: new Set(['e1']) },
    })
    const fills = calls.filter((call) => call.op === 'fill')
    expect(fills[0].alpha).toBe(1) // a
    expect(fills[1].alpha).toBe(1) // b
    expect(fills[2].alpha).toBe(DIM_OPACITY) // far
    const strokes = calls.filter((call) => call.op === 'stroke' && call.lineWidth > 1)
    expect(strokes[0].alpha).toBe(1) // e1 (voisinage)
    expect(strokes[1].alpha).toBe(DIM_OPACITY) // e2 (hors voisinage)
  })

  it('les liens du voisinage passent à la couleur de surbrillance, flèche comprise', () => {
    const calls = render({
      nodes: [node({ id: 'a' }), node({ id: 'b', x: 50 })],
      edges: [edge({ id: 'e1', kind: 'depends_on' })],
      highlight: { activeId: 'a', nodeIds: new Set(['a', 'b']), edgeIds: new Set(['e1']) },
    })
    const link = calls.find((call) => call.op === 'stroke')!
    expect(link.strokeStyle).toBe(palette.highlight)
    expect(link.lineWidth).toBe(1.5)
    const arrow = calls.find((call) => call.op === 'closePath')!
    expect(arrow.fillStyle).toBe(palette.highlight)
  })

  it('liens : pilier→tâche 1 px discret, dépendance 1,3 px avec flèche, « lié à » en pointillés', () => {
    const pillar = render({ edges: [edge({ id: 'p', kind: 'pillar' })] }).find(
      (c) => c.op === 'stroke',
    )!
    expect(pillar.strokeStyle).toBe(palette.edge)
    expect(pillar.lineWidth).toBe(1)

    const dep = render({ edges: [edge({ id: 'd', kind: 'depends_on' })] })
    expect(dep.find((c) => c.op === 'stroke')!.lineWidth).toBe(1.3)
    expect(dep.some((c) => c.op === 'closePath')).toBe(true) // flèche

    const related = render({ edges: [edge({ id: 'r', kind: 'related' })] })
    expect(
      related.find((c) => c.op === 'setLineDash' && (c.args[0] as number[]).length > 0)?.args[0],
    ).toEqual([4, 4])
  })

  it('étiquettes en mode auto : piliers toujours, tâches seulement au zoom ou dans le voisinage', () => {
    const nodes = [
      node({ id: 'p', kind: 'pillar', label: 'Études' }),
      node({ id: 't', label: 'Anatomie' }),
    ]
    const labelsAt = (k: number, extra: Partial<DrawOptions> = {}) =>
      render({ nodes, view: { x: 0, y: 0, k }, ...extra })
        .filter((call) => call.op === 'fillText')
        .map((call) => call.args[0])

    expect(labelsAt(1)).toEqual(['Études'])
    expect(labelsAt(LABEL_ZOOM)).toEqual(['Études', 'Anatomie'])
    expect(
      labelsAt(1, { highlight: { activeId: 't', nodeIds: new Set(['t']), edgeIds: new Set() } }),
    ).toContain('Anatomie')
    expect(labelsAt(1, { labels: 'always' })).toEqual(['Études', 'Anatomie'])
    expect(labelsAt(2, { labels: 'never' })).toEqual([])
  })

  it('le nœud actif a un anneau de la couleur forte à rayon + 5', () => {
    const calls = render({
      nodes: [node({ id: 'a', r: 7 })],
      highlight: { activeId: 'a', nodeIds: new Set(['a']), edgeIds: new Set() },
    })
    const ring = calls.filter((c) => c.op === 'stroke').at(-1)!
    expect(ring.strokeStyle).toBe(palette.labelStrong)
    expect(ring.lineWidth).toBe(1.5)
    expect(calls.filter((c) => c.op === 'arc').at(-1)!.args[2]).toBe(7 + 5)
  })
})

describe('readPalette', () => {
  it('lit les jetons --cst-* et retombe sur des valeurs de secours', () => {
    expect(readPalette().background).toBe('#0e0c14')
    document.documentElement.style.setProperty('--cst-bg', '#f4effc')
    expect(readPalette().background).toBe('#f4effc')
    document.documentElement.style.removeProperty('--cst-bg')
  })
})
