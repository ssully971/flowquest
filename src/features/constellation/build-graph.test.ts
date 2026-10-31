import { describe, expect, it } from 'vitest'

import type {
  FocusSessionRecord,
  PillarRecord,
  TaskLinkRecord,
  TaskRecord,
} from '@/shared/storage/db'

import {
  buildGraph,
  MAX_TASK_NODES,
  NO_PILLAR_NODE_ID,
  taskBrightness,
  taskRadius,
} from './build-graph'
import type { ConstellationFilters } from './build-graph'

const NOW = Date.UTC(2026, 5, 15)
const DAY = 86_400_000
const LABELS = { noPillar: 'Sans pilier', group: (n: number) => `+${n}` }
const ALL: ConstellationFilters = { pillar: 'all', period: 'all', showArchived: false }

function task(id: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id,
    title: `Tâche ${id}`,
    emoji: null,
    color: null,
    etaMinutes: null,
    parentId: null,
    position: 0,
    done: false,
    doneAt: null,
    createdAt: NOW - 10 * DAY,
    updatedAt: NOW,
    pillarId: null,
    ...overrides,
  }
}

function pillar(id: string, level = 1, overrides: Partial<PillarRecord> = {}): PillarRecord {
  return {
    id,
    name: `Pilier ${id}`,
    color: '#4A9FE8',
    currentXp: 0,
    level,
    createdAt: 0,
    archivedAt: null,
    goalLevel: null,
    goalDeadline: null,
    ...overrides,
  }
}

function session(
  taskId: string | null,
  seconds: number,
  startedAt = NOW - DAY,
): FocusSessionRecord {
  return {
    id: `s-${taskId}-${startedAt}-${seconds}`,
    kind: 'focus',
    plannedSeconds: seconds,
    actualSeconds: seconds,
    startedAt,
    endedAt: startedAt + seconds * 1000,
    completed: true,
    taskId,
    pillarId: null,
    syncedAt: null,
  }
}

const base = { sessions: [], links: [], pillars: [], now: NOW, labels: LABELS }

describe('buildGraph', () => {
  it('un centre par pilier, une étoile par tâche, rattachée à son pilier', () => {
    const graph = buildGraph({
      ...base,
      pillars: [pillar('p1', 5)],
      tasks: [task('a', { pillarId: 'p1' }), task('b')],
      filters: ALL,
    })
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['__none__', 'a', 'b', 'p:p1'])
    expect(graph.edges.find((e) => e.id === 'pillar:a')?.target).toBe('p:p1')
    expect(graph.edges.find((e) => e.id === 'pillar:b')?.target).toBe(NO_PILLAR_NODE_ID)
    // Le palier du pilier (Apprenti, niveau 5) grossit son étoile.
    const pillarNode = graph.nodes.find((n) => n.id === 'p:p1')!
    expect(pillarNode.tier?.id).toBe('apprenti')
    expect(pillarNode.radius).toBeGreaterThan(14)
  })

  it('la taille et la luminosité reflètent le temps de focus ; terminée = allumée', () => {
    const graph = buildGraph({
      ...base,
      tasks: [task('long'), task('short'), task('done', { done: true, doneAt: NOW - DAY })],
      sessions: [session('long', 7200), session('short', 600)],
      filters: ALL,
    })
    const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))
    expect(byId.long.radius).toBeGreaterThan(byId.short.radius)
    expect(byId.long.brightness).toBeGreaterThan(byId.short.brightness)
    expect(byId.done.brightness).toBe(1)
    expect(byId.done.done).toBe(true)
    expect(graph.stats.totalSeconds).toBe(7800)
  })

  it('le temps des sous-tâches remonte sur le parent', () => {
    const graph = buildGraph({
      ...base,
      tasks: [task('parent'), task('child', { parentId: 'parent' }), task('other')],
      sessions: [session('child', 3600), session('other', 3600)],
      filters: ALL,
    })
    const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]))
    expect(byId.parent.radius).toBeCloseTo(byId.other.radius)
    expect(graph.edges.find((e) => e.id === 'parent:child')?.target).toBe('parent')
  })

  it('masque les archivées sauf demande, et filtre par pilier', () => {
    const tasks = [
      task('a', { pillarId: 'p1' }),
      task('b', { pillarId: 'p2' }),
      task('z', { pillarId: 'p1', archivedAt: NOW }),
    ]
    const pillars = [pillar('p1'), pillar('p2')]
    const hidden = buildGraph({ ...base, tasks, pillars, filters: { ...ALL, pillar: 'p1' } })
    expect(hidden.nodes.map((n) => n.id).sort()).toEqual(['a', 'p:p1'])
    const shown = buildGraph({
      ...base,
      tasks,
      pillars,
      filters: { ...ALL, pillar: 'p1', showArchived: true },
    })
    expect(shown.nodes.map((n) => n.id).sort()).toEqual(['a', 'p:p1', 'z'])
  })

  it('période : seul le temps de la fenêtre compte, une tâche terminée ancienne disparaît', () => {
    const tasks = [
      task('old', { done: true, doneAt: NOW - 200 * DAY, createdAt: NOW - 300 * DAY }),
      task('open', { createdAt: NOW - 300 * DAY }),
    ]
    const graph = buildGraph({
      ...base,
      tasks,
      sessions: [session('open', 1000, NOW - 5 * DAY), session('open', 5000, NOW - 120 * DAY)],
      filters: { ...ALL, period: '30d' },
    })
    expect(graph.nodes.find((n) => n.id === 'old')).toBeUndefined()
    expect(graph.nodes.find((n) => n.id === 'open')?.seconds).toBe(1000)
  })

  it('ne garde que les liens dont les deux extrémités sont affichées', () => {
    const links: TaskLinkRecord[] = [
      { id: 'l1', fromTaskId: 'a', toTaskId: 'b', kind: 'depends_on', createdAt: 0 },
      { id: 'l2', fromTaskId: 'a', toTaskId: 'ghost', kind: 'related', createdAt: 0 },
    ]
    const graph = buildGraph({ ...base, tasks: [task('a'), task('b')], links, filters: ALL })
    expect(graph.edges.filter((e) => e.linkId).map((e) => e.linkId)).toEqual(['l1'])
  })

  it('regroupe les plus anciennes tâches terminées au-delà du plafond, jamais les liées', () => {
    const tasks = Array.from({ length: 30 }, (_, i) =>
      task(`t${String(i).padStart(2, '0')}`, {
        done: true,
        doneAt: NOW - (40 - i) * DAY,
        pillarId: 'p1',
      }),
    )
    const links: TaskLinkRecord[] = [
      { id: 'l', fromTaskId: 't00', toTaskId: 't01', kind: 'related', createdAt: 0 },
    ]
    const graph = buildGraph({
      ...base,
      pillars: [pillar('p1')],
      tasks,
      links,
      filters: ALL,
      maxTaskNodes: 20,
    })
    const taskNodes = graph.nodes.filter((n) => n.kind === 'task')
    const group = graph.nodes.find((n) => n.kind === 'group')!
    expect(group.groupCount).toBe(30 - taskNodes.length)
    expect(taskNodes.length + 1).toBeLessThanOrEqual(21)
    expect(taskNodes.map((n) => n.id)).toEqual(expect.arrayContaining(['t00', 't01']))
    expect(graph.stats.tasksTotal).toBe(30)

    const expanded = buildGraph({
      ...base,
      pillars: [pillar('p1')],
      tasks,
      links,
      filters: ALL,
      maxTaskNodes: 20,
      expandedGroups: new Set(['p1']),
    })
    expect(expanded.nodes.some((n) => n.kind === 'group')).toBe(false)
  })

  it('est déterministe : mêmes entrées, même graphe', () => {
    const input = {
      ...base,
      pillars: [pillar('p1')],
      tasks: [task('b', { pillarId: 'p1' }), task('a')],
      filters: ALL,
    }
    expect(buildGraph(input)).toEqual(buildGraph({ ...input, tasks: [...input.tasks].reverse() }))
  })

  it('aucune tâche : seulement les piliers actifs, jamais d’erreur', () => {
    const graph = buildGraph({ ...base, pillars: [pillar('p1')], tasks: [], filters: ALL })
    expect(graph.nodes.map((n) => n.id)).toEqual(['p:p1'])
    expect(MAX_TASK_NODES).toBe(150)
  })

  it('rayon et luminosité sont bornés', () => {
    expect(taskRadius(0, 0)).toBe(5)
    expect(taskRadius(99999, 100)).toBe(19)
    expect(taskBrightness(false, 0, 0)).toBe(0.25)
    expect(taskBrightness(true, 0, 0)).toBe(1)
  })
})
