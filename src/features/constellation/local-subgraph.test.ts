import { describe, expect, it } from 'vitest'

import type { Graph, GraphEdge, GraphNode } from './build-graph'
import { depthOpacity, localSubgraph } from './local-subgraph'

const node = (id: string, kind: GraphNode['kind'] = 'task'): GraphNode => ({
  id,
  kind,
  label: id,
  pillarId: null,
  color: '#fff',
  radius: 8,
  brightness: 1,
  done: false,
  archived: false,
  seconds: 0,
})
const edge = (source: string, target: string, kind: GraphEdge['kind']): GraphEdge => ({
  id: `${kind}:${source}>${target}`,
  source,
  target,
  kind,
})

// pilier P ─ a, b, c ; a —dépend→ b ; b ~ x (autre pilier) ; x ─ Q ; y isolé ; z ─ x ─ w (chaîne)
const graph: Graph = {
  nodes: [
    node('P', 'pillar'),
    node('Q', 'pillar'),
    ...['a', 'b', 'c', 'x', 'y', 'z', 'w'].map((id) => node(id)),
  ],
  edges: [
    edge('a', 'P', 'pillar'),
    edge('b', 'P', 'pillar'),
    edge('c', 'P', 'pillar'),
    edge('x', 'Q', 'pillar'),
    edge('a', 'b', 'depends_on'),
    edge('b', 'x', 'related'),
    edge('z', 'x', 'related'),
    edge('w', 'z', 'related'),
  ],
  stats: { tasksDone: 0, tasksTotal: 7, totalSeconds: 0, secondsByPillar: {} },
}
const ids = (result: ReturnType<typeof localSubgraph>) =>
  result!.graph.nodes.map((n) => n.id).sort()

describe('localSubgraph', () => {
  it('profondeur 1 : le centre et ses voisins directs', () => {
    const result = localSubgraph(graph, 'b', 1, { includePillars: true })
    expect(ids(result)).toEqual(['P', 'a', 'b', 'x'])
    expect(result!.depthById.get('b')).toBe(0)
    expect(result!.depthById.get('a')).toBe(1)
  })

  it('profondeur 2 traverse le pilier : on retrouve les autres tâches du pilier', () => {
    const result = localSubgraph(graph, 'b', 2, { includePillars: true })
    expect(ids(result)).toEqual(['P', 'Q', 'a', 'b', 'c', 'x', 'z'])
    expect(result!.depthById.get('c')).toBe(2)
    expect(depthOpacity(result!.depthById.get('c')!)).toBe(0.45)
  })

  it('profondeur 3 va plus loin, jamais au-delà', () => {
    const result = localSubgraph(graph, 'b', 3, { includePillars: true })
    expect(ids(result)).toContain('w')
    expect(ids(result)).not.toContain('y')
  })

  it('sans piliers : ils sont exclus et jamais traversés (c n’est plus atteint)', () => {
    const result = localSubgraph(graph, 'b', 3, { includePillars: false })
    expect(ids(result)).toEqual(['a', 'b', 'w', 'x', 'z'])
    expect(result!.graph.edges.some((e) => e.kind === 'pillar')).toBe(false)
  })

  it('un pilier au centre reste inclus même sans « inclure les piliers »', () => {
    const result = localSubgraph(graph, 'P', 1, { includePillars: false })
    expect(ids(result)).toEqual(['P', 'a', 'b', 'c'])
  })

  it('« liens seulement » masque les liens pilier → tâche sans retirer de nœud', () => {
    const result = localSubgraph(graph, 'b', 1, { includePillars: true, linksOnly: true })
    expect(ids(result)).toEqual(['P', 'a', 'b', 'x'])
    expect(result!.graph.edges.map((e) => e.kind).sort()).toEqual(['depends_on', 'related'])
  })

  it('ne garde que les liens dont les deux extrémités sont conservées', () => {
    const result = localSubgraph(graph, 'b', 1, { includePillars: true })
    expect(result!.graph.edges.some((e) => e.source === 'z' || e.target === 'z')).toBe(false)
  })

  it('un nœud isolé n’a que lui-même ; un centre inconnu donne null', () => {
    expect(ids(localSubgraph(graph, 'y', 3, { includePillars: true }))).toEqual(['y'])
    expect(localSubgraph(graph, 'nope', 2, { includePillars: true })).toBeNull()
  })

  it('ne modifie pas le graphe d’origine', () => {
    localSubgraph(graph, 'b', 1, { includePillars: false, linksOnly: true })
    expect(graph.nodes).toHaveLength(9)
    expect(graph.edges).toHaveLength(8)
  })

  it('opacité : centre et profondeur 1 nets, profondeurs 2 et 3 à 45 %', () => {
    expect([0, 1, 2, 3].map(depthOpacity)).toEqual([1, 1, 0.45, 0.45])
  })
})
