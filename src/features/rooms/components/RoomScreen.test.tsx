import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RoomScreen } from './RoomScreen'

const useActiveRoomMock = vi.fn()
vi.mock('../useActiveRoom', () => ({ useActiveRoom: (...args: unknown[]) => useActiveRoomMock(...args) }))

const ROOM = {
  roomId: 'r1',
  hostId: 'host-1',
  status: 'running' as const,
  focusMinutes: 25,
  startedAt: new Date(Date.now() - 60_000).toISOString(),
  durationMs: 1_500_000,
  elapsedMsAtPause: null,
  createdAt: '2026-01-01T00:00:00Z',
  endedAt: null,
  participants: [
    {
      userId: 'host-1',
      username: 'hote',
      displayName: 'Hôte',
      avatarUrl: null,
      avatarVersion: 0,
      role: 'host' as const,
      status: 'joined' as const,
      isPresent: true,
    },
    {
      userId: 'member-1',
      username: 'membre',
      displayName: null,
      avatarUrl: null,
      avatarVersion: 0,
      role: 'member' as const,
      status: 'joined' as const,
      isPresent: false,
    },
  ],
}

function baseActiveRoom(overrides: Record<string, unknown> = {}) {
  return {
    room: ROOM,
    isLoading: false,
    loadError: null,
    nowMs: Date.now(),
    isHost: true,
    refresh: vi.fn(),
    start: vi.fn().mockResolvedValue(true),
    pause: vi.fn().mockResolvedValue(true),
    resume: vi.fn().mockResolvedValue(true),
    end: vi.fn().mockResolvedValue(true),
    leave: vi.fn().mockResolvedValue(true),
    transfer: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

beforeEach(() => {
  useActiveRoomMock.mockReturnValue(baseActiveRoom())
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('RoomScreen — LOT F3', () => {
  it('affiche le compte à rebours et le participant hors ligne sans détail de tâche', () => {
    render(<RoomScreen roomId="r1" onClose={vi.fn()} />)

    expect(screen.getByText('Hôte')).toBeInTheDocument()
    expect(screen.getByText('membre')).toBeInTheDocument()
    expect(screen.getByText('parti')).toBeInTheDocument()
    expect(screen.queryByText(/tâche/i)).not.toBeInTheDocument()
  })

  it('affiche les contrôles hôte (pause/terminer) quand running et hôte', async () => {
    const user = userEvent.setup()
    const state = baseActiveRoom()
    useActiveRoomMock.mockReturnValue(state)
    render(<RoomScreen roomId="r1" onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Mettre en pause' }))
    expect(state.pause).toHaveBeenCalled()
  })

  it('masque les contrôles hôte pour un simple participant', () => {
    useActiveRoomMock.mockReturnValue(baseActiveRoom({ isHost: false }))
    render(<RoomScreen roomId="r1" onClose={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Mettre en pause' })).not.toBeInTheDocument()
  })

  it('quitter demande confirmation puis appelle leave et onClose', async () => {
    const user = userEvent.setup()
    const state = baseActiveRoom()
    useActiveRoomMock.mockReturnValue(state)
    const onClose = vi.fn()
    render(<RoomScreen roomId="r1" onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Quitter le salon' }))

    expect(window.confirm).toHaveBeenCalled()
    expect(state.leave).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('le bouton Fermer referme sans quitter le salon', async () => {
    const user = userEvent.setup()
    const state = baseActiveRoom()
    useActiveRoomMock.mockReturnValue(state)
    const onClose = vi.fn()
    render(<RoomScreen roomId="r1" onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(state.leave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('propose de nommer un autre hôte, jamais sur soi-même', () => {
    useActiveRoomMock.mockReturnValue(baseActiveRoom())
    render(<RoomScreen roomId="r1" onClose={vi.fn()} />)

    expect(screen.getAllByRole('button', { name: 'Nommer hôte' })).toHaveLength(1)
  })
})
