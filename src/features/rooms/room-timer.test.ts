import { describe, expect, it } from 'vitest'

import { ServerClock, sampleFromExchange } from './clock-offset'
import {
  computeRoomElapsedMs,
  computeRoomRemainingMs,
  computeRoomView,
  groupCycleProgress,
  phaseForIndex,
  reconcileRoomClock,
} from './room-timer'
import type { RoomState } from './types'

describe('computeRoomElapsedMs — LOT F3', () => {
  it('renvoie elapsedMsAtPause tel quel en pause', () => {
    const elapsed = computeRoomElapsedMs(
      { status: 'paused', startedAt: null, elapsedMsAtPause: 42_000 },
      Date.now(),
    )
    expect(elapsed).toBe(42_000)
  })

  it('calcule depuis startedAt en cours de route', () => {
    const startedAt = new Date(Date.now() - 10_000).toISOString()
    const elapsed = computeRoomElapsedMs(
      { status: 'running', startedAt, elapsedMsAtPause: null },
      Date.now(),
    )
    expect(elapsed).toBeGreaterThanOrEqual(9_900)
    expect(elapsed).toBeLessThanOrEqual(10_100)
  })

  it('renvoie 0 en lobby ou en fin de salon', () => {
    expect(
      computeRoomElapsedMs(
        { status: 'lobby', startedAt: null, elapsedMsAtPause: null },
        Date.now(),
      ),
    ).toBe(0)
    expect(
      computeRoomElapsedMs(
        { status: 'ended', startedAt: null, elapsedMsAtPause: null },
        Date.now(),
      ),
    ).toBe(0)
  })
})

describe('computeRoomRemainingMs — LOT F3', () => {
  it('décroît avec le temps pendant que le salon tourne', () => {
    const startedAt = new Date(Date.now() - 5_000).toISOString()
    const remaining = computeRoomRemainingMs(
      { status: 'running', startedAt, elapsedMsAtPause: null, durationMs: 60_000 },
      Date.now(),
    )
    expect(remaining).toBeGreaterThanOrEqual(54_900)
    expect(remaining).toBeLessThanOrEqual(55_100)
  })

  it('ne descend jamais sous 0', () => {
    const startedAt = new Date(Date.now() - 120_000).toISOString()
    const remaining = computeRoomRemainingMs(
      { status: 'running', startedAt, elapsedMsAtPause: null, durationMs: 60_000 },
      Date.now(),
    )
    expect(remaining).toBe(0)
  })

  it('vaut 0 une fois le salon terminé', () => {
    const remaining = computeRoomRemainingMs(
      { status: 'ended', startedAt: null, elapsedMsAtPause: 60_000, durationMs: 60_000 },
      Date.now(),
    )
    expect(remaining).toBe(0)
  })

  it('reflète la pause (durée totale moins le temps déjà écoulé)', () => {
    const remaining = computeRoomRemainingMs(
      { status: 'paused', startedAt: null, elapsedMsAtPause: 20_000, durationMs: 60_000 },
      Date.now(),
    )
    expect(remaining).toBe(40_000)
  })
})

describe('phaseForIndex — enchaînement Pomodoro (LOT M2, miroir du SQL)', () => {
  it('alterne focus / pause, pause longue après N focus', () => {
    // N = 4 : F S F S F S F L F ...
    const phases = Array.from({ length: 9 }, (_, i) => phaseForIndex(i, 4))
    expect(phases).toEqual([
      'focus',
      'short_break',
      'focus',
      'short_break',
      'focus',
      'short_break',
      'focus',
      'long_break',
      'focus',
    ])
  })

  it('pause longue après chaque 2e focus quand N = 2', () => {
    expect([1, 3, 5, 7].map((i) => phaseForIndex(i, 2))).toEqual([
      'short_break',
      'long_break',
      'short_break',
      'long_break',
    ])
  })

  it('retombe sur 4 sessions par défaut', () => {
    expect(phaseForIndex(7, null)).toBe('long_break')
  })
})

describe('computeRoomView — horloge du salon, 3 modes (LOT M2)', () => {
  const NOW = Date.UTC(2026, 0, 15, 12, 0, 0)
  const base = {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 2,
    clockOffsetMs: 0,
    elapsedMsAtPause: null,
  }
  const startedAgo = (ms: number) => new Date(NOW - ms).toISOString()

  it('Minuteur : décompte depuis startedAt, jamais sous 0, isOver quand le temps est écoulé', () => {
    const room = {
      ...base,
      mode: 'countdown' as const,
      status: 'running' as const,
      phase: 'focus' as const,
      phaseIndex: 0,
      durationMs: 25 * 60_000,
      startedAt: startedAgo(10 * 60_000),
    }
    const view = computeRoomView(room, NOW)
    expect(view.remainingMs).toBe(15 * 60_000)
    expect(view.isOver).toBe(false)
    const over = computeRoomView({ ...room, startedAt: startedAgo(26 * 60_000) }, NOW)
    expect(over.remainingMs).toBe(0)
    expect(over.isOver).toBe(true)
  })

  it('Chrono : pas de durée, le temps écoulé monte', () => {
    const room = {
      ...base,
      mode: 'stopwatch' as const,
      focusMinutes: null,
      status: 'running' as const,
      phase: 'focus' as const,
      phaseIndex: 0,
      durationMs: null,
      startedAt: startedAgo(90_000),
    }
    const view = computeRoomView(room, NOW)
    expect(view.durationMs).toBeNull()
    expect(view.remainingMs).toBeNull()
    expect(view.elapsedMs).toBe(90_000)
    expect(view.isOver).toBe(false)
  })

  it('Pomodoro : déduit localement les phases enchaînées depuis la dernière réponse du serveur', () => {
    const room = {
      ...base,
      mode: 'pomodoro' as const,
      status: 'running' as const,
      phase: 'focus' as const,
      phaseIndex: 0,
      durationMs: 25 * 60_000,
      startedAt: startedAgo((25 + 5 + 10) * 60_000),
    }
    const view = computeRoomView(room, NOW)
    expect(view.phase).toBe('focus')
    expect(view.phaseIndex).toBe(2)
    expect(view.elapsedMs).toBe(10 * 60_000)
    expect(view.remainingMs).toBe(15 * 60_000)
    // Après le 2e focus (N = 2) : pause longue de 15 min.
    const long = computeRoomView(
      { ...room, startedAt: startedAgo((25 + 5 + 25 + 2) * 60_000) },
      NOW,
    )
    expect(long.phase).toBe('long_break')
    expect(long.durationMs).toBe(15 * 60_000)
  })

  it('en pause : fige sur elapsedMsAtPause, quel que soit le temps qui passe', () => {
    const room = {
      ...base,
      mode: 'pomodoro' as const,
      status: 'paused' as const,
      phase: 'focus' as const,
      phaseIndex: 0,
      durationMs: 25 * 60_000,
      startedAt: startedAgo(99 * 60_000),
      elapsedMsAtPause: 7 * 60_000,
    }
    const view = computeRoomView(room, NOW)
    expect(view.elapsedMs).toBe(7 * 60_000)
    expect(view.phaseIndex).toBe(0)
  })

  it('corrige un appareil à l’heure fausse grâce à l’écart d’horloge serveur', () => {
    const room = {
      ...base,
      mode: 'countdown' as const,
      status: 'running' as const,
      phase: 'focus' as const,
      phaseIndex: 0,
      durationMs: 25 * 60_000,
      startedAt: startedAgo(10 * 60_000),
      clockOffsetMs: 5 * 60_000, // l'appareil avance de 5 min
    }
    // Horloge locale = heure serveur + 5 min : sans correction, 15 min écoulées au lieu de 10.
    expect(computeRoomView(room, NOW + 5 * 60_000).elapsedMs).toBe(10 * 60_000)
  })

  it('lobby : durée complète annoncée, rien d’écoulé', () => {
    const room = {
      ...base,
      mode: 'pomodoro' as const,
      status: 'lobby' as const,
      phase: 'focus' as const,
      phaseIndex: 0,
      durationMs: null,
      startedAt: null,
    }
    const view = computeRoomView(room, NOW)
    expect(view.remainingMs).toBe(25 * 60_000)
    expect(view.elapsedMs).toBe(0)
  })
})

describe('groupCycleProgress — pastilles et objectif d’un salon Pomodoro (LOT M3)', () => {
  it('compte les focus terminés dans le cycle, N complets pendant la pause longue', () => {
    // N = 2 : focus(0) pause(1) focus(2) PAUSE LONGUE(3) focus(4)
    expect(groupCycleProgress(0, 'focus', 2)).toEqual({ completedInCycle: 0, completedTotal: 0 })
    expect(groupCycleProgress(1, 'short_break', 2)).toEqual({
      completedInCycle: 1,
      completedTotal: 1,
    })
    expect(groupCycleProgress(2, 'focus', 2)).toEqual({ completedInCycle: 1, completedTotal: 1 })
    expect(groupCycleProgress(3, 'long_break', 2)).toEqual({
      completedInCycle: 2,
      completedTotal: 2,
    })
    expect(groupCycleProgress(4, 'focus', 2)).toEqual({ completedInCycle: 0, completedTotal: 2 })
  })
})

describe('horloge du salon sans saut — décalage mesuré, réponses désordonnées, suspension, pause (LOT P1)', () => {
  const SERVER_START = Date.UTC(2026, 0, 15, 12, 0, 0)
  const SKEW = 3_000 // l'appareil avance de 3 s sur le serveur

  function snapshot(overrides: Partial<RoomState> = {}): RoomState {
    return {
      roomId: 'r1',
      hostId: 'h',
      status: 'running',
      focusMinutes: 25,
      mode: 'countdown',
      shortBreakMinutes: null,
      longBreakMinutes: null,
      sessionsBeforeLongBreak: null,
      phase: 'focus',
      phaseIndex: 0,
      startedAt: new Date(SERVER_START).toISOString(),
      durationMs: 25 * 60_000,
      elapsedMsAtPause: null,
      createdAt: new Date(SERVER_START).toISOString(),
      endedAt: null,
      clockOffsetMs: SKEW,
      updatedAt: null,
      participants: [],
      ...overrides,
    }
  }

  /** Heure locale (appareil, en avance de SKEW) à t ms après le début de la phase serveur. */
  const local = (tMs: number) => SERVER_START + SKEW + tMs

  it('RTT variable de 50 ms à 20 s : le temps restant ne remonte jamais d’un rendu au suivant', () => {
    const clock = new ServerClock()
    let displayed: RoomState | null = null
    let previousRemaining = Number.POSITIVE_INFINITY
    // Chaque réponse arrive avec un aller-retour différent : l'estimation brute varie de plusieurs
    // secondes (ancienne mesure naïve = latence de retour), l'affichage doit rester monotone.
    const rtts = [50, 20_000, 400, 9_000, 120, 15_000, 3_000, 80, 6_000]
    rtts.forEach((rtt, index) => {
      const arrival = local(60_000 + index * 20_000)
      const sentAt = arrival - rtt
      const serverNowMs = SERVER_START + (sentAt - SKEW) + rtt / 2 + (index % 2 === 0 ? 0 : rtt / 3)
      const offset = clock.addExchange({ sentAt, receivedAt: arrival, perfRttMs: rtt, serverNowMs })
      displayed = reconcileRoomClock(displayed, snapshot({ clockOffsetMs: offset }), arrival)
      for (let step = 0; step <= 20_000; step += 250) {
        const remaining = computeRoomView(displayed, arrival + step).remainingMs as number
        expect(remaining).toBeLessThanOrEqual(previousRemaining)
        previousRemaining = remaining
      }
    })
  })

  it('un recalage de moins d’une seconde est absorbé : aucun changement visible', () => {
    const first = reconcileRoomClock(null, snapshot({ clockOffsetMs: SKEW }), local(60_000))
    const before = computeRoomView(first, local(61_000)).remainingMs
    const second = reconcileRoomClock(first, snapshot({ clockOffsetMs: SKEW + 800 }), local(61_000))
    expect(computeRoomView(second, local(61_000)).remainingMs).toBe(before)
    expect(computeRoomView(second, local(90_000)).remainingMs).toBe(
      computeRoomView(first, local(90_000)).remainingMs,
    )
  })

  it('un grand recalage est résorbé progressivement (jamais de remontée du temps restant)', () => {
    const first = reconcileRoomClock(null, snapshot({ clockOffsetMs: SKEW }), local(60_000))
    // Nouvelle estimation 6 s plus haut : brute, le temps restant ferait un bond de +6 s.
    const second = reconcileRoomClock(
      first,
      snapshot({ clockOffsetMs: SKEW + 6_000 }),
      local(61_000),
    )
    let previous = computeRoomView(second, local(61_000)).remainingMs as number
    expect(previous).toBe(computeRoomView(first, local(61_000)).remainingMs)
    for (let t = 61_250; t <= 90_000; t += 250) {
      const remaining = computeRoomView(second, local(t)).remainingMs as number
      expect(remaining).toBeLessThanOrEqual(previous)
      previous = remaining
    }
  })

  it('une nouvelle phase (autre état du serveur) prend la nouvelle estimation sans lissage', () => {
    const first = reconcileRoomClock(null, snapshot({ clockOffsetMs: SKEW }), local(60_000))
    const paused = reconcileRoomClock(
      first,
      snapshot({ status: 'paused', elapsedMsAtPause: 60_000, clockOffsetMs: SKEW + 6_000 }),
      local(61_000),
    )
    expect(paused.clockOffsetMs).toBe(SKEW + 6_000)
    expect(paused.clockResidualMs).toBe(0)
  })

  it('onglet suspendu puis repris : le temps restant est exact, sans accumulation locale', () => {
    const room = reconcileRoomClock(null, snapshot(), local(60_000))
    // L'onglet dort 12 minutes (aucun rendu), puis se réveille.
    const view = computeRoomView(room, local(60_000 + 12 * 60_000))
    expect(view.elapsedMs).toBe(13 * 60_000)
    expect(view.remainingMs).toBe(12 * 60_000)
  })

  it('pause puis reprise : figé en pause, la reprise repart du temps écoulé à la pause', () => {
    const pausedState = reconcileRoomClock(
      null,
      snapshot({ status: 'paused', elapsedMsAtPause: 10 * 60_000 }),
      local(600_000),
    )
    // Quel que soit le temps qui passe (et le recalage), le temps affiché ne bouge pas.
    expect(computeRoomView(pausedState, local(700_000)).remainingMs).toBe(15 * 60_000)
    expect(computeRoomView(pausedState, local(5_000_000)).remainingMs).toBe(15 * 60_000)
    // Reprise : le serveur recule started_at de elapsed_ms_at_pause (resume_room).
    const resumeAt = local(900_000)
    const resumed = reconcileRoomClock(
      pausedState,
      snapshot({
        status: 'running',
        startedAt: new Date(resumeAt - SKEW - 10 * 60_000).toISOString(),
      }),
      resumeAt,
    )
    expect(computeRoomView(resumed, resumeAt).remainingMs).toBe(15 * 60_000)
    expect(computeRoomView(resumed, resumeAt + 5_000).remainingMs).toBe(15 * 60_000 - 5_000)
  })

  it('échantillons bruts : l’ancienne mesure naïve variait de plusieurs secondes, la nouvelle non', () => {
    const naive = (rtt: number) => {
      const sentAt = 1_000_000
      const serverNow = sentAt - SKEW + rtt / 2
      return sentAt + rtt - serverNow // réception − heure serveur
    }
    expect(naive(20_000) - naive(50)).toBeGreaterThan(9_000)
    const spread = [50, 20_000, 120].map(
      (rtt) =>
        sampleFromExchange({
          sentAt: 1_000_000,
          receivedAt: 1_000_000 + rtt,
          perfRttMs: rtt,
          serverNowMs: 1_000_000 - SKEW + rtt / 2,
        }).offsetMs,
    )
    expect(Math.max(...spread) - Math.min(...spread)).toBeLessThan(1)
  })
})
