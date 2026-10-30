import { describe, expect, it } from 'vitest'

import { computeRoomView } from './room-timer'
import { applyOptimistic } from './room-optimistic'
import type { RoomState } from './types'

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0)

function room(overrides: Partial<RoomState> = {}): RoomState {
  return {
    roomId: 'r1',
    hostId: 'host',
    status: 'lobby',
    focusMinutes: 25,
    mode: 'countdown',
    shortBreakMinutes: null,
    longBreakMinutes: null,
    sessionsBeforeLongBreak: null,
    phase: 'focus',
    phaseIndex: 0,
    startedAt: null,
    durationMs: null,
    elapsedMsAtPause: null,
    createdAt: new Date(NOW).toISOString(),
    endedAt: null,
    clockOffsetMs: 2_000,
    updatedAt: null,
    participants: [
      {
        userId: 'host',
        username: 'h',
        displayName: null,
        avatarUrl: null,
        avatarVersion: 0,
        role: 'host',
        status: 'joined',
        isPresent: true,
      },
      {
        userId: 'guest',
        username: 'g',
        displayName: null,
        avatarUrl: null,
        avatarVersion: 0,
        role: 'member',
        status: 'joined',
        isPresent: true,
      },
    ],
    ...overrides,
  }
}

describe('applyOptimistic — résultat attendu d’une action, appliqué tout de suite', () => {
  it('start : le salon passe en cours, l’horloge repart de zéro à l’heure serveur estimée', () => {
    const next = applyOptimistic(room(), 'start', { now: NOW, userId: 'host' })!
    expect(next.status).toBe('running')
    expect(next.durationMs).toBe(25 * 60_000)
    expect(computeRoomView(next, NOW).elapsedMs).toBe(0)
    expect(computeRoomView(next, NOW + 5_000).remainingMs).toBe(25 * 60_000 - 5_000)
  })

  it('pause : fige le temps déjà écoulé', () => {
    const running = applyOptimistic(room(), 'start', { now: NOW, userId: 'host' })!
    const paused = applyOptimistic(running, 'pause', { now: NOW + 90_000, userId: 'host' })!
    expect(paused.status).toBe('paused')
    expect(paused.elapsedMsAtPause).toBe(90_000)
    expect(computeRoomView(paused, NOW + 600_000).elapsedMs).toBe(90_000)
  })

  it('resume : repart du temps écoulé à la pause', () => {
    const running = applyOptimistic(room(), 'start', { now: NOW, userId: 'host' })!
    const paused = applyOptimistic(running, 'pause', { now: NOW + 90_000, userId: 'host' })!
    const resumed = applyOptimistic(paused, 'resume', { now: NOW + 200_000, userId: 'host' })!
    expect(resumed.status).toBe('running')
    expect(computeRoomView(resumed, NOW + 200_000).elapsedMs).toBe(90_000)
    expect(computeRoomView(resumed, NOW + 210_000).elapsedMs).toBe(100_000)
  })

  it('end : le salon est terminé', () => {
    const running = applyOptimistic(room(), 'start', { now: NOW, userId: 'host' })!
    expect(applyOptimistic(running, 'end', { now: NOW + 1_000, userId: 'host' })?.status).toBe(
      'ended',
    )
  })

  it('leave : je ne suis plus « joined », les autres ne changent pas', () => {
    const next = applyOptimistic(room(), 'leave', { now: NOW, userId: 'guest' })!
    expect(next.participants.find((p) => p.userId === 'guest')?.status).toBe('left')
    expect(next.participants.find((p) => p.userId === 'host')?.status).toBe('joined')
  })

  it('transfer : l’hôte change et les rôles s’échangent', () => {
    const next = applyOptimistic(room(), 'transfer', {
      now: NOW,
      userId: 'host',
      targetUserId: 'guest',
    })!
    expect(next.hostId).toBe('guest')
    expect(next.participants.map((p) => [p.userId, p.role])).toEqual([
      ['host', 'member'],
      ['guest', 'host'],
    ])
  })

  it('renvoie null quand l’action n’aurait aucun effet (déjà dans cet état)', () => {
    expect(
      applyOptimistic(room({ status: 'running' }), 'start', { now: NOW, userId: 'host' }),
    ).toBeNull()
    expect(applyOptimistic(room(), 'pause', { now: NOW, userId: 'host' })).toBeNull()
    expect(applyOptimistic(room(), 'resume', { now: NOW, userId: 'host' })).toBeNull()
    expect(
      applyOptimistic(room({ status: 'ended' }), 'end', { now: NOW, userId: 'host' }),
    ).toBeNull()
  })
})
