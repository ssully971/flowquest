import { describe, expect, it } from 'vitest'

import type { Graph, GraphNode } from './build-graph'
import { applyDisplayFilters } from './display-filters'

const node = (
  id: string,
  kind: GraphNode['kind'],
  pillarId: string | null,
  done = true,
): GraphNode => ({
  id,
  kind,
  label: id,
  pillarId,
  color: '#fff',
  radius: 8,
  brightness: 1,
  done,
  archived: false,
  seconds: 0,
})

const graph: Graph = {
  nodes: [
    node('p:a', 'pillar', 'a'),
    node('p:b', 'pillar', 'b'),
    node('t1', 'task', 'a', true),
    node('t2', 'task', 'a', false),
    node('t3', 'task', 'b', true),
    node('t4', 'task', null, true),
  ],
  edges: [
    { id: 'pillar:t1', source: 't1', target: 'p:a', kind: 'pillar' },
    { id: 'pillar:t2', source: 't2', target: 'p:a', kind: 'pillar' },
    { id: 'pillar:t3', source: 't3', target: 'p:b', kind: 'pillar' },
    { id: 'link:l', source: 't1', target: 't3', kind: 'related', linkId: 'l' },
  ],
  stats: { tasksDone: 3, tasksTotal: 4, totalSeconds: 0, secondsByPillar: {} },
}

describe('applyDisplayFilters', () => {
  it('sans filtre : le même graphe', () => {
    expect(applyDisplayFilters(graph, { hiddenPillars: new Set(), showTodo: true })).toBe(graph)
  })

  it('masque un pilier avec ses tâches et les liens qui les touchent', () => {
    const result = applyDisplayFilters(graph, { hiddenPillars: new Set(['a']), showTodo: true })
    expect(result.nodes.map((n) => n.id).sort()).toEqual(['p:b', 't3', 't4'])
    expect(result.edges.map((e) => e.id)).toEqual(['pillar:t3'])
  })

  it('masque les tâches « sans pilier » via __none__', () => {
    const result = applyDisplayFilters(graph, {
      hiddenPillars: new Set(['__none__']),
      showTodo: true,
    })
    expect(result.nodes.some((n) => n.id === 't4')).toBe(false)
  })

  it('masque les tâches à faire mais garde les piliers et les terminées', () => {
    const result = applyDisplayFilters(graph, { hiddenPillars: new Set(), showTodo: false })
    expect(result.nodes.map((n) => n.id).sort()).toEqual(['p:a', 'p:b', 't1', 't3', 't4'])
    expect(result.edges.some((e) => e.id === 'pillar:t2')).toBe(false)
  })

  it('ne modifie pas le graphe d’origine', () => {
    applyDisplayFilters(graph, { hiddenPillars: new Set(['a']), showTodo: false })
    expect(graph.nodes).toHaveLength(6)
  })
})
