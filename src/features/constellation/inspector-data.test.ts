import { describe, expect, it } from 'vitest'

import type {
  FocusSessionRecord,
  PillarRecord,
  TaskLinkRecord,
  TaskRecord,
} from '@/shared/storage/db'

import { linkRows, pillarSummary, taskFocusStats, unlockState, weeklyFocus } from './inspector-data'

const NOW = new Date(2026, 9, 28, 12).getTime() // mercredi 28 octobre 2026
const DAY = 86_400_000

function task(id: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id,
    title: `T-${id}`,
    emoji: null,
    color: null,
    etaMinutes: null,
    parentId: null,
    position: 0,
    done: false,
    doneAt: null,
    createdAt: NOW - 100 * DAY,
    updatedAt: NOW,
    pillarId: null,
    ...overrides,
  }
}

function session(taskId: string, seconds: number, startedAt: number): FocusSessionRecord {
  return {
    id: `${taskId}-${startedAt}`,
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

const pillar = (id: string, name: string): PillarRecord => ({
  id,
  name,
  color: '#4A9FE8',
  currentXp: 0,
  level: 1,
  createdAt: 0,
  archivedAt: null,
  goalLevel: null,
  goalDeadline: null,
})

describe('taskFocusStats', () => {
  it('somme le focus et compte les sessions, sous-tâches incluses, sur la période', () => {
    const tasks = [task('a'), task('b', { parentId: 'a' }), task('c')]
    const sessions = [
      session('a', 1800, NOW - DAY),
      session('b', 900, NOW - 2 * DAY),
      session('c', 5000, NOW - DAY),
      session('a', 3600, NOW - 50 * DAY), // hors « 30 j »
    ]
    expect(taskFocusStats('a', tasks, sessions, '30d', NOW)).toEqual({
      focusSeconds: 2700,
      sessions: 2,
    })
    expect(taskFocusStats('a', tasks, sessions, 'all', NOW)).toEqual({
      focusSeconds: 6300,
      sessions: 3,
    })
  })
})

describe('weeklyFocus', () => {
  it('regroupe par semaine (lundi), semaines vides à 0, de la plus ancienne à la plus récente', () => {
    const tasks = [task('a')]
    const sessions = [session('a', 3600, NOW - DAY), session('a', 1800, NOW - 15 * DAY)]
    const weeks = weeklyFocus('a', tasks, sessions, '30d', NOW)
    expect(weeks.length).toBeGreaterThanOrEqual(5)
    expect(weeks.every((w) => new Date(w.weekStart).getDay() === 1)).toBe(true)
    expect(weeks.at(-1)!.seconds).toBe(3600)
    expect(weeks.reduce((sum, w) => sum + w.seconds, 0)).toBe(5400)
    expect(weeks.some((w) => w.seconds === 0)).toBe(true)
    expect([...weeks].sort((a, b) => a.weekStart - b.weekStart)).toEqual(weeks)
  })

  it('plafonne « Tout » à 26 semaines', () => {
    const sessions = [session('a', 600, NOW - 400 * DAY)]
    expect(weeklyFocus('a', [task('a')], sessions, 'all', NOW)).toHaveLength(26)
  })

  it('sans session : une seule semaine vide en « Tout », pas d’erreur', () => {
    const weeks = weeklyFocus('a', [task('a')], [], 'all', NOW)
    expect(weeks).toHaveLength(1)
    expect(weeks[0].seconds).toBe(0)
  })
})

describe('linkRows', () => {
  const tasks = [
    task('a', { pillarId: 'p1' }),
    task('b', { pillarId: 'p1', done: true }),
    task('c', { pillarId: 'p2' }),
    task('d'),
  ]
  const pillars = [pillar('p1', 'Études'), pillar('p2', 'Sport')]
  const links: TaskLinkRecord[] = [
    { id: 'l1', fromTaskId: 'a', toTaskId: 'b', kind: 'depends_on', createdAt: 0 },
    { id: 'l2', fromTaskId: 'd', toTaskId: 'a', kind: 'depends_on', createdAt: 0 },
    { id: 'l3', fromTaskId: 'a', toTaskId: 'c', kind: 'related', createdAt: 0 },
    { id: 'l4', fromTaskId: 'x', toTaskId: 'y', kind: 'related', createdAt: 0 },
  ]

  it('une ligne par lien : « Dépend de », « Débloque », « Liée à », dans cet ordre', () => {
    const rows = linkRows('a', links, tasks, pillars)
    expect(rows.map((r) => [r.kind, r.otherTaskId])).toEqual([
      ['dependsOn', 'b'],
      ['unlocks', 'd'],
      ['related', 'c'],
    ])
    expect(rows[0].otherDone).toBe(true)
  })

  it('indique le pilier de l’autre tâche seulement s’il diffère', () => {
    const rows = linkRows('a', links, tasks, pillars)
    expect(rows.find((r) => r.otherTaskId === 'b')!.otherPillar).toBeNull()
    expect(rows.find((r) => r.otherTaskId === 'c')!.otherPillar).toEqual({
      name: 'Sport',
      color: '#4A9FE8',
    })
  })

  it('ignore les liens des autres tâches ou vers une tâche inconnue', () => {
    expect(linkRows('zzz', links, tasks, pillars)).toEqual([])
  })
})

describe('unlockState', () => {
  const tasks = [task('a'), task('b', { done: true }), task('c'), task('d', { done: true })]
  const dep = (from: string, to: string): TaskLinkRecord => ({
    id: `${from}${to}`,
    fromTaskId: from,
    toTaskId: to,
    kind: 'depends_on',
    createdAt: 0,
  })

  it('débloquée quand toutes ses dépendances sont terminées', () => {
    expect(unlockState(tasks[0], [dep('a', 'b')], tasks)).toEqual({
      kind: 'unlocked',
      doneTitles: ['T-b'],
    })
  })

  it('bloquée tant qu’une dépendance n’est pas terminée, avec la liste', () => {
    expect(unlockState(tasks[0], [dep('a', 'b'), dep('a', 'c')], tasks)).toEqual({
      kind: 'blocked',
      blockingTitles: ['T-c'],
    })
  })

  it('aucun encart sans dépendance, ni pour une tâche déjà terminée, ni pour un lien « lié à »', () => {
    expect(unlockState(tasks[0], [], tasks)).toEqual({ kind: 'none' })
    expect(unlockState(tasks[1], [dep('b', 'd')], tasks)).toEqual({ kind: 'none' })
    expect(
      unlockState(
        tasks[0],
        [{ id: 'r', fromTaskId: 'a', toTaskId: 'b', kind: 'related', createdAt: 0 }],
        tasks,
      ),
    ).toEqual({ kind: 'none' })
  })
})

describe('pillarSummary', () => {
  it('compte les tâches terminées / total (hors archivées) et le focus de la période', () => {
    const tasks = [
      task('a', { pillarId: 'p1', done: true }),
      task('b', { pillarId: 'p1' }),
      task('c', { pillarId: 'p1', archivedAt: 1 }),
      task('d', { pillarId: 'p2' }),
    ]
    const sessions = [
      session('a', 600, NOW - DAY),
      session('b', 300, NOW - DAY),
      session('d', 999, NOW - DAY),
    ]
    expect(pillarSummary('p1', tasks, sessions, '30d', NOW)).toEqual({
      tasksDone: 1,
      tasksTotal: 2,
      seconds: 900,
    })
    expect(pillarSummary(null, tasks, sessions, 'all', NOW)).toEqual({
      tasksDone: 0,
      tasksTotal: 0,
      seconds: 0,
    })
  })
})
