import { describe, expect, it } from 'vitest'

import type { FocusSessionRecord, TaskRecord } from '@/shared/storage/db'

import { computeCycleSummary } from './cycle-summary'

function session(overrides: Partial<FocusSessionRecord> & { startedAt: number }): FocusSessionRecord {
  return {
    id: crypto.randomUUID(),
    kind: 'focus',
    plannedSeconds: 1500,
    actualSeconds: 1500,
    endedAt: overrides.startedAt + 1500_000,
    completed: true,
    taskId: null,
    pillarId: null,
    syncedAt: null,
    ...overrides,
  }
}

function task(overrides: Partial<TaskRecord> & { id: string }): TaskRecord {
  return {
    title: 'Tâche',
    emoji: null,
    color: null,
    etaMinutes: null,
    parentId: null,
    position: 0,
    done: false,
    doneAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('computeCycleSummary — bilan de fin de cycle (LOT E6)', () => {
  it('cumule le temps réel de focus, les sessions et les pauses du cycle en cours', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 5000, actualSeconds: 1500 }),
      session({ startedAt: now - 4000, kind: 'short_break', actualSeconds: 300 }),
      session({ startedAt: now - 3000, actualSeconds: 1080 }), // arrêt anticipé
      session({ startedAt: now - 2000, kind: 'short_break', actualSeconds: 300 }),
      session({ startedAt: now - 1000, actualSeconds: 1500 }),
    ]
    const summary = computeCycleSummary(sessions, [], now)
    expect(summary).toEqual({
      focusSeconds: 1500 + 1080 + 1500,
      sessionsCount: 3,
      pausesCount: 2,
      completedTasksCount: 0,
    })
  })

  it('ne compte que le cycle depuis la dernière pause longue du jour', () => {
    const now = Date.UTC(2026, 0, 15, 18, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 9000, actualSeconds: 1500 }),
      session({ startedAt: now - 8000, kind: 'long_break', actualSeconds: 1200 }),
      session({ startedAt: now - 7000, actualSeconds: 1500 }),
      session({ startedAt: now - 6000, actualSeconds: 1500 }),
    ]
    const summary = computeCycleSummary(sessions, [], now)
    expect(summary.sessionsCount).toBe(2)
    expect(summary.focusSeconds).toBe(3000)
    expect(summary.pausesCount).toBe(0)
  })

  it('ignore les sessions d’hier (remis à 0 chaque jour)', () => {
    const now = Date.UTC(2026, 0, 15, 9, 0, 0)
    const yesterday = now - 24 * 60 * 60 * 1000
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: yesterday, actualSeconds: 1500 }),
      session({ startedAt: now - 1000, actualSeconds: 900 }),
    ]
    const summary = computeCycleSummary(sessions, [], now)
    expect(summary.sessionsCount).toBe(1)
    expect(summary.focusSeconds).toBe(900)
  })

  it('compte les tâches cochées pendant le cycle via leur horodatage, pas via taskId', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [session({ startedAt: now - 3000, taskId: null })]
    const tasks: TaskRecord[] = [
      task({ id: 't1', done: true, doneAt: now - 2500 }), // cochée pendant le cycle
      task({ id: 't2', done: true, doneAt: now - 10_000 }), // cochée avant le début du cycle
      task({ id: 't3', done: false, doneAt: null }), // pas cochée
    ]
    const summary = computeCycleSummary(sessions, tasks, now)
    expect(summary.completedTasksCount).toBe(1)
  })

  it('cycle vide : renvoie des totaux à zéro sans lever d’erreur', () => {
    const summary = computeCycleSummary([], [], Date.now())
    expect(summary).toEqual({
      focusSeconds: 0,
      sessionsCount: 0,
      pausesCount: 0,
      completedTasksCount: 0,
    })
  })
})
