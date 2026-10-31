import type { Graph } from './build-graph'

export interface DisplayFilterOptions {
  /** Ids de piliers masqués (puces de la barre) ; `__none__` pour « sans pilier ». */
  hiddenPillars: ReadonlySet<string>
  /** Faux : seules les tâches terminées (et les piliers) restent. */
  showTodo: boolean
}

const NONE = '__none__'

/**
 * Affichage seulement : masque des piliers (avec leurs tâches) et/ou les tâches à faire, sans
 * recalculer le graphe ni sa disposition (les positions des nœuds masqués sont conservées).
 * Les liens dont une extrémité disparaît disparaissent aussi. Fonction pure.
 */
export function applyDisplayFilters(graph: Graph, options: DisplayFilterOptions): Graph {
  const { hiddenPillars, showTodo } = options
  if (hiddenPillars.size === 0 && showTodo) return graph

  const nodes = graph.nodes.filter((node) => {
    const key = node.pillarId ?? NONE
    if (hiddenPillars.has(key)) return false
    if (node.kind === 'task' && !showTodo && !node.done) return false
    return true
  })
  const ids = new Set(nodes.map((node) => node.id))
  const edges = graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
  return { ...graph, nodes, edges }
}
