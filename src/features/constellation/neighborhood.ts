import type { GraphEdge } from './build-graph'

export interface Neighborhood {
  /** Le nœud actif et ses voisins directs. */
  nodeIds: Set<string>
  /** Liens touchant le nœud actif, plus ceux qui relient deux voisins entre eux. */
  edgeIds: Set<string>
}

/**
 * Voisinage d'un nœud (survol, sélection) : lui-même, ses voisins directs (profondeur 1) et les
 * liens entre eux. Tout le reste est estompé par le rendu. Fonction pure.
 */
export function neighborhood(graph: { edges: GraphEdge[] }, id: string): Neighborhood {
  const nodeIds = new Set<string>([id])
  for (const edge of graph.edges) {
    if (edge.source === id) nodeIds.add(edge.target)
    else if (edge.target === id) nodeIds.add(edge.source)
  }
  const edgeIds = new Set<string>()
  for (const edge of graph.edges) {
    const touchesActive = edge.source === id || edge.target === id
    if (touchesActive || (nodeIds.has(edge.source) && nodeIds.has(edge.target)))
      edgeIds.add(edge.id)
  }
  return { nodeIds, edgeIds }
}
