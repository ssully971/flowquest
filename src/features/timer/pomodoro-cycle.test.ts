import { describe, expect, it } from 'vitest'

import type { FocusSessionRecord } from '@/shared/storage/db'

import {
  advancePomodoroCycle,
  countFocusSessionsSinceLastLongBreak,
  createPomodoroCycle,
} from './pomodoro-cycle'

const config = { sessionsBeforeLongBreak: 4 }

function session(overrides: Partial<FocusSessionRecord> & { startedAt: number }): FocusSessionRecord {
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

describe('pomodoro-cycle', () => {
  it('passe de focus à pause courte et incrémente le compteur', () => {
    const next = advancePomodoroCycle(createPomodoroCycle(), config)
    expect(next).toEqual({ segment: 'short_break', completedFocusCount: 1 })
  })

  it('revient en focus après une pause courte, sans changer le compteur', () => {
    const afterBreak = advancePomodoroCycle(
      { segment: 'short_break', completedFocusCount: 1 },
      config,
    )
    expect(afterBreak).toEqual({ segment: 'focus', completedFocusCount: 1 })
  })

  it('déclenche une pause longue et réinitialise le compteur au 4e focus', () => {
    const next = advancePomodoroCycle({ segment: 'focus', completedFocusCount: 3 }, config)
    expect(next).toEqual({ segment: 'long_break', completedFocusCount: 0 })
  })

  it('revient en focus après une pause longue', () => {
    const next = advancePomodoroCycle({ segment: 'long_break', completedFocusCount: 0 }, config)
    expect(next).toEqual({ segment: 'focus', completedFocusCount: 0 })
  })
})

describe('countFocusSessionsSinceLastLongBreak — numéro de session dérivé de l’historique réel (LOT E3)', () => {
  it('compte 0 sans aucune session aujourd’hui', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    expect(countFocusSessionsSinceLastLongBreak([], now)).toBe(0)
  })

  it('compte les sessions de focus du jour, même abandonnées', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 3000 }),
      session({ startedAt: now - 2000, completed: false }),
      session({ startedAt: now - 1000 }),
    ]
    expect(countFocusSessionsSinceLastLongBreak(sessions, now)).toBe(3)
  })

  it('ignore les sessions d’hier (remis à 0 chaque jour)', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const yesterday = now - 24 * 60 * 60 * 1000
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: yesterday }),
      session({ startedAt: yesterday + 1000 }),
      session({ startedAt: now - 1000 }),
    ]
    expect(countFocusSessionsSinceLastLongBreak(sessions, now)).toBe(1)
  })

  it('remet le compteur à 0 après une pause longue du jour', () => {
    const now = Date.UTC(2026, 0, 15, 18, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 5000 }),
      session({ startedAt: now - 4000 }),
      session({ startedAt: now - 3000 }),
      session({ startedAt: now - 2000, kind: 'long_break' }),
      session({ startedAt: now - 1000 }),
    ]
    expect(countFocusSessionsSinceLastLongBreak(sessions, now)).toBe(1)
  })

  it('ignore les pauses courtes et les autres modes (compte à rebours, chronomètre)', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 3000 }),
      session({ startedAt: now - 2000, kind: 'short_break' }),
      session({ startedAt: now - 1000 }),
    ]
    expect(countFocusSessionsSinceLastLongBreak(sessions, now)).toBe(2)
  })

  it('n’est pas perturbé par l’ordre d’insertion : trie par horodatage réel', () => {
    const now = Date.UTC(2026, 0, 15, 18, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 1000 }), // la plus récente, insérée en premier
      session({ startedAt: now - 3000 }),
      session({ startedAt: now - 2000, kind: 'long_break' }), // pause longue entre les deux
    ]
    expect(countFocusSessionsSinceLastLongBreak(sessions, now)).toBe(1)
  })
})
