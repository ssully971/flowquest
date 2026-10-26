import { describe, expect, it } from 'vitest'

import {
  goalPace,
  goalProgressRatio,
  levelForXp,
  levelProgressForXp,
  xpForActualSeconds,
  xpRemainingForGoal,
  xpToReachLevel,
} from './pillar-xp'

describe('xpForActualSeconds — 1 min de focus réel = 10 XP (LOT G3)', () => {
  it('convertit des secondes exactes en minutes', () => {
    expect(xpForActualSeconds(18 * 60)).toBe(180) // Pomodoro arrêté à 18 min → XP de 18 min.
  })

  it('arrondit toujours vers le bas (jamais au-dessus de la durée réelle)', () => {
    expect(xpForActualSeconds(65)).toBe(10) // floor(65 * 10 / 60) = floor(10.83) = 10.
    expect(xpForActualSeconds(59)).toBe(9) // floor(59 * 10 / 60) = floor(9.83) = 9.
  })

  it('ne devient jamais négative', () => {
    expect(xpForActualSeconds(-100)).toBe(0)
  })
})

describe('levelForXp / xpToReachLevel — courbe de niveau croissante', () => {
  it('niveau 1 à 0 XP', () => {
    expect(levelForXp(0)).toBe(1)
    expect(xpToReachLevel(1)).toBe(0)
  })

  it('reste au niveau 1 juste avant le seuil du niveau 2 (600 XP)', () => {
    expect(xpToReachLevel(2)).toBe(600)
    expect(levelForXp(599)).toBe(1)
    expect(levelForXp(600)).toBe(2)
  })

  it('passe au niveau 3 à 1800 XP (300·(3-1)·3)', () => {
    expect(xpToReachLevel(3)).toBe(1800)
    expect(levelForXp(1799)).toBe(2)
    expect(levelForXp(1800)).toBe(3)
  })

  it('coût croissant : passer du niveau 5 au niveau 6 coûte plus que du niveau 1 au niveau 2', () => {
    const costLevel1to2 = xpToReachLevel(2) - xpToReachLevel(1)
    const costLevel5to6 = xpToReachLevel(6) - xpToReachLevel(5)
    expect(costLevel5to6).toBeGreaterThan(costLevel1to2)
  })

  it('jamais sous le niveau 1, même pour une XP négative', () => {
    expect(levelForXp(-50)).toBe(1)
  })
})

describe('levelProgressForXp', () => {
  it('calcule la progression dans le niveau en cours', () => {
    // 650 XP : niveau 2 (seuil 600), 50 XP acquis dans ce niveau, 1200 XP requises pour
    // passer au niveau 3 (xpToReachLevel(3) - xpToReachLevel(2) = 1800 - 600).
    const progress = levelProgressForXp(650)
    expect(progress.level).toBe(2)
    expect(progress.xpInLevel).toBe(50)
    expect(progress.xpForNextLevel).toBe(1200)
  })

  it('xpInLevel vaut 0 pile au seuil d’un niveau', () => {
    const progress = levelProgressForXp(600)
    expect(progress.level).toBe(2)
    expect(progress.xpInLevel).toBe(0)
  })
})

describe('xpRemainingForGoal — objectif de niveau (lot 4, §4)', () => {
  it('calcule l’XP restante jusqu’au niveau visé', () => {
    // Niveau 3 = 1800 XP (voir xpToReachLevel) ; à 600 XP, il en reste 1200.
    expect(xpRemainingForGoal(600, 3)).toBe(1200)
  })

  it('jamais négative, même si l’objectif est déjà dépassé', () => {
    expect(xpRemainingForGoal(2000, 3)).toBe(0)
  })

  it('vaut 0 pile au seuil du niveau visé', () => {
    expect(xpRemainingForGoal(1800, 3)).toBe(0)
  })
})

describe('goalProgressRatio', () => {
  it('0 au départ, 1 une fois l’objectif atteint', () => {
    expect(goalProgressRatio(0, 3)).toBe(0)
    expect(goalProgressRatio(1800, 3)).toBe(1)
  })

  it('ne dépasse jamais 1, même bien au-delà de l’objectif', () => {
    expect(goalProgressRatio(5000, 3)).toBe(1)
  })

  it('à mi-chemin de l’objectif, vaut environ 0,5', () => {
    expect(goalProgressRatio(900, 3)).toBeCloseTo(0.5, 5)
  })
})

describe('goalPace — rythme nécessaire pour atteindre l’objectif (lot 4, §4)', () => {
  const DAY_MS = 24 * 60 * 60 * 1000
  const NOW = new Date('2026-01-01T00:00:00Z').getTime()

  it('sans date limite : XP et temps restants, mais aucun rythme quotidien', () => {
    const pace = goalPace(600, 3, null, NOW)
    expect(pace.xpRemaining).toBe(1200)
    expect(pace.secondsRemaining).toBe(1200 / 10 * 60) // 10 XP/min, voir XP_PER_MINUTE.
    expect(pace.daysUntilDeadline).toBeNull()
    expect(pace.averageSecondsPerDayNeeded).toBeNull()
  })

  it('avec une date limite dans 10 jours : rythme quotidien moyen nécessaire', () => {
    const deadline = NOW + 10 * DAY_MS
    const pace = goalPace(600, 3, deadline, NOW)
    expect(pace.daysUntilDeadline).toBeCloseTo(10, 5)
    // 1200 XP restantes = 7200 s de focus réel (10 XP/min) ÷ 10 jours = 720 s/jour.
    expect(pace.averageSecondsPerDayNeeded).toBeCloseTo(720, 5)
  })

  it('date limite déjà dépassée et objectif non atteint : pas de rythme calculable', () => {
    const deadline = NOW - DAY_MS
    const pace = goalPace(600, 3, deadline, NOW)
    expect(pace.daysUntilDeadline).toBeLessThan(0)
    expect(pace.averageSecondsPerDayNeeded).toBeNull()
  })

  it('objectif déjà atteint : aucun rythme nécessaire même avec une date limite', () => {
    const deadline = NOW + 10 * DAY_MS
    const pace = goalPace(1800, 3, deadline, NOW)
    expect(pace.xpRemaining).toBe(0)
    expect(pace.averageSecondsPerDayNeeded).toBeNull()
  })
})
