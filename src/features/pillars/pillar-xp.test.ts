import { describe, expect, it } from 'vitest'

import {
  levelForXp,
  levelProgressForXp,
  xpForActualSeconds,
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
