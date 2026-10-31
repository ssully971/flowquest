import { PILLAR_COLORS } from '@/features/pillars/pillar-colors'
import { getDb } from '@/shared/storage/db'
import type { PillarRecord, TaskRecord } from '@/shared/storage/db'

import { buildGraph } from './build-graph'
import type { Graph } from './build-graph'
import { settleLayout } from './force-layout'
import type { Positions } from './force-layout'
import { unitFor } from './force-layout'

export interface ConstellationSnapshot {
  graph: Graph
  positions: Positions
  /** Constellation décorative (aucune tâche à montrer), pas celle de l'utilisateur. */
  decorative: boolean
}

const LABELS = { noPillar: '', group: (count: number) => `+${count}` }

/**
 * Constellation décorative et douce pour un compte sans tâche : trois centres, une trentaine
 * d'étoiles dont quelques-unes « allumées », quelques liens. Entièrement déterministe (ids
 * fixes), donc identique à chaque chargement ; jamais enregistrée ni synchronisée.
 */
function decorativeData(): { tasks: TaskRecord[]; pillars: PillarRecord[] } {
  const pillars: PillarRecord[] = [0, 1, 2].map((index) => ({
    id: `deco-p${index}`,
    name: '',
    color: PILLAR_COLORS[(index * 3 + 1) % PILLAR_COLORS.length],
    currentXp: 0,
    level: [8, 5, 3][index],
    createdAt: 0,
    archivedAt: null,
    goalLevel: null,
    goalDeadline: null,
  }))
  const tasks: TaskRecord[] = Array.from({ length: 30 }, (_, index) => {
    const id = `deco-t${String(index).padStart(2, '0')}`
    return {
      id,
      title: '',
      emoji: null,
      color: null,
      etaMinutes: null,
      parentId: null,
      position: index,
      done: unitFor(id, 'done') > 0.55,
      doneAt: 1,
      createdAt: 1,
      updatedAt: 1,
      pillarId: pillars[index % 3].id,
    }
  })
  return { tasks, pillars }
}

let decorativeCache: ConstellationSnapshot | null = null

export function decorativeSnapshot(): ConstellationSnapshot {
  if (decorativeCache) return decorativeCache
  const { tasks, pillars } = decorativeData()
  const graph = buildGraph({
    tasks,
    pillars,
    sessions: [],
    links: [
      { id: 'd1', fromTaskId: 'deco-t00', toTaskId: 'deco-t04', kind: 'related', createdAt: 0 },
      { id: 'd2', fromTaskId: 'deco-t01', toTaskId: 'deco-t08', kind: 'depends_on', createdAt: 0 },
      { id: 'd3', fromTaskId: 'deco-t05', toTaskId: 'deco-t14', kind: 'related', createdAt: 0 },
    ],
    filters: { pillar: 'all', period: 'all', showArchived: false },
    now: 2,
    labels: LABELS,
  })
  decorativeCache = { graph, positions: settleLayout(graph), decorative: true }
  return decorativeCache
}

/**
 * Lit tout en local et prépare la constellation en lecture seule (fond d'écran) : positions
 * enregistrées si elles existent, sinon calcul unique et déterministe — jamais de simulation en
 * continu. Sans tâche à montrer : constellation décorative.
 */
export async function loadConstellationSnapshot(
  now: number = Date.now(),
): Promise<ConstellationSnapshot> {
  const db = await getDb()
  const [tasks, pillars, sessions, links, layout] = await Promise.all([
    db.getAll('tasks'),
    db.getAll('pillars'),
    db.getAll('focusSessions'),
    db.getAll('taskLinks'),
    db.get('constellationLayout', 'current'),
  ])
  const graph = buildGraph({
    tasks,
    pillars,
    sessions,
    links,
    filters: { pillar: 'all', period: 'all', showArchived: false },
    now,
    labels: LABELS,
  })
  if (!graph.nodes.some((node) => node.kind === 'task' || node.kind === 'group')) {
    return decorativeSnapshot()
  }
  return { graph, positions: settleLayout(graph, layout?.positions ?? {}), decorative: false }
}
