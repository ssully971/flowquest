import { describe, expect, it, vi } from 'vitest'

import { INERT_ACTIVE_ROOM } from '@/features/rooms/active-room-context'
import type { ActiveGroupRoomValue } from '@/features/rooms/active-room-context'
import type { RoomClockView } from '@/features/rooms/room-timer'
import type { RoomState } from '@/features/rooms/types'

import { buildGroupClockSource } from './clock-source'

const ROOM = {
  roomId: 'r1',
  hostId: 'host',
  mode: 'pomodoro',
  participants: [],
} as unknown as RoomState

type Overrides = Partial<Omit<ActiveGroupRoomValue, 'view'>> & { view?: Partial<RoomClockView> }

function groupValue(overrides: Overrides): ActiveGroupRoomValue {
  const actions = {
    start: vi.fn().mockResolvedValue(true),
    pause: vi.fn().mockResolvedValue(true),
    resume: vi.fn().mockResolvedValue(true),
    end: vi.fn().mockResolvedValue(true),
    leave: vi.fn().mockResolvedValue(true),
    transfer: vi.fn().mockResolvedValue(true),
  }
  const { view, ...rest } = overrides
  return {
    ...INERT_ACTIVE_ROOM,
    room: ROOM,
    isHost: true,
    actions,
    view: {
      status: 'running',
      phase: 'focus',
      phaseIndex: 2,
      durationMs: 1_500_000,
      elapsedMs: 300_000,
      remainingMs: 1_200_000,
      isOver: false,
      ...view,
    },
    ...rest,
  }
}

describe('buildGroupClockSource — l’horloge de groupe vue comme une source (LOT M3)', () => {
  it('renvoie null sans session de groupe active', () => {
    expect(buildGroupClockSource(INERT_ACTIVE_ROOM)).toBeNull()
  })

  it('expose le temps, la phase et un identifiant de début de phase', () => {
    const source = buildGroupClockSource(groupValue({}))!
    expect(source).toMatchObject({
      kind: 'group',
      mode: 'pomodoro',
      segment: 'focus',
      status: 'running',
      displayLabel: '20:00',
      phaseKey: 'r1:2',
      readOnly: false,
    })
    expect(source.progress).toBeCloseTo(0.2)
    // Une nouvelle phase = une nouvelle clé (citation de phase).
    expect(
      buildGroupClockSource(groupValue({ view: { phaseIndex: 3, phase: 'short_break' } }))!
        .phaseKey,
    ).toBe('r1:3')
  })

  it('l’hôte pilote : démarrer, mettre en pause, reprendre', () => {
    const lobby = groupValue({ view: { status: 'lobby' } })
    buildGroupClockSource(lobby)!.onPrimary()
    expect(lobby.actions.start).toHaveBeenCalled()

    const running = groupValue({})
    buildGroupClockSource(running)!.onPrimary()
    expect(running.actions.pause).toHaveBeenCalled()

    const paused = groupValue({ view: { status: 'paused' } })
    buildGroupClockSource(paused)!.onPrimary()
    expect(paused.actions.resume).toHaveBeenCalled()
  })

  it('un participant non hôte est en lecture seule : aucune action n’est envoyée', () => {
    const value = groupValue({ isHost: false })
    const source = buildGroupClockSource(value)!
    expect(source.readOnly).toBe(true)
    source.onPrimary()
    source.pause()
    source.resume()
    expect(value.actions.start).not.toHaveBeenCalled()
    expect(value.actions.pause).not.toHaveBeenCalled()
    expect(value.actions.resume).not.toHaveBeenCalled()
  })

  it('Chrono : temps écoulé, segment « stopwatch », sans progression', () => {
    const source = buildGroupClockSource(
      groupValue({
        room: { ...ROOM, mode: 'stopwatch' } as RoomState,
        view: { durationMs: null, remainingMs: null, elapsedMs: 3_725_000 },
      }),
    )!
    expect(source.isStopwatch).toBe(true)
    expect(source.segment).toBe('stopwatch')
    expect(source.displayLabel).toBe('01:02:05')
    expect(source.progress).toBe(0)
  })
})
