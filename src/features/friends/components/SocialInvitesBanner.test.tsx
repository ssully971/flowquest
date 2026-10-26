import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ActiveGroupRoomContext, INERT_ACTIVE_ROOM } from '@/features/rooms/active-room-context'
import type { ActiveGroupRoomValue } from '@/features/rooms/active-room-context'
import type { MyRoom } from '@/features/rooms/types'

import type { FriendRequest } from '../types'
import { SocialInvitesBanner } from './SocialInvitesBanner'

function myRoom(overrides: Partial<MyRoom> = {}): MyRoom {
  return {
    roomId: 'r1',
    hostId: 'h',
    hostUsername: 'hote',
    hostDisplayName: 'Hôte',
    status: 'lobby',
    focusMinutes: 25,
    myStatus: 'invited',
    participantCount: 1,
    createdAt: '2026-01-01T10:00:00Z',
    mode: 'pomodoro',
    phase: 'focus',
    startedAt: null,
    durationMs: null,
    elapsedMsAtPause: null,
    ...overrides,
  }
}

function friendRequest(overrides: Partial<FriendRequest> = {}): FriendRequest {
  return {
    friendshipId: 'f1',
    direction: 'incoming',
    createdAt: 'x',
    id: 'u9',
    username: 'amie',
    displayName: 'Amie',
    avatarUrl: null,
    avatarVersion: 0,
    ...overrides,
  } as FriendRequest
}

function setup(rooms: MyRoom[], props: Partial<React.ComponentProps<typeof SocialInvitesBanner>> = {}) {
  const respond = vi.fn().mockResolvedValue(true)
  const value: ActiveGroupRoomValue = {
    ...INERT_ACTIVE_ROOM,
    roomsState: { ...INERT_ACTIVE_ROOM.roomsState, rooms, respond },
  }
  const onJoinedRoom = vi.fn()
  const view = (extra: Partial<React.ComponentProps<typeof SocialInvitesBanner>> = {}) => (
    <ActiveGroupRoomContext.Provider value={value}>
      <SocialInvitesBanner onJoinedRoom={onJoinedRoom} {...props} {...extra} />
    </ActiveGroupRoomContext.Provider>
  )
  const utils = render(view())
  return { ...utils, respond, onJoinedRoom, view }
}

describe('SocialInvitesBanner — invitations partout sur le site (LOT M4)', () => {
  it('ne montre rien sans invitation en attente (un salon déjà rejoint n’est pas une invitation)', () => {
    setup([myRoom({ myStatus: 'joined' })])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('affiche l’invitation à un salon avec son mode, et « Rejoindre » y répond puis va à l’horloge', async () => {
    const user = userEvent.setup()
    const { respond, onJoinedRoom } = setup([myRoom()])

    expect(screen.getByText('Hôte')).toBeInTheDocument()
    expect(screen.getByText(/t’invite à un salon de focus/)).toBeInTheDocument()
    expect(screen.getByText('Pomodoro · 25 min')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Rejoindre' }))
    expect(respond).toHaveBeenCalledWith('r1', true)
    await vi.waitFor(() => expect(onJoinedRoom).toHaveBeenCalledTimes(1))
  })

  it('« Refuser » décline l’invitation sans changer d’écran', async () => {
    const user = userEvent.setup()
    const { respond, onJoinedRoom } = setup([myRoom()])
    await user.click(screen.getByRole('button', { name: 'Refuser' }))
    expect(respond).toHaveBeenCalledWith('r1', false)
    expect(onJoinedRoom).not.toHaveBeenCalled()
  })

  it('Chrono : pas de durée affichée', () => {
    setup([myRoom({ mode: 'stopwatch', focusMinutes: null })])
    expect(screen.getByText('Chrono')).toBeInTheDocument()
  })

  it('une même invitation n’apparaît qu’une fois, même après plusieurs rafraîchissements', () => {
    const { rerender, view } = setup([myRoom()])
    rerender(view())
    rerender(view())
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('« Masquer » écarte la bannière sans répondre à l’invitation', async () => {
    const user = userEvent.setup()
    const { respond } = setup([myRoom()])
    await user.click(screen.getByRole('button', { name: 'Masquer la notification' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(respond).not.toHaveBeenCalled()
  })

  it('affiche aussi les demandes d’ami entrantes : Accepter / Refuser', async () => {
    const user = userEvent.setup()
    const onAcceptFriend = vi.fn()
    const onDeclineFriend = vi.fn()
    setup([], { friendRequests: [friendRequest()], onAcceptFriend, onDeclineFriend })

    expect(screen.getByText(/t’a envoyé une demande d’ami/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Accepter' }))
    expect(onAcceptFriend).toHaveBeenCalledWith('f1')
    await user.click(screen.getByRole('button', { name: 'Refuser' }))
    expect(onDeclineFriend).toHaveBeenCalledWith('f1')
  })

  it('limite l’empilement à 3 notifications et signale les autres', () => {
    setup(
      [
        myRoom({ roomId: 'a' }),
        myRoom({ roomId: 'b' }),
        myRoom({ roomId: 'c' }),
        myRoom({ roomId: 'd' }),
        myRoom({ roomId: 'e' }),
      ],
    )
    expect(screen.getAllByRole('status')).toHaveLength(3)
    expect(screen.getByText('+2 autres notifications')).toBeInTheDocument()
  })

  it('masquée tant que le panneau social est ouvert (il liste déjà les mêmes demandes)', () => {
    setup([myRoom()], { suppressed: true })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
