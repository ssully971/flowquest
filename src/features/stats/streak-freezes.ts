import { shiftDays, startOfDay } from './compute-stats'
import type { FocusSessionRecord } from '@/shared/storage/db'

/** Une tranche de 10 h de focus cumulées rapporte 1 gel (même constante côté SQL, 0054). */
export const FREEZE_EARN_SECONDS = 36000
/** Stock maximal de gels : au-delà, la progression continue mais ne donne rien. */
export const FREEZE_STOCK_CAP = 3

/**
 * État persisté des gels (invités : IndexedDB ; comptes connectés : miroir de la table
 * serveur streak_freeze_state). Les jours sont des débuts de jour locaux (epoch ms).
 */
export interface FreezeState {
  /** Dernier jour déjà rejoué (inclus) : aujourd'hui n'est jamais traité. */
  processedThrough: number
  stock: number
  /** Focus cumulé jusqu'à processedThrough inclus (temps déjà plafonné par le garde-fou 4 h). */
  accountedSeconds: number
  /** La série est-elle vivante à la fin de processedThrough ? */
  alive: boolean
  /** Jours couverts par un gel, par ordre croissant. */
  usedDays: number[]
}

export function groupFocusSecondsByDay(sessions: FocusSessionRecord[]): Map<number, number> {
  const byDay = new Map<number, number>()
  for (const session of sessions) {
    if (session.kind !== 'focus') continue
    const day = startOfDay(session.startedAt)
    byDay.set(day, (byDay.get(day) ?? 0) + session.actualSeconds)
  }
  return byDay
}

/**
 * Premier état d'un compte : AUCUN rétroactif. Le stock part du focus cumulé avant
 * aujourd'hui (plafonné) et aucun jour passé n'est couvert.
 */
export function initFreezeState(
  secondsByDay: ReadonlyMap<number, number>,
  todayStart: number,
  goalSeconds: number,
): FreezeState {
  let accountedSeconds = 0
  for (const [day, seconds] of secondsByDay) if (day < todayStart) accountedSeconds += seconds
  const yesterday = shiftDays(todayStart, -1)
  return {
    processedThrough: yesterday,
    stock: Math.min(FREEZE_STOCK_CAP, Math.floor(accountedSeconds / FREEZE_EARN_SECONDS)),
    accountedSeconds,
    alive: (secondsByDay.get(yesterday) ?? 0) >= goalSeconds,
    usedDays: [],
  }
}

/**
 * Rejoue, jour par jour, les journées écoulées depuis processedThrough jusqu'à hier.
 * Déterministe et idempotente (rejouer deux fois donne le même état). Même algorithme
 * que sync_streak_freezes (migration 0054) : gains du jour d'abord, puis un jour manqué
 * sur une série vivante consomme 1 gel s'il en reste, sinon la série retombe.
 */
export function advanceFreezeState(
  state: FreezeState,
  secondsByDay: ReadonlyMap<number, number>,
  todayStart: number,
  goalSeconds: number,
): FreezeState {
  let { stock, accountedSeconds, alive, processedThrough } = state
  const usedDays = [...state.usedDays]

  for (let day = shiftDays(processedThrough, 1); day < todayStart; day = shiftDays(day, 1)) {
    const seconds = secondsByDay.get(day) ?? 0
    const previousTotal = accountedSeconds
    accountedSeconds += seconds
    stock = Math.min(
      FREEZE_STOCK_CAP,
      stock +
        Math.floor(accountedSeconds / FREEZE_EARN_SECONDS) -
        Math.floor(previousTotal / FREEZE_EARN_SECONDS),
    )
    if (seconds >= goalSeconds) {
      alive = true
    } else if (alive) {
      if (stock > 0) {
        stock -= 1
        if (!usedDays.includes(day)) usedDays.push(day)
      } else {
        alive = false
      }
    }
    processedThrough = day
  }

  return { processedThrough, stock, accountedSeconds, alive, usedDays }
}

export interface FreezeView {
  /** Stock affiché, y compris le gel qu'aujourd'hui peut déjà avoir fait gagner. */
  stock: number
  /** Progression vers le prochain gel, en secondes (0 ≤ x < FREEZE_EARN_SECONDS). */
  progressSeconds: number
  /** Stock plein : la progression continue mais ne rapporte plus rien. */
  capped: boolean
  usedDays: number[]
}

export function getFreezeView(state: FreezeState, todaySeconds: number): FreezeView {
  const total = state.accountedSeconds + todaySeconds
  const earnedToday =
    Math.floor(total / FREEZE_EARN_SECONDS) -
    Math.floor(state.accountedSeconds / FREEZE_EARN_SECONDS)
  const stock = Math.min(FREEZE_STOCK_CAP, state.stock + earnedToday)
  return {
    stock,
    progressSeconds: total % FREEZE_EARN_SECONDS,
    capped: stock >= FREEZE_STOCK_CAP,
    usedDays: state.usedDays,
  }
}
