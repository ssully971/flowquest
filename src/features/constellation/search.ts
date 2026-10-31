import type { GraphNode } from './build-graph'

export const MAX_SEARCH_RESULTS = 8

export interface SearchResult {
  id: string
  label: string
  pillarId: string | null
  color: string
  done: boolean
}

/** Minuscules sans accents ni diacritiques : « Étudier » se trouve en tapant « etud ». */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Rang d'une correspondance : 0 = commence par la requête, 1 = un mot commence par elle,
 * 2 = la contient, `null` = aucune. */
function rank(label: string, query: string): number | null {
  if (label.startsWith(query)) return 0
  if (label.split(/[\s'’\-–—/]+/).some((word) => word.startsWith(query))) return 1
  return label.includes(query) ? 2 : null
}

export interface SearchOutcome {
  /** Les meilleures correspondances (8 au plus), pour la liste de résultats. */
  results: SearchResult[]
  /** TOUTES les tâches qui correspondent : elles restent pleines, le reste est estompé. */
  matchIds: Set<string>
}

/**
 * Recherche par nom parmi les tâches du graphe affiché (les piliers et les groupes « +N » ne se
 * cherchent pas). Insensible à la casse et aux accents ; classées : début du nom, début d'un mot,
 * puis contient, à égalité par ordre alphabétique. Requête vide : rien. Fonction pure.
 */
export function searchTasks(nodes: GraphNode[], rawQuery: string): SearchOutcome {
  const query = normalizeForSearch(rawQuery)
  if (!query) return { results: [], matchIds: new Set() }
  const matches: { node: GraphNode; rank: number; label: string }[] = []
  for (const node of nodes) {
    if (node.kind !== 'task') continue
    const label = normalizeForSearch(node.label)
    const found = rank(label, query)
    if (found !== null) matches.push({ node, rank: found, label })
  }
  matches.sort(
    (a, b) =>
      a.rank - b.rank || a.label.localeCompare(b.label) || a.node.id.localeCompare(b.node.id),
  )
  return {
    results: matches.slice(0, MAX_SEARCH_RESULTS).map(({ node }) => ({
      id: node.id,
      label: node.label,
      pillarId: node.pillarId,
      color: node.color,
      done: node.done,
    })),
    matchIds: new Set(matches.map(({ node }) => node.id)),
  }
}
