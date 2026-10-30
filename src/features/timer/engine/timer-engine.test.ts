import { describe, expect, it } from 'vitest'

import {
  applyGuard,
  confirmPresence,
  createTimerState,
  getPausedMs,
  getSnapshot,
  pause,
  reset,
  resume,
  settle,
  start,
} from './timer-engine'

const MIN = 60_000

describe('timer-engine — démarrage', () => {
  it('démarre une session : écoulé à 0, en cours, restant = durée', () => {
    const t0 = 1_000_000
    const state = start(createTimerState('pomodoro', 'focus', 25 * MIN), t0)
    const snap = getSnapshot(state, t0)

    expect(snap.status).toBe('running')
    expect(snap.elapsedMs).toBe(0)
    expect(snap.remainingMs).toBe(25 * MIN)
    expect(snap.isFinished).toBe(false)
  })
})

describe('timer-engine — pause / reprise', () => {
  it('fige la progression pendant la pause et reprend ensuite correctement', () => {
    const t0 = 1_000_000
    let state = start(createTimerState('countdown', 'countdown', 10 * MIN), t0)

    state = pause(state, t0 + 2 * MIN)
    let snap = getSnapshot(state, t0 + 2 * MIN + 5 * MIN)
    expect(snap.status).toBe('paused')
    expect(snap.elapsedMs).toBe(2 * MIN)

    state = resume(state, t0 + 2 * MIN + 5 * MIN)
    snap = getSnapshot(state, t0 + 2 * MIN + 5 * MIN + 3 * MIN)
    expect(snap.status).toBe('running')
    expect(snap.elapsedMs).toBe(5 * MIN)
    expect(snap.remainingMs).toBe(5 * MIN)
  })

  it('pause() ne fait rien si la session n’est pas en cours', () => {
    const state = createTimerState('pomodoro', 'focus', MIN)
    expect(pause(state, 500)).toBe(state)
  })

  it('resume() ne fait rien si la session n’est pas en pause', () => {
    const state = start(createTimerState('pomodoro', 'focus', MIN), 0)
    expect(resume(state, 500)).toBe(state)
  })
})

describe('timer-engine — rechargement en cours de session', () => {
  it('reconstruit la progression depuis un état sérialisé (IndexedDB/JSON)', () => {
    const t0 = 1_000_000
    const state = start(createTimerState('pomodoro', 'focus', 25 * MIN), t0)
    const reloaded = JSON.parse(JSON.stringify(state))

    const snap = getSnapshot(reloaded, t0 + 10 * MIN)
    expect(snap.status).toBe('running')
    expect(snap.elapsedMs).toBe(10 * MIN)
    expect(snap.remainingMs).toBe(15 * MIN)
  })
})

describe('timer-engine — fin pendant l’absence', () => {
  it('détecte la fin même sans rendu entre-temps, avec la vraie heure de fin', () => {
    const t0 = 1_000_000
    const durationMs = 25 * MIN
    const state = start(createTimerState('pomodoro', 'focus', durationMs), t0)
    const farLater = t0 + 3 * 60 * MIN

    const snap = getSnapshot(state, farLater)
    expect(snap.isFinished).toBe(true)
    expect(snap.status).toBe('completed')
    expect(snap.remainingMs).toBe(0)
    expect(snap.endedAt).toBe(t0 + durationMs)

    const settled = settle(state, farLater)
    expect(settled.status).toBe('completed')
  })

  it('settle() ne modifie rien si la session n’est pas terminée', () => {
    const state = start(createTimerState('pomodoro', 'focus', 25 * MIN), 0)
    expect(settle(state, 10 * MIN)).toBe(state)
  })
})

describe('timer-engine — changement d’heure', () => {
  it('ne produit pas de valeurs négatives si l’horloge système recule', () => {
    const t0 = 1_000_000
    const state = start(createTimerState('countdown', 'countdown', 5 * MIN), t0)
    const snap = getSnapshot(state, t0 - MIN)

    expect(snap.elapsedMs).toBe(0)
    expect(snap.remainingMs).toBe(5 * MIN)
  })

  it('reste exact au passage de l’heure d’été à l’heure d’hiver (epoch ms, pas d’heure murale)', () => {
    const beforeDst = new Date('2026-10-25T02:30:00.000Z').getTime()
    const afterDst = beforeDst + 25 * MIN
    const state = start(createTimerState('pomodoro', 'focus', 25 * MIN), beforeDst)

    const snap = getSnapshot(state, afterDst)
    expect(snap.elapsedMs).toBe(25 * MIN)
    expect(snap.isFinished).toBe(true)
  })
})

describe('timer-engine — réinitialisation et chronomètre', () => {
  it('réinitialise une session en cours', () => {
    let state = start(createTimerState('pomodoro', 'focus', 25 * MIN), 1000)
    state = pause(state, 2000)
    state = reset(state)

    expect(state.status).toBe('idle')
    expect(state.startedAt).toBeNull()
    expect(getSnapshot(state, 5000).elapsedMs).toBe(0)
  })

  it('le chronomètre compte sans restant ni fin, jusqu’à la garde anti-oubli de 4 h', () => {
    const state = start(createTimerState('stopwatch', 'stopwatch', null), 0)
    const snap = getSnapshot(state, 3 * 60 * MIN)

    expect(snap.remainingMs).toBeNull()
    expect(snap.isFinished).toBe(false)
    expect(snap.elapsedMs).toBe(3 * 60 * MIN)
    // Au-delà de 4 h sans « Je suis là », le temps est figé (voir la garde plus bas).
    expect(getSnapshot(state, 10 * 60 * MIN).elapsedMs).toBe(4 * 60 * MIN)
  })
})

describe('garde anti-oubli de 4 h — Chrono et Minuteur (applyGuard, confirmPresence)', () => {
  const T0 = 1_700_000_000_000
  const H = 3_600_000
  const stopwatch = () => start(createTimerState('stopwatch', 'stopwatch', null), T0)

  it('rien ne se passe avant 4 h de focus effectif', () => {
    const state = stopwatch()
    expect(applyGuard(state, T0 + 4 * H - 1)).toBe(state)
    expect(getSnapshot(state, T0 + 4 * H - 1)).toMatchObject({
      status: 'running',
      guardPending: false,
    })
  })

  it('fige le temps à l’instant EXACT des 4 h, quel que soit le moment où on regarde', () => {
    const state = stopwatch()
    for (const looksAt of [T0 + 4 * H, T0 + 4 * H + 1, T0 + 9 * H, T0 + 30 * H]) {
      const snapshot = getSnapshot(state, looksAt)
      expect(snapshot.elapsedMs).toBe(4 * H)
      expect(snapshot.status).toBe('paused')
      expect(snapshot.guardPending).toBe(true)
    }
    expect(applyGuard(state, T0 + 9 * H).pausedAt).toBe(T0 + 4 * H)
  })

  it('la pause automatique n’est pas une pause manuelle (pauseCount inchangé)', () => {
    const frozen = applyGuard(stopwatch(), T0 + 5 * H)
    expect(frozen.pauseCount).toBe(0)
  })

  it('« Je suis là » : l’absence est du temps de pause, le temps repart de 4 h, prochain contrôle à 8 h', () => {
    const frozen = applyGuard(stopwatch(), T0 + 4 * H)
    const confirmedAt = T0 + 6 * H // absent 2 h
    const running = confirmPresence(frozen, confirmedAt)

    expect(running.status).toBe('running')
    expect(running.pausedTotalMs).toBe(2 * H)
    expect(getSnapshot(running, confirmedAt).elapsedMs).toBe(4 * H)
    expect(getPausedMs(running, confirmedAt)).toBe(2 * H)
    // 8 h de focus effectif = 4 h + 4 h après la confirmation.
    expect(getSnapshot(running, confirmedAt + 4 * H - 1).guardPending).toBe(false)
    const second = getSnapshot(running, confirmedAt + 4 * H)
    expect(second.guardPending).toBe(true)
    expect(second.elapsedMs).toBe(8 * H)
  })

  it('franchissements exacts à 4 h, 8 h puis 12 h', () => {
    let state = stopwatch()
    let now = T0
    for (const hours of [4, 8, 12]) {
      now += 4 * H
      const frozen = applyGuard(state, now + 10 * H) // on regarde bien plus tard
      expect(getSnapshot(frozen, now + 10 * H).elapsedMs).toBe(hours * H)
      state = confirmPresence(frozen, now + 10 * H)
      now += 10 * H // l'absence ne compte pas
    }
  })

  it('une pause manuelle dans l’intervalle repousse le franchissement (seul le temps effectif compte)', () => {
    let state = pause(stopwatch(), T0 + 1 * H)
    expect(state.pauseCount).toBe(1)
    state = resume(state, T0 + 3 * H) // 2 h de pause manuelle
    // Le temps effectif atteint 4 h à T0 + 6 h (pas T0 + 4 h).
    expect(applyGuard(state, T0 + 4 * H + 1)).toBe(state)
    const frozen = applyGuard(state, T0 + 7 * H)
    expect(frozen.pausedAt).toBe(T0 + 6 * H)
    expect(getSnapshot(frozen, T0 + 7 * H).elapsedMs).toBe(4 * H)
  })

  it('une pause manuelle en cours au moment des 4 h ne déclenche pas la garde', () => {
    const state = pause(stopwatch(), T0 + 3 * H)
    expect(applyGuard(state, T0 + 10 * H)).toBe(state)
    expect(getSnapshot(state, T0 + 10 * H).guardPending).toBe(false)
  })

  it('Reprendre ne relance pas un temps figé par la garde : seul « Je suis là » le fait', () => {
    const frozen = applyGuard(stopwatch(), T0 + 5 * H)
    expect(resume(frozen, T0 + 5 * H)).toBe(frozen)
  })

  it('reprise après suspension : settle reconstitue l’état figé à l’instant exact du franchissement', () => {
    const settled = settle(stopwatch(), T0 + 20 * H)
    expect(settled).toMatchObject({ status: 'paused', pausedAt: T0 + 4 * H, guardPending: true })
    // Idempotent : un second settle ne change plus rien.
    expect(settle(settled, T0 + 21 * H)).toBe(settled)
  })

  it('Terminer sans répondre : seules les heures confirmées sont comptées (4 h)', () => {
    const frozen = applyGuard(stopwatch(), T0 + 11 * H)
    expect(getSnapshot(frozen, T0 + 11 * H).elapsedMs).toBe(4 * H)
    expect(getPausedMs(frozen, T0 + 11 * H)).toBe(7 * H) // l'absence est du temps de pause
  })

  it('Minuteur plus court que 4 h : jamais concerné', () => {
    const state = start(createTimerState('countdown', 'countdown', 20 * 60_000), T0)
    expect(applyGuard(state, T0 + 30 * H)).toBe(state)
    expect(getSnapshot(state, T0 + 30 * H)).toMatchObject({
      status: 'completed',
      guardPending: false,
    })
  })

  it('Minuteur de plus de 4 h : la garde passe avant la fin naturelle', () => {
    const state = start(createTimerState('countdown', 'countdown', 6 * H), T0)
    const snapshot = getSnapshot(state, T0 + 5 * H)
    expect(snapshot).toMatchObject({ status: 'paused', guardPending: true, elapsedMs: 4 * H })
    expect(snapshot.remainingMs).toBe(2 * H)
    const resumed = confirmPresence(state, T0 + 5 * H)
    // Il reste 2 h de minuteur : la fin naturelle (6 h de focus) arrive avant la limite de 8 h.
    expect(getSnapshot(resumed, T0 + 5 * H + 2 * H)).toMatchObject({
      status: 'completed',
      guardPending: false,
    })
  })

  it('un état enregistré avant la garde (sans champs) est géré avec la limite par défaut', () => {
    const legacy = { ...stopwatch(), pauseCount: undefined, guardLimitMs: undefined }
    expect(getSnapshot(legacy, T0 + 5 * H).guardPending).toBe(true)
  })
})

describe('temps de pause et pauses manuelles (récapitulatif)', () => {
  const T0 = 1_700_000_000_000

  it('compte les pauses manuelles et additionne leur durée', () => {
    let state = start(createTimerState('stopwatch', 'stopwatch', null), T0)
    state = pause(state, T0 + 60_000)
    state = resume(state, T0 + 120_000) // 1 min de pause
    state = pause(state, T0 + 300_000)
    state = resume(state, T0 + 360_000) // 1 min de pause
    expect(state.pauseCount).toBe(2)
    expect(getPausedMs(state, T0 + 400_000)).toBe(120_000)
  })

  it('une pause en cours est comptée jusqu’à maintenant', () => {
    const state = pause(start(createTimerState('stopwatch', 'stopwatch', null), T0), T0 + 60_000)
    expect(getPausedMs(state, T0 + 100_000)).toBe(40_000)
  })

  it('un nouveau démarrage remet les compteurs à zéro', () => {
    let state = start(createTimerState('stopwatch', 'stopwatch', null), T0)
    state = pause(state, T0 + 1000)
    expect(start(state, T0 + 5000).pauseCount).toBe(0)
    expect(reset(state).pauseCount).toBe(0)
  })
})
