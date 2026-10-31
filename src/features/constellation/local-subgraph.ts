import type { Graph } from './build-graph'

export type LocalDepth = 1 | 2 | 3

export interface LocalSubgraph {
  graph: Graph
  /** Profondeur de chaque nœud conservé par rapport au centre (0 = le centre). */
  depthById: Map<string, number>
  centerId: string
}

export interface LocalSubgraphOptions {
  /** Inclure les nœuds piliers (et traverser par eux) ; le centre reste toujours. */
  includePillars: boolean
  /** Masquer les liens implicites pilier → tâche (ne garder que parent et liens créés). */
  linksOnly?: boolean
}

/**
 * Sous-graphe local autour d'un nœud : le centre et ses voisins jusqu'à `depth` (parcours en
 * largeur, liens non orientés). `includePillars` : les piliers font partie du voisinage (et
 * relient donc les tâches d'un même pilier) ; sinon ils sont exclus et jamais traversés.
 * `linksOnly` ne retire que l'affichage des liens pilier → tâche. Fonction pure ; renvoie `null`
 * si le centre n'est pas dans le graphe.
 */
export function localSubgraph(
  graph: Graph,
  centerId: string,
  depth: LocalDepth,
  options: LocalSubgraphOptions,
): LocalSubgraph | null {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  if (!nodesById.has(centerId)) return null

  const allowed = (id: string) =>
    id === centerId || options.includePillars || nodesById.get(id)?.kind !== 'pillar'

  const adjacency = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (!allowed(edge.source) || !allowed(edge.target)) continue
    ;(adjacency.get(edge.source) ?? adjacency.set(edge.source, []).get(edge.source)!).push(
      edge.target,
    )
    ;(adjacency.get(edge.target) ?? adjacency.set(edge.target, []).get(edge.target)!).push(
      edge.source,
    )
  }

  const depthById = new Map<string, number>([[centerId, 0]])
  let frontier = [centerId]
  for (let level = 1; level <= depth; level++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const neighbour of adjacency.get(id) ?? []) {
        if (depthById.has(neighbour)) continue
        depthById.set(neighbour, level)
        next.push(neighbour)
      }
    }
    frontier = next
  }

  const nodes = graph.nodes.filter((node) => depthById.has(node.id))
  const edges = graph.edges.filter(
    (edge) =>
      depthById.has(edge.source) &&
      depthById.has(edge.target) &&
      !(options.linksOnly && edge.kind === 'pillar'),
  )
  return { graph: { ...graph, nodes, edges }, depthById, centerId }
}

/** Opacité d'un nœud selon sa profondeur : le centre et le premier cercle nets, la suite à 45 %. */
export function depthOpacity(depth: number): number {
  return depth <= 1 ? 1 : 0.45
}
