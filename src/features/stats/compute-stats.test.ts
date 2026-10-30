import { describe, expect, it, vi } from 'vitest'

import type { FocusSessionRecord, TaskRecord } from '@/shared/storage/db'

import {
  aggregateWeeklyFocus,
  computeDailyFocus,
  computeFocusScore,
  computePeriodStats,
  computeStats,
  getNextStreakMilestone,
  getWeekDayState,
  shiftDays,
  startOfDay,
  getTrendWindowDays,
  percentChange,
} from './compute-stats'
import type { DayFocus } from './compute-stats'

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
    pillarId: null,
    syncedAt: null,
    ...overrides,
  }
}

function task(overrides: Partial<TaskRecord> & { doneAt: number }): TaskRecord {
  return {
    id: crypto.randomUUID(),
    title: 'Tâche',
    emoji: null,
    color: null,
    etaMinutes: null,
    parentId: null,
    position: 0,
    done: true,
    createdAt: overrides.doneAt,
    updatedAt: overrides.doneAt,
    ...overrides,
  }
}

describe('computeStats — temps de focus aujourd’hui/cette semaine', () => {
  it('compte le temps réel d’une session de focus même abandonnée (LOT E7), ignore les pauses', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 1000, completed: false, actualSeconds: 300 }),
      session({ startedAt: now - 1000, kind: 'short_break', actualSeconds: 300 }),
    ]
    const stats = computeStats(sessions, now)
    expect(stats.todayFocusSeconds).toBe(300)
  })

  it('cumule uniquement les sessions focus du jour courant (vs. la semaine)', () => {
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

  describe('gels de série', () => {
    const now = new Date(2026, 0, 15, 12).getTime()
    const at = (offset: number) => shiftDays(startOfDay(now), offset) + 9 * 3_600_000

    it('un jour gelé fait le pont sans ajouter +1 à la série', () => {
      const sessions = [
        session({ startedAt: at(0) }),
        session({ startedAt: at(-2) }),
        session({ startedAt: at(-3) }),
      ]
      const frozen = new Set([shiftDays(startOfDay(now), -1)])
      const stats = computeStats(sessions, now, LOW_GOAL_MINUTES, frozen)
      expect(stats.currentStreakDays).toBe(3)
      expect(stats.longestStreakDays).toBe(3)
      expect(computeStats(sessions, now, LOW_GOAL_MINUTES).currentStreakDays).toBe(1)
    })

    it('la série en cours survit à un hier gelé tant qu’aujourd’hui n’est pas fini', () => {
      const sessions = [session({ startedAt: at(-2) })]
      const frozen = new Set([shiftDays(startOfDay(now), -1)])
      expect(computeStats(sessions, now, LOW_GOAL_MINUTES, frozen).currentStreakDays).toBe(1)
    })

    it('un trou de deux jours avec un seul gel casse quand même la série', () => {
      const sessions = [session({ startedAt: at(0) }), session({ startedAt: at(-3) })]
      const frozen = new Set([shiftDays(startOfDay(now), -1)])
      expect(computeStats(sessions, now, LOW_GOAL_MINUTES, frozen).currentStreakDays).toBe(1)
    })

    it('le record tient compte des jours gelés', () => {
      const sessions = [session({ startedAt: at(-10) }), session({ startedAt: at(-8) })]
      const frozen = new Set([shiftDays(startOfDay(now), -9)])
      expect(computeStats(sessions, now, LOW_GOAL_MINUTES, frozen).longestStreakDays).toBe(2)
    })

    it('états de la semaine : validé, gelé, manqué, aujourd’hui', () => {
      const today = startOfDay(now)
      const frozen = new Set([shiftDays(today, -1)])
      const day = (offset: number, goalMet: boolean): DayFocus => ({
        dayStart: shiftDays(today, offset),
        focusSeconds: 0,
        sessionsCount: 0,
        goalMet,
      })
      expect(getWeekDayState(day(-2, true), today, frozen)).toBe('validated')
      expect(getWeekDayState(day(-1, false), today, frozen)).toBe('frozen')
      expect(getWeekDayState(day(-3, false), today, frozen)).toBe('missed')
      expect(getWeekDayState(day(0, false), today, frozen)).toBe('today')
    })
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

describe('computeDailyFocus — historique jour par jour (calendrier et tendance, §9)', () => {
  it('retourne exactement `days` entrées, la plus récente en dernier, se terminant aujourd’hui', () => {
    // Minuit LOCAL (jamais Date.UTC : le calcul des jours se fait en heure locale).
    const now = new Date(2026, 0, 15, 12, 0, 0).getTime()
    const result = computeDailyFocus([], now, 7)
    expect(result).toHaveLength(7)
    expect(result[6].dayStart).toBe(new Date(2026, 0, 15).getTime())
    expect(result[0].dayStart).toBe(new Date(2026, 0, 9).getTime())
  })

  it('reste aligné sur minuit local à travers un changement d’heure (jours de 23 h / 25 h)', () => {
    vi.stubEnv('TZ', 'Europe/Paris')
    try {
      // Passage à l'heure d'été en France : dimanche 29 mars 2026 (ce jour dure 23 h).
      const now = new Date(2026, 2, 31, 12, 0, 0).getTime()
      const sessionOnThe28th: FocusSessionRecord = session({
        startedAt: new Date(2026, 2, 28, 10, 0, 0).getTime(),
        actualSeconds: 600,
      })
      const result = computeDailyFocus([sessionOnThe28th], now, 7)
      for (const entry of result) {
        const date = new Date(entry.dayStart)
        expect([date.getHours(), date.getMinutes()]).toEqual([0, 0])
      }
      expect(result.map((entry) => new Date(entry.dayStart).getDate())).toEqual([
        25, 26, 27, 28, 29, 30, 31,
      ])
      // La session du 28 est bien retrouvée (avec 24 h fixes, la clé du jour était décalée).
      expect(result[3].focusSeconds).toBe(600)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('cumule toutes les sessions focus du même jour (même abandonnées, LOT E7), ignore les pauses', () => {
    const now = Date.UTC(2026, 0, 15, 20, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 2000, actualSeconds: 600 }),
      session({ startedAt: now - 1000, actualSeconds: 300 }),
      session({ startedAt: now - 500, kind: 'short_break', actualSeconds: 300 }),
      session({ startedAt: now - 100, completed: false, actualSeconds: 1000 }),
    ]
    const result = computeDailyFocus(sessions, now, 1, 120)
    expect(result[0].focusSeconds).toBe(1900)
  })

  it('marque goalMet à partir du seuil de l’objectif quotidien', () => {
    const now = Date.UTC(2026, 0, 15, 20, 0, 0)
    const sessions: FocusSessionRecord[] = [session({ startedAt: now, actualSeconds: 3600 })]
    const underGoal = computeDailyFocus(sessions, now, 1, 120)
    const metGoal = computeDailyFocus(sessions, now, 1, 60)
    expect(underGoal[0].goalMet).toBe(false)
    expect(metGoal[0].goalMet).toBe(true)
  })

  it('renvoie des jours à 0 (et goalMet false) pour les jours sans session', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const result = computeDailyFocus([], now, 3, 120)
    expect(result.every((day) => day.focusSeconds === 0 && !day.goalMet)).toBe(true)
  })

  it('compte le nombre de sessions de focus terminées par jour (lot 5, calendrier en sessions)', () => {
    const now = Date.UTC(2026, 0, 15, 20, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 2000, actualSeconds: 600 }),
      session({ startedAt: now - 1000, actualSeconds: 300 }),
      session({ startedAt: now - 500, kind: 'short_break', actualSeconds: 300 }),
    ]
    const result = computeDailyFocus(sessions, now, 1, 120)
    expect(result[0].sessionsCount).toBe(2)
  })
})

describe('getNextStreakMilestone — panneau de détail de la série (lot 4)', () => {
  it('renvoie le plus petit palier connu strictement supérieur à la série actuelle', () => {
    expect(getNextStreakMilestone(0)).toBe(3)
    expect(getNextStreakMilestone(3)).toBe(7)
    expect(getNextStreakMilestone(5)).toBe(7)
    expect(getNextStreakMilestone(99)).toBe(100)
  })

  it('au-delà du dernier palier connu, renvoie le prochain multiple de 100', () => {
    expect(getNextStreakMilestone(365)).toBe(400)
    expect(getNextStreakMilestone(420)).toBe(500)
  })
})

describe('computePeriodStats — cartes de la période choisie, comparées à la période précédente (lot 5)', () => {
  it('cumule temps de focus, nombre de sessions, temps de pause et tâches terminées « aujourd’hui »', () => {
    const now = Date.UTC(2026, 0, 15, 20, 0, 0)
    const todayStart = Date.UTC(2026, 0, 15)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 1000, actualSeconds: 1200 }),
      session({ startedAt: now - 500, kind: 'short_break', actualSeconds: 300 }),
      session({ startedAt: now - 2 * DAY_MS, actualSeconds: 900 }), // hier : hors "aujourd'hui"
    ]
    const tasks: TaskRecord[] = [
      task({ doneAt: now - 200 }),
      task({ doneAt: todayStart - 1 }), // hier (juste avant minuit) : hors "aujourd'hui"
    ]

    const { current } = computePeriodStats(sessions, tasks, now, 'today')
    expect(current).toEqual({
      focusSeconds: 1200,
      sessionsCount: 1,
      pauseSeconds: 300,
      tasksCompleted: 1,
    })
  })

  it('compare à la période précédente de même longueur (semaine)', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0) // jeudi
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 1000, actualSeconds: 1500 }), // cette semaine
      session({ startedAt: now - 10 * DAY_MS, actualSeconds: 3000 }), // semaine précédente (J-10 à J-14)
      session({ startedAt: now - 20 * DAY_MS, actualSeconds: 9999 }), // bien avant : ni l'une ni l'autre
    ]

    const { current, previous } = computePeriodStats(sessions, [], now, 'week')
    expect(current.focusSeconds).toBe(1500)
    expect(previous?.focusSeconds).toBe(3000)
  })

  it('« depuis le début » n’a pas de période précédente comparable', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const { previous } = computePeriodStats([], [], now, 'all')
    expect(previous).toBeNull()
  })

  it('« depuis le début » cumule tout, sans borne basse', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 1000 * DAY_MS, actualSeconds: 1500 }),
    ]
    const { current } = computePeriodStats(sessions, [], now, 'all')
    expect(current.focusSeconds).toBe(1500)
  })

  it('crédite le temps réel d’un Pomodoro arrêté en cours de route, compte la session (LOT E7)', () => {
    const now = Date.UTC(2026, 0, 15, 20, 0, 0)
    const sessions: FocusSessionRecord[] = [
      // 25 min planifiées, arrêté à 18 min : 1080 s doivent être crédités, pas 0.
      session({
        startedAt: now - 1000,
        plannedSeconds: 1500,
        actualSeconds: 1080,
        completed: false,
      }),
      session({
        startedAt: now - 500,
        kind: 'short_break',
        plannedSeconds: 300,
        actualSeconds: 120,
        completed: false,
      }),
    ]

    const { current } = computePeriodStats(sessions, [], now, 'today')
    expect(current.focusSeconds).toBe(1080)
    expect(current.sessionsCount).toBe(1)
    expect(current.pauseSeconds).toBe(120)
  })
})

describe('percentChange — variation vs période précédente, pour la flèche du §9', () => {
  it('calcule un pourcentage de variation classique', () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
  })

  it('renvoie 0 quand les deux valeurs sont nulles (aucun changement)', () => {
    expect(percentChange(0, 0)).toBe(0)
  })

  it('renvoie null quand la période précédente est à 0 mais pas la courante (variation infinie)', () => {
    expect(percentChange(10, 0)).toBeNull()
  })
})

describe('getTrendWindowDays — fenêtre d’affichage de la courbe de tendance (§9)', () => {
  it('suit la longueur de la période, avec un minimum de 7 jours', () => {
    expect(getTrendWindowDays('today')).toBe(7)
    expect(getTrendWindowDays('week')).toBe(7)
    expect(getTrendWindowDays('month')).toBe(30)
    expect(getTrendWindowDays('year')).toBe(365)
  })

  it('plafonne « depuis le début » à un an', () => {
    expect(getTrendWindowDays('all')).toBe(365)
  })
})

describe('aggregateWeeklyFocus — regroupement en semaines (lundi à dimanche) pour les longues périodes', () => {
  function day(dayStart: number, focusSeconds: number, sessionsCount: number): DayFocus {
    return { dayStart, focusSeconds, sessionsCount, goalMet: false }
  }

  it('cumule les jours d’une même semaine (lundi à dimanche)', () => {
    const monday = new Date(2026, 0, 12).getTime() // lundi 12 janvier 2026, minuit local
    const tuesday = new Date(2026, 0, 13).getTime()
    const sunday = new Date(2026, 0, 18).getTime()
    const days = [day(monday, 600, 1), day(tuesday, 300, 1), day(sunday, 900, 2)]

    const weeks = aggregateWeeklyFocus(days)
    expect(weeks).toEqual([{ weekStart: monday, focusSeconds: 1800, sessionsCount: 4 }])
  })

  it('sépare deux semaines distinctes, triées chronologiquement', () => {
    const monday = new Date(2026, 0, 12).getTime()
    const nextMonday = new Date(2026, 0, 19).getTime()
    const days = [day(nextMonday, 300, 1), day(monday, 600, 1)] // ordre volontairement inversé

    const weeks = aggregateWeeklyFocus(days)
    expect(weeks.map((w) => w.weekStart)).toEqual([monday, nextMonday])
  })

  it('renvoie un tableau vide pour un historique vide', () => {
    expect(aggregateWeeklyFocus([])).toEqual([])
  })
})

describe('computeFocusScore — taux de complétion × régularité (§9, formule validée)', () => {
  it('combine taux de complétion et régularité sur la période', () => {
    const now = Date.UTC(2026, 0, 15, 20, 0, 0) // jeudi
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 1000, completed: true }),
      session({ startedAt: now - 500, completed: false }),
      session({ startedAt: now - DAY_MS, completed: true }),
    ]
    const { current } = computeFocusScore(sessions, now, 'week')
    // 2 sessions terminées sur 3 lancées -> 66,67 % ; 2 jours actifs sur 7 -> 28,57 %
    expect(current.completionRate).toBe(67)
    expect(current.regularityRate).toBe(29)
    expect(current.score).toBe(19) // round(0,6667 × 0,2857 × 100)
  })

  it('compare à la période précédente de même longueur', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 1000, completed: true }), // cette semaine : 1/1 complété
      session({ startedAt: now - 10 * DAY_MS, completed: false }), // semaine précédente : 0/1 complété
    ]
    const { current, previous } = computeFocusScore(sessions, now, 'week')
    expect(current.completionRate).toBe(100)
    expect(previous?.completionRate).toBe(0)
  })

  it('aucune session lancée : score à 0', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    expect(computeFocusScore([], now, 'week').current).toEqual({
      score: 0,
      completionRate: 0,
      regularityRate: 0,
    })
  })

  it('« depuis le début » part de la toute première session de focus lancée, sans comparaison', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0)
    const sessions: FocusSessionRecord[] = [
      session({ startedAt: now - 2 * DAY_MS, completed: true }), // 1re session jamais lancée
      session({ startedAt: now, completed: true }),
    ]
    const { current, previous } = computeFocusScore(sessions, now, 'all')
    // Fenêtre de 3 jours (J-2 à J), 2 jours actifs -> régularité 66,67 %
    expect(current.regularityRate).toBe(67)
    expect(current.completionRate).toBe(100)
    expect(previous).toBeNull()
  })
})
