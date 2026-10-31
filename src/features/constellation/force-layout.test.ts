import { describe, expect, it } from 'vitest'

import { buildGraph } from './build-graph'
import type { Graph } from './build-graph'
import { createSimulation, positionsOf, seedPositions, settleLayout } from './force-layout'
import type { Positions } from './force-layout'

function makeGraph(taskCount: number, pillarCount = 3): Graph {
  const pillars = Array.from({ length: pillarCount }, (_, i) => ({
    id: `p${i}`,
    name: `Pilier ${i}`,
    color: '#4A9FE8',
    currentXp: 0,
    level: 1 + i * 4,
    createdAt: 0,
    archivedAt: null,
    goalLevel: null,
    goalDeadline: null,
  }))
  const tasks = Array.from({ length: taskCount }, (_, i) => ({
    id: `task-${String(i).padStart(3, '0')}`,
    title: `Tâche ${i}`,
    emoji: null,
    color: null,
    etaMinutes: null,
    parentId: null,
    position: i,
    done: i % 3 === 0,
    doneAt: i % 3 === 0 ? 1_000_000 : null,
    createdAt: 0,
    updatedAt: 0,
    pillarId: `p${i % pillarCount}`,
  }))
  return buildGraph({
    tasks,
    pillars,
    sessions: [],
    links: [
      { id: 'l1', fromTaskId: 'task-001', toTaskId: 'task-004', kind: 'depends_on', createdAt: 0 },
      { id: 'l2', fromTaskId: 'task-002', toTaskId: 'task-008', kind: 'related', createdAt: 0 },
    ],
    filters: { pillar: 'all', period: 'all', showArchived: false },
    now: 2_000_000,
    labels: { noPillar: 'Sans pilier', group: (n) => `+${n}` },
  })
}

describe('force-layout', () => {
  it('est déterministe : mêmes entrées, mêmes positions', () => {
    const graph = makeGraph(40)
    expect(settleLayout(graph)).toEqual(settleLayout(graph))
  })

  it('place chaque nœud, sans NaN, et pas de grand chevauchement', () => {
    const graph = makeGraph(80)
    const positions = settleLayout(graph)
    const nodes = createSimulation(graph, positions).nodes
    expect(Object.keys(positions)).toHaveLength(graph.nodes.length)
    for (const node of nodes) {
      expect(Number.isFinite(node.x)).toBe(true)
      expect(Number.isFinite(node.y)).toBe(true)
    }
    let overlaps = 0
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = (nodes[i].x ?? 0) - (nodes[j].x ?? 0)
        const dy = (nodes[i].y ?? 0) - (nodes[j].y ?? 0)
        if (Math.hypot(dx, dy) < (nodes[i].r + nodes[j].r) * 0.6) overlaps += 1
      }
    }
    expect(overlaps).toBe(0)
  })

  it('n’est pas un motif parfait : les distances au pilier varient', () => {
    const graph = makeGraph(60, 1)
    const positions = settleLayout(graph)
    const center = positions['p:p0']
    const distances = graph.nodes
      .filter((node) => node.kind === 'task')
      .map((node) => Math.hypot(positions[node.id].x - center.x, positions[node.id].y - center.y))
    const mean = distances.reduce((a, b) => a + b, 0) / distances.length
    const spread = Math.sqrt(distances.reduce((a, b) => a + (b - mean) ** 2, 0) / distances.length)
    expect(spread / mean).toBeGreaterThan(0.12) // anneau parfait ≈ 0
  })

  it('une graine différente par nœud : positions de départ distinctes mais reproductibles', () => {
    const graph = makeGraph(20)
    const a = seedPositions(graph)
    const b = seedPositions(graph)
    expect(a).toEqual(b)
    const xs = new Set(Object.values(a).map((p) => Math.round(p.x)))
    expect(xs.size).toBeGreaterThan(15)
  })

  it('ne bouge pas une constellation entièrement enregistrée', () => {
    const graph = makeGraph(30)
    const first = settleLayout(graph)
    expect(settleLayout(graph, first)).toEqual(first)
  })

  it('intègre un nouveau nœud sans déplacer les nœuds déjà placés', () => {
    const graph = makeGraph(30)
    const saved = settleLayout(graph)
    const bigger = makeGraph(31)
    const next = settleLayout(bigger, saved)
    for (const node of graph.nodes) {
      expect(next[node.id].x).toBeCloseTo(saved[node.id].x, 1)
      expect(next[node.id].y).toBeCloseTo(saved[node.id].y, 1)
    }
    expect(next['task-030']).toBeDefined()
  })

  it('respecte un nœud épinglé', () => {
    const graph = makeGraph(20)
    const saved: Positions = { 'task-005': { x: 500, y: -500, pinned: true } }
    const positions = settleLayout(graph, saved)
    expect(positions['task-005']).toEqual({ x: 500, y: -500, pinned: true })
  })

  it('positionsOf arrondit à 0,1', () => {
    const { nodes } = createSimulation(makeGraph(3))
    nodes[0].x = 1.2345
    nodes[0].y = -9.8765
    expect(positionsOf(nodes)[nodes[0].id]).toEqual({ x: 1.2, y: -9.9 })
  })

  it('performance : 150 nœuds se stabilisent en moins d’une seconde', () => {
    const graph = makeGraph(150, 5)
    const start = performance.now()
    settleLayout(graph)
    expect(performance.now() - start).toBeLessThan(1000)
  })
})
