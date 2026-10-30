import { describe, expect, it } from 'vitest'

import { shiftDays, startOfDay } from './compute-stats'
import {
  advanceFreezeState,
  FREEZE_EARN_SECONDS,
  getFreezeView,
  initFreezeState,
} from './streak-freezes'
import type { FreezeState } from './streak-freezes'

const GOAL = 7200
const TODAY = startOfDay(new Date(2026, 5, 15, 14).getTime())
const day = (offset: number) => shiftDays(TODAY, offset)

function seconds(entries: Record<number, number>): Map<number, number> {
  return new Map(Object.entries(entries).map(([offset, value]) => [day(Number(offset)), value]))
}

function state(overrides: Partial<FreezeState> = {}): FreezeState {
  return {
    processedThrough: day(-1),
    stock: 0,
    accountedSeconds: 0,
    alive: true,
    usedDays: [],
    ...overrides,
  }
}

describe('initFreezeState', () => {
  it('ne couvre aucun jour passé et plafonne le stock de départ à 3', () => {
    const init = initFreezeState(seconds({ [-10]: 36000 * 5, [0]: 9999 }), TODAY, GOAL)
    expect(init.stock).toBe(3)
    expect(init.usedDays).toEqual([])
    expect(init.processedThrough).toBe(day(-1))
    expect(init.accountedSeconds).toBe(36000 * 5)
  })

  it('série vivante seulement si hier est validé', () => {
    expect(initFreezeState(seconds({ [-1]: GOAL }), TODAY, GOAL).alive).toBe(true)
    expect(initFreezeState(seconds({ [-2]: GOAL }), TODAY, GOAL).alive).toBe(false)
  })
})

describe('advanceFreezeState', () => {
  it('consomme un gel pour un jour manqué quand la série est vivante', () => {
    const next = advanceFreezeState(
      state({ processedThrough: day(-3), stock: 1 }),
      seconds({ [-2]: 0, [-1]: GOAL }),
      TODAY,
      GOAL,
    )
    expect(next.usedDays).toEqual([day(-2)])
    expect(next.stock).toBe(0)
    expect(next.alive).toBe(true)
  })

  it('un gel ne couvre qu’un seul jour : deux jours manqués sans second gel cassent la série', () => {
    const next = advanceFreezeState(
      state({ processedThrough: day(-3), stock: 1 }),
      seconds({}),
      TODAY,
      GOAL,
    )
    expect(next.usedDays).toEqual([day(-2)])
    expect(next.alive).toBe(false)
    expect(next.stock).toBe(0)
  })

  it('ne consomme rien quand la série est déjà tombée', () => {
    const next = advanceFreezeState(
      state({ alive: false, stock: 2, processedThrough: day(-3) }),
      seconds({}),
      TODAY,
      GOAL,
    )
    expect(next.usedDays).toEqual([])
    expect(next.stock).toBe(2)
  })

  it('gagne 1 gel par 10 h cumulées et plafonne à 3', () => {
    const next = advanceFreezeState(
      state({ processedThrough: day(-5) }),
      seconds({ [-4]: 86400, [-3]: 86400, [-2]: 86400, [-1]: 86400 }),
      TODAY,
      GOAL,
    )
    expect(next.stock).toBe(3)
    expect(next.accountedSeconds).toBe(86400 * 4)
  })

  it('est idempotent : rejouer ne consomme pas deux fois', () => {
    const once = advanceFreezeState(
      state({ processedThrough: day(-3), stock: 2 }),
      seconds({}),
      TODAY,
      GOAL,
    )
    const twice = advanceFreezeState(once, seconds({}), TODAY, GOAL)
    expect(twice).toEqual(once)
  })

  it('traverse un changement d’heure sans sauter ni doubler de jour', () => {
    const march = startOfDay(new Date(2026, 2, 30, 10).getTime()) // lendemain du passage à l'heure d'été (UE)
    const next = advanceFreezeState(
      { ...state({ processedThrough: shiftDays(march, -4), stock: 3 }) },
      new Map(),
      march,
      GOAL,
    )
    expect(next.usedDays).toHaveLength(3)
    expect(new Set(next.usedDays).size).toBe(3)
    expect(next.processedThrough).toBe(shiftDays(march, -1))
  })
})

describe('getFreezeView', () => {
  it('affiche la progression « 3 h 20 / 10 h » et le gel déjà gagné aujourd’hui', () => {
    const view = getFreezeView(state({ accountedSeconds: 36000 * 2 - 600, stock: 1 }), 1200)
    expect(view.stock).toBe(2)
    expect(view.progressSeconds).toBe(600)
    const mid = getFreezeView(state({ accountedSeconds: 12000 }), 0)
    expect(mid.progressSeconds).toBe(12000)
    expect(mid.progressSeconds).toBeLessThan(FREEZE_EARN_SECONDS)
  })

  it('stock plein : la progression continue mais le message de plafond s’active', () => {
    const view = getFreezeView(state({ stock: 3, accountedSeconds: 36000 * 4 + 100 }), 50)
    expect(view.capped).toBe(true)
    expect(view.stock).toBe(3)
    expect(view.progressSeconds).toBe(150)
  })
})
