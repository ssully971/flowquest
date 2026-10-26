import { act, render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useActiveGroupRoom } from './active-room-context'
import type { ActiveGroupRoomValue } from './active-room-context'
import { ActiveRoomProvider } from './ActiveRoomProvider'
import type { MyRoom, RoomState } from './types'

const listMyRoomsMock = vi.fn()
const getRoomStateMock = vi.fn()
const leaveRoomMock = vi.fn()
const endRoomMock = vi.fn()
const setRoomPillarMock = vi.fn()
const touchMock = vi.fn()
const pullMock = vi.fn()
const reconcileMock = vi.fn()
const pauseSoloMock = vi.fn()
const notifyMock = vi.fn()
const confettiMock = vi.fn()
const channelMock = vi.fn()
const removeChannelMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ status: 'authenticated', user: { id: 'me' } }),
}))
vi.mock('@/shared/toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('@/features/pillars/active-pillar-context', () => ({
  useActivePillar: () => ({ activePillarId: 'p1', setActivePillarId: vi.fn() }),
}))
vi.mock('@/features/settings/extras-settings-context', () => ({
  useExtrasSettings: () => ({ settings: { pillarsEnabled: true } }),
}))
vi.mock('@/features/timer/timer-settings-context', () => ({
  useTimerSettings: () => ({
    settings: {
      soundEnabled: true,
      notificationsEnabled: false,
      alertSoundId: 'a',
      alertVolume: 50,
      confettiEnabled: true,
    },
  }),
}))
vi.mock('@/features/pillars/apply-session-xp', () => ({
  reconcilePillarFromServer: (...args: unknown[]) => reconcileMock(...args),
}))
vi.mock('@/features/stats/useSessionSync', () => ({
  pullRemoteFocusSessions: (...args: unknown[]) => pullMock(...args),
}))
vi.mock('@/features/timer/solo-timer-guard', () => ({
  pauseStoredSoloTimerIfRunning: () => pauseSoloMock(),
}))
vi.mock('@/features/timer/notifications', () => ({
  notifySegmentFinished: (...args: unknown[]) => notifyMock(...args),
}))
vi.mock('@/features/timer/session-end-confetti', () => ({
  fireSessionEndConfetti: () => confettiMock(),
}))
vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    channel: (...args: unknown[]) => channelMock(...args),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
  },
}))
vi.mock('./rooms-repository', () => ({
  RoomsError: class RoomsError extends Error {},
  listMyRooms: () => listMyRoomsMock(),
  getRoomState: (...args: unknown[]) => getRoomStateMock(...args),
  leaveRoom: (...args: unknown[]) => leaveRoomMock(...args),
  endRoom: (...args: unknown[]) => endRoomMock(...args),
  setRoomPillar: (...args: unknown[]) => setRoomPillarMock(...args),
  touchMyRooms: () => touchMock(),
  startRoom: vi.fn(),
  pauseRoom: vi.fn(),
  resumeRoom: vi.fn(),
  transferHost: vi.fn(),
  createRoom: vi.fn(),
  respondRoomInvite: vi.fn(),
}))

function makeChannel() {
  const channel = { on: vi.fn(), subscribe: vi.fn() }
  channel.on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)
  return channel
}

const MY_ROOM: MyRoom = {
  roomId: 'r1',
  hostId: 'host',
  hostUsername: 'hote',
  hostDisplayName: null,
  status: 'running',
  focusMinutes: 25,
  myStatus: 'joined',
  participantCount: 2,
  createdAt: '2026-01-01T10:00:00Z',
  mode: 'pomodoro',
  phase: 'focus',
  startedAt: null,
  durationMs: null,
  elapsedMsAtPause: null,
}

function roomState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    roomId: 'r1',
    hostId: 'host',
    status: 'running',
    focusMinutes: 25,
    mode: 'pomodoro',
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 4,
    phase: 'focus',
    phaseIndex: 0,
    startedAt: new Date().toISOString(),
    durationMs: 1_500_000,
    elapsedMsAtPause: null,
    createdAt: 'x',
    endedAt: null,
    clockOffsetMs: 0,
    participants: [
      { userId: 'host', username: 'hote', displayName: null, avatarUrl: null, avatarVersion: 0, role: 'host', status: 'joined', isPresent: true },
      { userId: 'me', username: 'moi', displayName: null, avatarUrl: null, avatarVersion: 0, role: 'member', status: 'joined', isPresent: true },
    ],
    ...overrides,
  }
}

// Dernière valeur du contexte, publiée depuis un effet (jamais pendant le rendu).
const probe: { latest: ActiveGroupRoomValue | null } = { latest: null }
function Probe() {
  const value = useActiveGroupRoom()
  useEffect(() => {
    probe.latest = value
  })
  return null
}

function renderProvider() {
  return render(
    <ActiveRoomProvider>
      <Probe />
    </ActiveRoomProvider>,
  )
}

beforeEach(() => {
  probe.latest = null
  for (const mock of [listMyRoomsMock, getRoomStateMock, leaveRoomMock, endRoomMock, setRoomPillarMock, touchMock, pullMock, reconcileMock, pauseSoloMock, notifyMock, confettiMock, channelMock, removeChannelMock]) {
    mock.mockReset()
  }
  listMyRoomsMock.mockResolvedValue([MY_ROOM])
  getRoomStateMock.mockResolvedValue(roomState())
  leaveRoomMock.mockResolvedValue(undefined)
  endRoomMock.mockResolvedValue(undefined)
  setRoomPillarMock.mockResolvedValue(undefined)
  touchMock.mockResolvedValue(undefined)
  pullMock.mockResolvedValue(undefined)
  reconcileMock.mockResolvedValue(undefined)
  pauseSoloMock.mockResolvedValue(undefined)
  channelMock.mockImplementation(() => makeChannel())
})

describe('ActiveRoomProvider — source unique de la session de groupe (LOT M3)', () => {
  it('sans salon rejoint : aucune session active', async () => {
    listMyRoomsMock.mockResolvedValue([{ ...MY_ROOM, myStatus: 'invited' }])
    renderProvider()
    await waitFor(() => expect(listMyRoomsMock).toHaveBeenCalled())
    expect(probe.latest?.room).toBeNull()
    expect(getRoomStateMock).not.toHaveBeenCalled()
  })

  it('charge le salon rejoint, calcule la vue et reconnaît l’hôte', async () => {
    renderProvider()
    await waitFor(() => expect(probe.latest?.room?.roomId).toBe('r1'))
    expect(probe.latest?.view?.phase).toBe('focus')
    expect(probe.latest?.isHost).toBe(false)
  })

  it('met en pause le minuteur personnel et rattache le pilier actif dès que la session devient active', async () => {
    renderProvider()
    await waitFor(() => expect(probe.latest?.room).not.toBeNull())
    expect(pauseSoloMock).toHaveBeenCalledTimes(1)
    expect(setRoomPillarMock).toHaveBeenCalledWith('r1', 'p1')
  })

  it('envoie le battement de cœur global tant qu’un salon existe', async () => {
    renderProvider()
    await waitFor(() => expect(touchMock).toHaveBeenCalled())
  })

  it('se resynchronise au retour au premier plan (iPad en veille) : état complet rechargé', async () => {
    renderProvider()
    await waitFor(() => expect(probe.latest?.room).not.toBeNull())
    getRoomStateMock.mockClear()

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(getRoomStateMock).toHaveBeenCalled())

    getRoomStateMock.mockClear()
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(getRoomStateMock).toHaveBeenCalled())
  })

  it('fin de salon : écran de fin conservé jusqu’à fermeture, confettis, rapatriement des sessions', async () => {
    renderProvider()
    await waitFor(() => expect(probe.latest?.room).not.toBeNull())

    getRoomStateMock.mockResolvedValue(roomState({ status: 'ended' }))
    listMyRoomsMock.mockResolvedValue([])
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(probe.latest?.endedRoom?.roomId).toBe('r1'))
    expect(probe.latest?.room).toBeNull()
    expect(confettiMock).toHaveBeenCalledTimes(1)
    expect(notifyMock).toHaveBeenCalled()
    await waitFor(() => expect(pullMock).toHaveBeenCalledWith('me'))

    act(() => probe.latest?.dismissEnded())
    await waitFor(() => expect(probe.latest?.endedRoom).toBeNull())
  })

  it('quitter : appelle le serveur, recharge mes salons et rapatrie mes sessions', async () => {
    renderProvider()
    await waitFor(() => expect(probe.latest?.room).not.toBeNull())
    listMyRoomsMock.mockClear()

    let ok = false
    await act(async () => {
      ok = (await probe.latest?.actions.leave()) ?? false
    })

    expect(ok).toBe(true)
    expect(leaveRoomMock).toHaveBeenCalledWith('r1')
    expect(listMyRoomsMock).toHaveBeenCalled()
    expect(pullMock).toHaveBeenCalledWith('me')
  })

  it('une horloge locale en avance déclenche aussitôt un rechargement (frontière de phase franchie)', async () => {
    // Phase de 1 s démarrée il y a 5 s : la vue locale a déjà avancé d'une phase.
    getRoomStateMock.mockResolvedValue(
      roomState({
        durationMs: 1000,
        focusMinutes: 1,
        startedAt: new Date(Date.now() - 5000).toISOString(),
      }),
    )
    renderProvider()
    await waitFor(() => expect(probe.latest?.room).not.toBeNull())
    // Le chargement initial + le rechargement déclenché par la frontière franchie.
    await waitFor(() => expect(getRoomStateMock.mock.calls.length).toBeGreaterThanOrEqual(2))
  })
})
