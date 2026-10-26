import { describe, expect, it } from 'vitest'

import { pickActiveRoom } from './active-room'
import type { MyRoom } from './types'

function room(overrides: Partial<MyRoom>): MyRoom {
  return {
    roomId: 'r',
    hostId: 'h',
    hostUsername: 'h',
    hostDisplayName: null,
    status: 'lobby',
    focusMinutes: 25,
    myStatus: 'joined',
    participantCount: 2,
    createdAt: '2026-01-01T10:00:00Z',
    mode: 'countdown',
    phase: 'focus',
    startedAt: null,
    durationMs: null,
    elapsedMsAtPause: null,
    ...overrides,
  }
}

describe('pickActiveRoom — quel salon prend la place de l’horloge solo (LOT M3)', () => {
  it('ignore les invitations non acceptées et les salons terminés', () => {
    expect(pickActiveRoom([room({ myStatus: 'invited' }), room({ status: 'ended' })])).toBeNull()
  })

  it('un salon en attente compte (« En attente de l’hôte »)', () => {
    expect(pickActiveRoom([room({ roomId: 'a', status: 'lobby' })])?.roomId).toBe('a')
  })

  it('préfère le salon qui tourne, puis en pause, puis en attente', () => {
    const rooms = [
      room({ roomId: 'lobby', status: 'lobby' }),
      room({ roomId: 'paused', status: 'paused' }),
      room({ roomId: 'running', status: 'running' }),
    ]
    expect(pickActiveRoom(rooms)?.roomId).toBe('running')
    expect(pickActiveRoom(rooms.slice(0, 2))?.roomId).toBe('paused')
  })

  it('à statut égal, le plus récent', () => {
    const rooms = [
      room({ roomId: 'old', createdAt: '2026-01-01T09:00:00Z' }),
      room({ roomId: 'new', createdAt: '2026-01-01T11:00:00Z' }),
    ]
    expect(pickActiveRoom(rooms)?.roomId).toBe('new')
  })
})
