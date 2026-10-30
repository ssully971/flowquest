import { describe, expect, it } from 'vitest'

import type { FocusSessionRecord, TaskRecord } from '@/shared/storage/db'

import { xpForActualSeconds } from '@/features/pillars/pillar-xp'

import { computeCycleSummary, summarizeSoloSession } from './cycle-summary'
import { createTimerState, pause, resume, start } from './engine/timer-engine'

function session(
  overrides: Partial<FocusSessionRecord> & { startedAt: number },
): FocusSessionRecord {
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
      // Les 2 phases de pause (2 × 300 s) comptent comme temps de pause ; aucune pause manuelle.
      pausedSeconds: 600,
      manualPauseCount: 0,
      xpGained: 0,
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
      pausedSeconds: 0,
      manualPauseCount: 0,
      xpGained: 0,
    })
  })

  it('additionne le temps de pause, les pauses manuelles et l’XP de pilier (sessions avec pilier seulement)', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({
        startedAt: now - 4000,
        actualSeconds: 1500,
        pausedSeconds: 120,
        pauseCount: 2,
        pillarId: 'p1',
      }),
      session({ startedAt: now - 3000, kind: 'short_break', actualSeconds: 300 }),
      session({ startedAt: now - 2000, actualSeconds: 600, pausedSeconds: 60, pauseCount: 1 }), // sans pilier
      session({ startedAt: now - 1000, actualSeconds: 900 }), // enregistrée avant la migration 0052 : champs absents
    ]
    const summary = computeCycleSummary(sessions, [], now)
    expect(summary.pausedSeconds).toBe(120 + 60 + 300)
    expect(summary.manualPauseCount).toBe(3)
    expect(summary.xpGained).toBe(xpForActualSeconds(1500))
    expect(summary.xpGained).toBeGreaterThan(0)
  })
})

describe('summarizeSoloSession — bilan d’un Chrono / Minuteur terminé', () => {
  const T0 = 1_700_000_000_000
  const MIN = 60_000

  it('durée de focus réelle, temps de pause, pauses manuelles, tâches cochées et XP', () => {
    let state = start(createTimerState('stopwatch', 'stopwatch', null), T0)
    state = pause(state, T0 + 20 * MIN)
    state = resume(state, T0 + 25 * MIN) // 5 min de pause
    state = pause(state, T0 + 40 * MIN)
    state = resume(state, T0 + 42 * MIN) // 2 min de pause
    const endedAt = T0 + 62 * MIN // 55 min de focus effectif
    const tasks = [
      task({ id: 'a', done: true, doneAt: T0 + 10 * MIN }),
      task({ id: 'b', done: true, doneAt: T0 - MIN }), // cochée avant la session
    ]

    const summary = summarizeSoloSession(state, endedAt, tasks, true)

    expect(summary).toEqual({
      focusSeconds: 55 * 60,
      sessionsCount: 1,
      pausesCount: 0,
      completedTasksCount: 1,
      pausedSeconds: 7 * 60,
      manualPauseCount: 2,
      xpGained: xpForActualSeconds(55 * 60),
    })
  })

  it('sans pilier actif : pas d’XP', () => {
    const state = start(createTimerState('stopwatch', 'stopwatch', null), T0)
    expect(summarizeSoloSession(state, T0 + 30 * MIN, [], false).xpGained).toBe(0)
  })

  it('terminé pendant une pause : la fin de la pause compte comme temps de pause', () => {
    const state = pause(start(createTimerState('stopwatch', 'stopwatch', null), T0), T0 + 10 * MIN)
    const summary = summarizeSoloSession(state, T0 + 13 * MIN, [], false)
    expect(summary.focusSeconds).toBe(10 * 60)
    expect(summary.pausedSeconds).toBe(3 * 60)
  })

  it('après 4 h sans « Je suis là » : seules les 4 h confirmées sont comptées, l’absence est une pause', () => {
    const state = start(createTimerState('stopwatch', 'stopwatch', null), T0)
    const summary = summarizeSoloSession(state, T0 + 7 * 60 * MIN, [], false)
    expect(summary.focusSeconds).toBe(4 * 3600)
    expect(summary.pausedSeconds).toBe(3 * 3600)
    expect(summary.manualPauseCount).toBe(0)
  })
})
