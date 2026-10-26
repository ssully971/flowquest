import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RoomCard } from './RoomCard'

const BASE_ROOM = {
  roomId: 'r1',
  hostId: 'u1',
  hostUsername: 'hote',
  hostDisplayName: 'Hôte',
  status: 'lobby' as const,
  focusMinutes: 25,
  myStatus: 'invited' as const,
  participantCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  mode: 'countdown' as const,
  phase: 'focus' as const,
  startedAt: null,
  durationMs: null,
  elapsedMsAtPause: null,
}

describe('RoomCard — LOT F3', () => {
  it('affiche Accepter/Refuser pour une invitation en attente', async () => {
    const user = userEvent.setup()
    const onAccept = vi.fn()
    const onDecline = vi.fn()
    render(<RoomCard room={BASE_ROOM} onAccept={onAccept} onDecline={onDecline} onJoin={vi.fn()} />)

    expect(screen.getByText(/Hôte/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Accepter' }))
    expect(onAccept).toHaveBeenCalledWith('r1')

    await user.click(screen.getByRole('button', { name: 'Refuser' }))
    expect(onDecline).toHaveBeenCalledWith('r1')
  })

  it('affiche Rejoindre pour un salon déjà rejoint', async () => {
    const user = userEvent.setup()
    const onJoin = vi.fn()
    render(
      <RoomCard
        room={{ ...BASE_ROOM, myStatus: 'joined', status: 'running' }}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        onJoin={onJoin}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Accepter' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rejoindre' }))
    expect(onJoin).toHaveBeenCalledWith('r1')
  })
})
