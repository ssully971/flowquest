import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ActiveGroupRoomContext, INERT_ACTIVE_ROOM } from '../active-room-context'
import type { ActiveGroupRoomValue } from '../active-room-context'
import type { RoomClockView } from '../room-timer'
import type { RoomState } from '../types'
import { GroupSessionFab } from './GroupSessionFab'

function room(overrides: Partial<RoomState> = {}): RoomState {
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
    startedAt: null,
    durationMs: 1_500_000,
    elapsedMsAtPause: null,
    createdAt: 'x',
    endedAt: null,
    clockOffsetMs: 0,
    participants: [
      { userId: 'a', username: 'a', displayName: null, avatarUrl: null, avatarVersion: 0, role: 'host', status: 'joined', isPresent: true },
      { userId: 'b', username: 'b', displayName: null, avatarUrl: null, avatarVersion: 0, role: 'member', status: 'joined', isPresent: true },
      { userId: 'c', username: 'c', displayName: null, avatarUrl: null, avatarVersion: 0, role: 'member', status: 'invited', isPresent: false },
    ],
    ...overrides,
  }
}

function view(overrides: Partial<RoomClockView> = {}): RoomClockView {
  return {
    status: 'running',
    phase: 'focus',
    phaseIndex: 0,
    durationMs: 1_500_000,
    elapsedMs: 300_000,
    remainingMs: 1_200_000,
    isOver: false,
    ...overrides,
  }
}

function renderFab(value: Partial<ActiveGroupRoomValue>, onReturn = vi.fn()) {
  render(
    <ActiveGroupRoomContext.Provider value={{ ...INERT_ACTIVE_ROOM, ...value }}>
      <GroupSessionFab onReturn={onReturn} />
    </ActiveGroupRoomContext.Provider>,
  )
  return onReturn
}

describe('GroupSessionFab — bouton flottant « Session en cours » (LOT M3)', () => {
  it('ne s’affiche pas sans session de groupe active', () => {
    renderFab({})
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('affiche le temps restant et le nombre de participants présents, et ramène à l’horloge', async () => {
    const user = userEvent.setup()
    const onReturn = renderFab({ room: room(), view: view() })

    const button = screen.getByRole('button', { name: /Revenir à la session de groupe en cours/ })
    expect(button).toHaveTextContent('20:00')
    expect(button).toHaveAccessibleName(/2 participants/)
    await user.click(button)
    expect(onReturn).toHaveBeenCalledTimes(1)
  })

  it('Chrono : affiche le temps écoulé', () => {
    renderFab({
      room: room({ mode: 'stopwatch' }),
      view: view({ durationMs: null, remainingMs: null, elapsedMs: 125_000 }),
    })
    expect(screen.getByRole('button')).toHaveTextContent('02:05')
  })

  it('salon en attente : indique l’attente de l’hôte', () => {
    renderFab({ room: room({ status: 'lobby' }), view: view({ status: 'lobby', remainingMs: 1_500_000 }) })
    expect(screen.getByRole('button')).toHaveTextContent('En attente de l’hôte')
  })
})
