import { tierForLevel } from '@/features/pillars/pillar-tiers'
import type { PillarTier } from '@/features/pillars/pillar-tiers'
import type {
  FocusSessionRecord,
  PillarRecord,
  TaskLinkRecord,
  TaskRecord,
} from '@/shared/storage/db'

export const NO_PILLAR_NODE_ID = '__none__'
/** Au-delà, les plus anciennes tâches terminées sont regroupées (un nœud « +N » par pilier). */
export const MAX_TASK_NODES = 150

export type ConstellationPeriod = '30d' | '90d' | 'all'

export interface ConstellationFilters {
  /** `all`, `none` (sans pilier) ou l'id d'un pilier. */
  pillar: string
  period: ConstellationPeriod
  showArchived: boolean
}

export interface GraphNode {
  id: string
  kind: 'pillar' | 'task' | 'group'
  label: string
  /** Pilier d'appartenance (`null` = sans pilier). Pour un nœud pilier, son propre id. */
  pillarId: string | null
  color: string
  /** Rayon de base en unités du monde (avant zoom). */
  radius: number
  /** Luminosité de 0 à 1 : une tâche terminée est « allumée » (1). */
  brightness: number
  done: boolean
  archived: boolean
  /** Temps de focus sur ce nœud (secondes, sur la période filtrée). */
  seconds: number
  /** Pilier : palier d'apparence (taille d'étoile, halo, branches). */
  tier?: PillarTier
  level?: number
  /** Groupe : nombre de tâches regroupées. */
  groupCount?: number
  /** Tâche : tâche parente (sous-tâche). */
  parentId?: string | null
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  kind: 'pillar' | 'parent' | 'depends_on' | 'related'
  /** Id du lien utilisateur (pour le supprimer) ; absent pour les liens implicites. */
  linkId?: string
}

export interface GraphStats {
  tasksDone: number
  tasksTotal: number
  totalSeconds: number
  /** Temps de focus par pilier (clé = id du pilier ou NO_PILLAR_NODE_ID). */
  secondsByPillar: Record<string, number>
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: GraphStats
}

export interface BuildGraphInput {
  tasks: TaskRecord[]
  pillars: PillarRecord[]
  sessions: FocusSessionRecord[]
  links: TaskLinkRecord[]
  filters: ConstellationFilters
  now: number
  /** Piliers dont le groupe « +N » a été déplié par l'utilisateur. */
  expandedGroups?: ReadonlySet<string>
  maxTaskNodes?: number
  /** Libellé du centre « sans pilier » et d'un groupe, injectés pour rester hors de fr.ts ici. */
  labels: { noPillar: string; group: (count: number) => string }
}

const DAY_MS = 86_400_000
const NO_PILLAR_COLOR = '#8A93A6'

function periodStart(period: ConstellationPeriod, now: number): number | null {
  if (period === 'all') return null
  return now - (period === '30d' ? 30 : 90) * DAY_MS
}

function pillarKey(pillarId: string | null | undefined): string {
  return pillarId ?? NO_PILLAR_NODE_ID
}

/** Rayon d'une tâche : 5 à 19, croissant avec la racine du temps passé (la perception de
 * surface est proportionnelle à r², donc la racine garde l'échelle lisible). */
export function taskRadius(seconds: number, maxSeconds: number): number {
  if (maxSeconds <= 0 || seconds <= 0) return 5
  return 5 + 14 * Math.sqrt(Math.min(1, seconds / maxSeconds))
}

/** Luminosité d'une tâche : terminée = allumée ; sinon une lueur qui croît avec le temps passé. */
export function taskBrightness(done: boolean, seconds: number, maxSeconds: number): number {
  if (done) return 1
  if (maxSeconds <= 0) return 0.25
  return 0.25 + 0.4 * Math.min(1, seconds / maxSeconds)
}

/**
 * Construit le graphe de la constellation à partir des tâches, piliers, sessions et liens
 * (fonction pure). Nœuds : un centre par pilier (plus un centre « sans pilier » s'il le faut) et
 * une étoile par tâche ; la taille et la luminosité d'une tâche reflètent son temps de focus,
 * un nœud est « allumé » quand la tâche est terminée. Les tâches archivées sont masquées sauf
 * demande. Au-delà de `maxTaskNodes`, les plus anciennes tâches terminées (hors tâches liées)
 * sont regroupées par pilier.
 */
export function buildGraph(input: BuildGraphInput): Graph {
  const { tasks, pillars, sessions, links, filters, now, labels } = input
  const maxTaskNodes = input.maxTaskNodes ?? MAX_TASK_NODES
  const expanded = input.expandedGroups ?? new Set<string>()
  const start = periodStart(filters.period, now)

  // Temps de focus par tâche, sur la période.
  const secondsByTask = new Map<string, number>()
  const activeInWindow = new Set<string>()
  for (const session of sessions) {
    if (session.kind !== 'focus' || !session.taskId) continue
    if (start !== null && session.startedAt < start) continue
    secondsByTask.set(
      session.taskId,
      (secondsByTask.get(session.taskId) ?? 0) + session.actualSeconds,
    )
    activeInWindow.add(session.taskId)
  }

  const inWindow = (timestamp: number | null | undefined) =>
    timestamp !== null && timestamp !== undefined && (start === null || timestamp >= start)

  // Tâches visibles : archivage, pilier, période (une tâche à faire reste toujours visible).
  const visible = tasks.filter((task) => {
    if (task.archivedAt && !filters.showArchived) return false
    if (filters.pillar === 'none' && task.pillarId) return false
    if (filters.pillar !== 'all' && filters.pillar !== 'none' && task.pillarId !== filters.pillar) {
      return false
    }
    if (!task.done || start === null) return true
    return inWindow(task.doneAt) || inWindow(task.createdAt) || activeInWindow.has(task.id)
  })
  const visibleIds = new Set(visible.map((task) => task.id))
  // Une sous-tâche dont le parent est masqué est masquée avec lui.
  const roots = visible.filter((task) => !task.parentId || !visibleIds.has(task.parentId))
  const childrenOf = new Map<string, TaskRecord[]>()
  for (const task of visible) {
    if (task.parentId && visibleIds.has(task.parentId)) {
      const list = childrenOf.get(task.parentId) ?? []
      list.push(task)
      childrenOf.set(task.parentId, list)
    }
  }

  const linkedTaskIds = new Set<string>()
  for (const link of links) {
    linkedTaskIds.add(link.fromTaskId)
    linkedTaskIds.add(link.toTaskId)
  }

  // Regroupement au-delà du plafond : les plus anciennes racines terminées, non liées.
  const collapsed = new Map<string, { count: number; seconds: number }>()
  const collapsedRoots = new Set<string>()
  let nodeCount = visible.length
  if (nodeCount > maxTaskNodes) {
    const candidates = roots
      .filter(
        (task) =>
          task.done &&
          !expanded.has(pillarKey(task.pillarId)) &&
          !linkedTaskIds.has(task.id) &&
          !(childrenOf.get(task.id) ?? []).some((child) => linkedTaskIds.has(child.id)),
      )
      .sort(
        (a, b) => (a.doneAt ?? a.createdAt) - (b.doneAt ?? b.createdAt) || a.id.localeCompare(b.id),
      )
    for (const task of candidates) {
      if (nodeCount <= maxTaskNodes) break
      const members = [task, ...(childrenOf.get(task.id) ?? [])]
      const key = pillarKey(task.pillarId)
      const isNewGroup = !collapsed.has(key)
      const group = collapsed.get(key) ?? { count: 0, seconds: 0 }
      group.count += members.length
      group.seconds += members.reduce((sum, member) => sum + (secondsByTask.get(member.id) ?? 0), 0)
      collapsed.set(key, group)
      collapsedRoots.add(task.id)
      nodeCount -= members.length
      if (isNewGroup) nodeCount += 1
    }
  }
  const hiddenByGroup = new Set<string>()
  for (const id of collapsedRoots) {
    hiddenByGroup.add(id)
    for (const child of childrenOf.get(id) ?? []) hiddenByGroup.add(child.id)
  }
  const shownTasks = visible.filter((task) => !hiddenByGroup.has(task.id))

  const rollup = (task: TaskRecord): number =>
    (secondsByTask.get(task.id) ?? 0) +
    (childrenOf.get(task.id) ?? []).reduce(
      (sum, child) => sum + (secondsByTask.get(child.id) ?? 0),
      0,
    )
  const maxSeconds = Math.max(
    0,
    ...shownTasks.map((task) => rollup(task)),
    ...Array.from(collapsed.values()).map((group) => group.seconds),
  )

  // Piliers : actifs, plus les archivés qui ont encore des tâches visibles.
  const pillarById = new Map(pillars.map((pillar) => [pillar.id, pillar]))
  const usedPillarKeys = new Set<string>([
    ...shownTasks.map((task) => pillarKey(task.pillarId)),
    ...collapsed.keys(),
  ])
  const nodes: GraphNode[] = []
  const secondsByPillar: Record<string, number> = {}
  for (const task of visible) {
    const key = pillarKey(task.pillarId)
    secondsByPillar[key] = (secondsByPillar[key] ?? 0) + (secondsByTask.get(task.id) ?? 0)
  }

  const pillarNodeFor = (key: string): GraphNode | null => {
    if (key === NO_PILLAR_NODE_ID) {
      return {
        id: NO_PILLAR_NODE_ID,
        kind: 'pillar',
        label: labels.noPillar,
        pillarId: null,
        color: NO_PILLAR_COLOR,
        radius: 14,
        brightness: 0.6,
        done: false,
        archived: false,
        seconds: secondsByPillar[key] ?? 0,
      }
    }
    const pillar = pillarById.get(key)
    if (!pillar) return null
    const tier = tierForLevel(pillar.level)
    return {
      id: `p:${pillar.id}`,
      kind: 'pillar',
      label: pillar.name,
      pillarId: pillar.id,
      color: pillar.color,
      radius: 14 * tier.star.scale,
      brightness: 0.7 + 0.3 * tier.star.halo,
      done: false,
      archived: pillar.archivedAt !== null,
      seconds: secondsByPillar[key] ?? 0,
      tier,
      level: pillar.level,
    }
  }
  const pillarNodeId = (key: string) => (key === NO_PILLAR_NODE_ID ? NO_PILLAR_NODE_ID : `p:${key}`)

  for (const pillar of pillars) {
    // Piliers actifs toujours présents (hors filtre sur un autre pilier) ; archivés si utilisés.
    const key = pillar.id
    if (filters.pillar !== 'all' && filters.pillar !== key) continue
    if (filters.pillar === 'none') continue
    if (pillar.archivedAt && !usedPillarKeys.has(key)) continue
    const node = pillarNodeFor(key)
    if (node) nodes.push(node)
  }
  if (
    usedPillarKeys.has(NO_PILLAR_NODE_ID) &&
    (filters.pillar === 'all' || filters.pillar === 'none')
  ) {
    const node = pillarNodeFor(NO_PILLAR_NODE_ID)
    if (node) nodes.push(node)
  }
  const knownPillarNodes = new Set(nodes.map((node) => node.id))

  for (const task of shownTasks) {
    const seconds = secondsByTask.get(task.id) ?? 0
    const total = rollup(task)
    const pillar = task.pillarId ? pillarById.get(task.pillarId) : undefined
    nodes.push({
      id: task.id,
      kind: 'task',
      label: task.title,
      pillarId: task.pillarId ?? null,
      color: pillar?.color ?? task.color ?? NO_PILLAR_COLOR,
      radius: taskRadius(total, maxSeconds),
      brightness: taskBrightness(task.done, total, maxSeconds),
      done: task.done,
      archived: Boolean(task.archivedAt),
      seconds,
      parentId: task.parentId && visibleIds.has(task.parentId) ? task.parentId : null,
    })
  }
  for (const [key, group] of collapsed) {
    const pillar = key === NO_PILLAR_NODE_ID ? undefined : pillarById.get(key)
    nodes.push({
      id: `g:${key}`,
      kind: 'group',
      label: labels.group(group.count),
      pillarId: key === NO_PILLAR_NODE_ID ? null : key,
      color: pillar?.color ?? NO_PILLAR_COLOR,
      radius: 9 + Math.min(8, Math.sqrt(group.count)),
      brightness: 0.8,
      done: true,
      archived: false,
      seconds: group.seconds,
      groupCount: group.count,
    })
  }

  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges: GraphEdge[] = []
  for (const node of nodes) {
    if (node.kind === 'task') {
      if (node.parentId && nodeIds.has(node.parentId)) {
        edges.push({
          id: `parent:${node.id}`,
          source: node.id,
          target: node.parentId,
          kind: 'parent',
        })
      } else {
        const target = pillarNodeId(pillarKey(node.pillarId))
        if (knownPillarNodes.has(target)) {
          edges.push({ id: `pillar:${node.id}`, source: node.id, target, kind: 'pillar' })
        }
      }
    } else if (node.kind === 'group') {
      const target = pillarNodeId(pillarKey(node.pillarId))
      if (knownPillarNodes.has(target)) {
        edges.push({ id: `pillar:${node.id}`, source: node.id, target, kind: 'pillar' })
      }
    }
  }
  for (const link of links) {
    if (!nodeIds.has(link.fromTaskId) || !nodeIds.has(link.toTaskId)) continue
    edges.push({
      id: `link:${link.id}`,
      source: link.fromTaskId,
      target: link.toTaskId,
      kind: link.kind,
      linkId: link.id,
    })
  }

  nodes.sort((a, b) => a.id.localeCompare(b.id))
  edges.sort((a, b) => a.id.localeCompare(b.id))

  const tasksTotal =
    shownTasks.length + Array.from(collapsed.values()).reduce((sum, g) => sum + g.count, 0)
  const tasksDone =
    shownTasks.filter((task) => task.done).length +
    Array.from(collapsed.values()).reduce((sum, g) => sum + g.count, 0)
  return {
    nodes,
    edges,
    stats: {
      tasksDone,
      tasksTotal,
      totalSeconds: Object.values(secondsByPillar).reduce((sum, value) => sum + value, 0),
      secondsByPillar,
    },
  }
}
