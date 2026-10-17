import { describe, expect, it } from 'vitest'

import { POMODORO_DEFAULTS } from './durations'
import {
  computeSessionGoalPlan,
  formatPlanDuration,
  getGoalFocusSessions,
  isGoalReached,
} from './session-goal'
import type { SessionGoalConfig } from './session-goal'

const DURATIONS = {
  focusMs: POMODORO_DEFAULTS.focusMs, // 25 min
  shortBreakMs: POMODORO_DEFAULTS.shortBreakMs, // 5 min
  longBreakMs: POMODORO_DEFAULTS.longBreakMs, // 10 min
}

function config(overrides: Partial<SessionGoalConfig> = {}): SessionGoalConfig {
  return {
    goalType: 'count',
    goalCount: 4,
    goalMinutes: 120,
    durations: DURATIONS,
    sessionsBeforeLongBreak: 4,
    ...overrides,
  }
}

describe('getGoalFocusSessions — nombre de sessions visées, quel que soit le type d’objectif', () => {
  it('objectif « nombre de sessions » : renvoie directement ce nombre', () => {
    expect(getGoalFocusSessions(config({ goalType: 'count', goalCount: 6 }))).toBe(6)
  })

  it('objectif « durée totale » : arrondit au nombre de sessions de focus nécessaire', () => {
    // 120 min visées / 25 min par session = 4,8 -> arrondi à 5 sessions pour atteindre l'objectif
    expect(getGoalFocusSessions(config({ goalType: 'duration', goalMinutes: 120 }))).toBe(5)
    // Exactement 100 min = 4 sessions de 25 min, sans arrondi au-dessus
    expect(getGoalFocusSessions(config({ goalType: 'duration', goalMinutes: 100 }))).toBe(4)
  })

  it('aucun objectif : 0 session visée', () => {
    expect(getGoalFocusSessions(config({ goalType: 'none' }))).toBe(0)
  })
})

describe('computeSessionGoalPlan — plan du cycle (sessions, pauses, durée totale)', () => {
  it('aucun objectif : pas de plan', () => {
    expect(computeSessionGoalPlan(config({ goalType: 'none' }))).toBeNull()
  })

  it('répartit les pauses courtes/longues selon sessionsBeforeLongBreak', () => {
    // 4 sessions -> 3 pauses, la pause longue tombe au multiple de 4 : aucune ici (indices 1,2,3)
    const plan = computeSessionGoalPlan(config({ goalType: 'count', goalCount: 4 }))
    expect(plan).toEqual({
      focusSessions: 4,
      shortBreaks: 3,
      longBreaks: 0,
      totalMs: 4 * DURATIONS.focusMs + 3 * DURATIONS.shortBreakMs,
    })
  })

  it('inclut une pause longue dès que le cycle complet est dépassé', () => {
    // 5 sessions -> 4 pauses, la 4e (multiple de sessionsBeforeLongBreak=4) est longue
    const plan = computeSessionGoalPlan(config({ goalType: 'count', goalCount: 5 }))
    expect(plan).toEqual({
      focusSessions: 5,
      shortBreaks: 3,
      longBreaks: 1,
      totalMs: 5 * DURATIONS.focusMs + 3 * DURATIONS.shortBreakMs + 1 * DURATIONS.longBreakMs,
    })
  })

  it('une seule session visée : aucune pause', () => {
    const plan = computeSessionGoalPlan(config({ goalType: 'count', goalCount: 1 }))
    expect(plan).toEqual({
      focusSessions: 1,
      shortBreaks: 0,
      longBreaks: 0,
      totalMs: DURATIONS.focusMs,
    })
  })
})

describe('isGoalReached', () => {
  it('atteint dès que le nombre de sessions complétées égale ou dépasse la cible', () => {
    expect(isGoalReached(3, 4)).toBe(false)
    expect(isGoalReached(4, 4)).toBe(true)
    expect(isGoalReached(5, 4)).toBe(true)
  })

  it('jamais atteint sans objectif (cible à 0)', () => {
    expect(isGoalReached(10, 0)).toBe(false)
  })
})

describe('formatPlanDuration', () => {
  it('formate heures et minutes', () => {
    expect(formatPlanDuration(2 * 60 * 60_000 + 10 * 60_000)).toBe('2 h 10')
  })

  it('omet les minutes quand elles sont nulles', () => {
    expect(formatPlanDuration(3 * 60 * 60_000)).toBe('3 h')
  })

  it('affiche seulement les minutes sous une heure', () => {
    expect(formatPlanDuration(45 * 60_000)).toBe('45 min')
  })
})
