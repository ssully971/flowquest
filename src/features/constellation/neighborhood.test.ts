import { describe, expect, it } from 'vitest'

import type { GraphEdge } from './build-graph'
import { neighborhood } from './neighborhood'

const edge = (id: string, source: string, target: string): GraphEdge => ({
  id,
  source,
  target,
  kind: 'related',
})

describe('neighborhood', () => {
  const edges = [
    edge('e1', 'a', 'b'),
    edge('e2', 'a', 'c'),
    edge('e3', 'b', 'c'), // entre deux voisins de a
    edge('e4', 'c', 'd'), // d est à distance 2
    edge('e5', 'x', 'y'),
  ]

  it('contient le nœud, ses voisins directs et les liens entre eux', () => {
    const result = neighborhood({ edges }, 'a')
    expect([...result.nodeIds].sort()).toEqual(['a', 'b', 'c'])
    expect([...result.edgeIds].sort()).toEqual(['e1', 'e2', 'e3', 'e4'].filter((id) => id !== 'e4'))
  })

  it('inclut les liens du nœud vers l’extérieur du voisinage', () => {
    const result = neighborhood({ edges }, 'c')
    expect([...result.nodeIds].sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(result.edgeIds.has('e4')).toBe(true)
    expect(result.edgeIds.has('e5')).toBe(false)
  })

  it('un nœud isolé n’a que lui-même', () => {
    const result = neighborhood({ edges }, 'z')
    expect([...result.nodeIds]).toEqual(['z'])
    expect(result.edgeIds.size).toBe(0)
  })

  it('ne dépend pas du sens des liens', () => {
    expect(neighborhood({ edges: [edge('e', 'b', 'a')] }, 'a').nodeIds.has('b')).toBe(true)
  })
})
