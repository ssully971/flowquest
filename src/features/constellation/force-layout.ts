import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force'
import type { Simulation, SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'

import type { Graph, GraphEdge, GraphNode } from './build-graph'

export interface NodePosition {
  x: number
  y: number
  /** Épinglé : déplacé à la main, la simulation ne le bouge plus. */
  pinned?: boolean
}

export type Positions = Record<string, NodePosition>

export interface SimNode extends SimulationNodeDatum {
  id: string
  r: number
  kind: GraphNode['kind']
  pinned: boolean
}

export type SimLink = SimulationLinkDatum<SimNode> & { kind: GraphEdge['kind'] }

/** Plafond de ticks d'un calcul synchrone (150 nœuds : quelques dizaines de ms). */
const MAX_SETTLE_TICKS = 300
const SETTLE_ALPHA_MIN = 0.02

function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** PRNG déterministe amorcé : jamais Math.random() — la même constellation retombe pareil. */
export function seededRandom(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Valeur stable dans [0, 1) propre à (id, sel). */
export function unitFor(id: string, salt: string): number {
  return seededRandom(fnv1a(`${salt}:${id}`))()
}

/**
 * Positions de départ ORGANIQUES : chaque centre de pilier sur un anneau irrégulier (angle et
 * rayon perturbés par l'identifiant), chaque tâche dans un disque irrégulier autour de son
 * pilier. Rien n'est régulier, mais tout est reproductible (mêmes ids = mêmes positions).
 */
export function seedPositions(
  graph: Graph,
  saved: Positions = {},
): Record<string, { x: number; y: number }> {
  const result: Record<string, { x: number; y: number }> = {}
  const pillars = graph.nodes.filter((node) => node.kind === 'pillar')
  const ring = 150 + 70 * Math.sqrt(pillars.length)
  pillars.forEach((node, index) => {
    const known = saved[node.id]
    if (known) {
      result[node.id] = { x: known.x, y: known.y }
      return
    }
    const angle =
      (index / Math.max(1, pillars.length)) * Math.PI * 2 + (unitFor(node.id, 'a') - 0.5) * 0.9
    const radius = ring * (0.75 + unitFor(node.id, 'r') * 0.5)
    result[node.id] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
  })
  const pillarNodeId = (node: GraphNode) =>
    node.pillarId === null ? '__none__' : `p:${node.pillarId}`
  for (const node of graph.nodes) {
    if (node.kind === 'pillar') continue
    const known = saved[node.id]
    if (known) {
      result[node.id] = { x: known.x, y: known.y }
      continue
    }
    const anchor = result[pillarNodeId(node)] ?? { x: 0, y: 0 }
    const angle = unitFor(node.id, 'a') * Math.PI * 2
    const radius = 30 + Math.sqrt(unitFor(node.id, 'r')) * 90
    result[node.id] = {
      x: anchor.x + Math.cos(angle) * radius,
      y: anchor.y + Math.sin(angle) * radius,
    }
  }
  return result
}

export interface LayoutSimulation {
  simulation: Simulation<SimNode, SimLink>
  nodes: SimNode[]
}

/**
 * Simulation de forces (d3-force) à la manière d'Obsidian : répulsion entre nœuds, ressorts le
 * long des liens, attraction de chaque tâche vers son pilier, anti-chevauchement et légère
 * gravité vers le centre. Le minuteur interne est arrêté : l'appelant fait avancer la
 * simulation (`tick`) soit d'un coup (settleLayout), soit image par image pendant un geste.
 */
export function createSimulation(graph: Graph, saved: Positions = {}): LayoutSimulation {
  const seeds = seedPositions(graph, saved)
  const nodes: SimNode[] = graph.nodes.map((node) => ({
    id: node.id,
    r: node.radius,
    kind: node.kind,
    pinned: Boolean(saved[node.id]?.pinned),
    x: seeds[node.id].x,
    y: seeds[node.id].y,
    fx: saved[node.id]?.pinned ? saved[node.id].x : undefined,
    fy: saved[node.id]?.pinned ? saved[node.id].y : undefined,
  }))
  const index = new Map(nodes.map((node) => [node.id, node]))
  const links: SimLink[] = graph.edges
    .filter((edge) => index.has(edge.source) && index.has(edge.target))
    .map((edge) => ({ source: edge.source, target: edge.target, kind: edge.kind }))

  const distanceFor = (link: SimLink) => {
    const a = index.get(
      typeof link.source === 'object' ? (link.source as SimNode).id : String(link.source),
    )
    const b = index.get(
      typeof link.target === 'object' ? (link.target as SimNode).id : String(link.target),
    )
    const radii = (a?.r ?? 0) + (b?.r ?? 0)
    switch (link.kind) {
      case 'pillar':
        return 70 + radii
      case 'parent':
        return 24 + radii
      default:
        return 90 + radii
    }
  }
  const strengthFor = (link: SimLink) => {
    switch (link.kind) {
      case 'pillar':
        return 0.22
      case 'parent':
        return 0.7
      default:
        return 0.12
    }
  }

  const simulation = forceSimulation<SimNode, SimLink>(nodes)
    .randomSource(seededRandom(0x5eed))
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((node) => node.id)
        .distance(distanceFor)
        .strength(strengthFor),
    )
    .force(
      'charge',
      forceManyBody<SimNode>()
        .strength((node) => (node.kind === 'pillar' ? -420 : -(40 + node.r * 5)))
        .distanceMax(420),
    )
    .force(
      'collide',
      forceCollide<SimNode>((node) => node.r + 7)
        .strength(0.9)
        .iterations(2),
    )
    .force('x', forceX<SimNode>(0).strength(0.025))
    .force('y', forceY<SimNode>(0).strength(0.025))
    .alphaDecay(0.045)
    .stop()
  return { simulation, nodes }
}

export function positionsOf(nodes: SimNode[]): Positions {
  const result: Positions = {}
  for (const node of nodes) {
    const position: NodePosition = {
      x: Math.round((node.x ?? 0) * 10) / 10,
      y: Math.round((node.y ?? 0) * 10) / 10,
    }
    if (node.pinned) position.pinned = true
    result[node.id] = position
  }
  return result
}

/**
 * Calcule la disposition d'un coup. Si TOUS les nœuds ont déjà une position enregistrée, rien
 * ne bouge (la constellation reste exactement où l'utilisateur l'a laissée). Sinon les nœuds
 * nouveaux sont intégrés par une simulation douce qui n'écarte pas les anciens.
 */
export function settleLayout(graph: Graph, saved: Positions = {}): Positions {
  const allKnown = graph.nodes.every((node) => saved[node.id])
  if (allKnown) return positionsOf(createSimulation(graph, saved).nodes)

  const { simulation, nodes } = createSimulation(graph, saved)
  const anyKnown = graph.nodes.some((node) => saved[node.id])
  // Les nœuds déjà placés sont figés pendant l'intégration des nouveaux, puis relâchés.
  const frozen = anyKnown ? nodes.filter((node) => saved[node.id] && node.fx === undefined) : []
  for (const node of frozen) {
    node.fx = node.x
    node.fy = node.y
  }
  simulation.alpha(anyKnown ? 0.5 : 1)
  for (let i = 0; i < MAX_SETTLE_TICKS && simulation.alpha() > SETTLE_ALPHA_MIN; i++)
    simulation.tick()
  for (const node of frozen) {
    node.fx = undefined
    node.fy = undefined
  }
  return positionsOf(nodes)
}
