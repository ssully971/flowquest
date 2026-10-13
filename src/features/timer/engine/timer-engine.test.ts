import { describe, expect, it } from 'vitest'

import { createTimerState, getSnapshot, pause, reset, resume, settle, start } from './timer-engine'

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

  it('le chronomètre compte indéfiniment, sans restant ni fin', () => {
    const state = start(createTimerState('stopwatch', 'stopwatch', null), 0)
    const snap = getSnapshot(state, 10 * 60 * MIN)

    expect(snap.remainingMs).toBeNull()
    expect(snap.isFinished).toBe(false)
    expect(snap.elapsedMs).toBe(10 * 60 * MIN)
  })
})
