import { describe, expect, it } from 'vitest'

import type { FocusSessionRecord } from '@/shared/storage/db'

import { computeStats } from './compute-stats'

const DAY_MS = 24 * 60 * 60 * 1000

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
    syncedAt: null,
    ...overrides,
  }
}

describe('computeStats — temps de focus aujourd’hui/cette semaine', () => {
  it('ignore les sessions non terminées (abandonnées) et les pauses', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 1000, completed: false, actualSeconds: 300 }),
      session({ startedAt: now - 1000, kind: 'short_break', actualSeconds: 300 }),
    ]
    const stats = computeStats(sessions, now)
    expect(stats.todayFocusSeconds).toBe(0)
  })

  it('cumule uniquement les sessions focus terminées du jour courant', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 1000, actualSeconds: 1200 }),
      session({ startedAt: now - DAY_MS, actualSeconds: 900 }), // hier : hors "aujourd'hui"
    ]
    const stats = computeStats(sessions, now)
    expect(stats.todayFocusSeconds).toBe(1200)
    expect(stats.weekFocusSeconds).toBe(2100) // les deux comptent dans les 7 derniers jours
  })
})

describe('computeStats — série de jours (streak), conditionnée par l’objectif quotidien', () => {
  // Les sessions par défaut durent 1500 s (25 min). Avec un objectif de 10 min, une
  // seule session de ce type suffit à faire compter le jour — ces tests reproduisent
  // donc le comportement "une session = un jour" désormais conditionné par un objectif
  // explicitement bas, pour isoler la logique de chaînage des jours de celle du seuil.
  const LOW_GOAL_MINUTES = 10

  it('série à 0 si aucune session complétée aujourd’hui ni hier', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [session({ startedAt: now - 3 * DAY_MS })]
    expect(computeStats(sessions, now, LOW_GOAL_MINUTES).currentStreakDays).toBe(0)
  })

  it('compte la série en cours même si rien n’est fait aujourd’hui, tant qu’hier compte', () => {
    const now = Date.UTC(2026, 0, 15, 20, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - DAY_MS }),
      session({ startedAt: now - 2 * DAY_MS }),
    ]
    expect(computeStats(sessions, now, LOW_GOAL_MINUTES).currentStreakDays).toBe(2)
  })

  it('une interruption d’un jour coupe la série actuelle', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now }),
      session({ startedAt: now - 3 * DAY_MS }), // trou de 2 jours avant
    ]
    expect(computeStats(sessions, now, LOW_GOAL_MINUTES).currentStreakDays).toBe(1)
  })

  it('retient la plus longue série même si elle n’est plus la série actuelle', () => {
    const now = Date.UTC(2026, 0, 20, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now }), // aujourd'hui : série actuelle = 1
      session({ startedAt: now - 10 * DAY_MS }),
      session({ startedAt: now - 11 * DAY_MS }),
      session({ startedAt: now - 12 * DAY_MS }),
      session({ startedAt: now - 13 * DAY_MS }), // série passée de 4 jours
    ]
    const stats = computeStats(sessions, now, LOW_GOAL_MINUTES)
    expect(stats.currentStreakDays).toBe(1)
    expect(stats.longestStreakDays).toBe(4)
  })

  it('un jour sous l’objectif ne compte pas dans la série', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now, actualSeconds: 600 }), // 10 min, sous l'objectif de 120 min
    ]
    expect(computeStats(sessions, now, 120).currentStreakDays).toBe(0)
  })

  it('plusieurs sessions le même jour se cumulent pour atteindre l’objectif', () => {
    const now = Date.UTC(2026, 0, 15, 20, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 2000, actualSeconds: 3600 }), // 60 min
      session({ startedAt: now - 1000, actualSeconds: 3600 }), // + 60 min = 120 min
    ]
    expect(computeStats(sessions, now, 120).currentStreakDays).toBe(1)
  })

  it('utilise 120 min par défaut quand aucun objectif n’est fourni', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [session({ startedAt: now, actualSeconds: 1500 })]
    expect(computeStats(sessions, now).currentStreakDays).toBe(0)
    expect(computeStats(sessions, now).dailyGoalMinutes).toBe(120)
  })
})
