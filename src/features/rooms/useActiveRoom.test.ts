import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
const showToastMock = vi.fn()
const getRoomStateMock = vi.fn()
const startRoomMock = vi.fn()
const pauseRoomMock = vi.fn()
const resumeRoomMock = vi.fn()
const endRoomMock = vi.fn()
const leaveRoomMock = vi.fn()
const transferHostMock = vi.fn()
const inviteToRoomMock = vi.fn()
const useRoomRealtimeMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('@/shared/toast', () => ({ useToast: () => ({ showToast: showToastMock }) }))
vi.mock('./useRoomRealtime', () => ({
  useRoomRealtime: (...args: unknown[]) => useRoomRealtimeMock(...args),
}))
vi.mock('./rooms-repository', () => ({
  getRoomState: (...args: unknown[]) => getRoomStateMock(...args),
  startRoom: (...args: unknown[]) => startRoomMock(...args),
  pauseRoom: (...args: unknown[]) => pauseRoomMock(...args),
  resumeRoom: (...args: unknown[]) => resumeRoomMock(...args),
  endRoom: (...args: unknown[]) => endRoomMock(...args),
  leaveRoom: (...args: unknown[]) => leaveRoomMock(...args),
  transferHost: (...args: unknown[]) => transferHostMock(...args),
  inviteToRoom: (...args: unknown[]) => inviteToRoomMock(...args),
}))

const ROOM = {
  roomId: 'r1',
  hostId: 'host-1',
  status: 'lobby' as const,
  focusMinutes: 25,
  mode: 'countdown' as const,
  shortBreakMinutes: null,
  longBreakMinutes: null,
  sessionsBeforeLongBreak: null,
  phase: 'focus' as const,
  phaseIndex: 0,
  clockOffsetMs: 0,
  updatedAt: '2026-01-01T00:00:10Z',
  startedAt: null,
  durationMs: null,
  elapsedMsAtPause: null,
  createdAt: '2026-01-01T00:00:00Z',
  endedAt: null,
  participants: [],
}

/** Promesse résolue à la main, pour maîtriser l'ordre d'arrivée des réponses. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Dernier gestionnaire d'évènements Realtime donné à useRoomRealtime. */
function lastRealtimeHandler() {
  const calls = useRoomRealtimeMock.mock.calls
  return calls[calls.length - 1][1] as (event: { kind: string; version?: string | null }) => void
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ status: 'authenticated', user: { id: 'host-1' } })
  showToastMock.mockReset()
  useRoomRealtimeMock.mockReset().mockReturnValue({ presentUserIds: null })
  getRoomStateMock.mockReset().mockResolvedValue(ROOM)
  startRoomMock.mockReset().mockResolvedValue(undefined)
  pauseRoomMock.mockReset().mockResolvedValue(undefined)
  resumeRoomMock.mockReset().mockResolvedValue(undefined)
  endRoomMock.mockReset().mockResolvedValue(undefined)
  leaveRoomMock.mockReset().mockResolvedValue(undefined)
  transferHostMock.mockReset().mockResolvedValue(undefined)
  inviteToRoomMock.mockReset().mockResolvedValue(1)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useActiveRoom — salon ouvert (LOT F3)', () => {
  it('charge l’état du salon au montage', async () => {
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))

    await waitFor(() => expect(result.current.room).toMatchObject(ROOM))
    expect(getRoomStateMock).toHaveBeenCalledWith('r1')
  })

  it('ne charge rien sans roomId', async () => {
    const { useActiveRoom } = await import('./useActiveRoom')
    renderHook(() => useActiveRoom(null))

    await Promise.resolve()
    expect(getRoomStateMock).not.toHaveBeenCalled()
  })

  it('isHost reflète si l’utilisateur courant est l’hôte du salon', async () => {
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))

    await waitFor(() => expect(result.current.isHost).toBe(true))
  })

  it('isHost est faux pour un participant non hôte', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', user: { id: 'member-1' } })
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))

    await waitFor(() => expect(result.current.room).toMatchObject(ROOM))
    expect(result.current.isHost).toBe(false)
  })

  it('start appelle startRoom puis recharge l’état', async () => {
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    getRoomStateMock.mockClear()

    await act(async () => {
      await result.current.start()
    })

    expect(startRoomMock).toHaveBeenCalledWith('r1')
    expect(getRoomStateMock).toHaveBeenCalledWith('r1')
  })

  it('affiche une erreur et ne casse pas si une action échoue', async () => {
    const { RoomsError } = await import('./rooms-errors')
    pauseRoomMock.mockRejectedValue(new RoomsError('Le salon n’est pas en cours'))
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let ok = true
    await act(async () => {
      ok = await result.current.pause()
    })

    expect(ok).toBe(false)
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: 'Le salon n’est pas en cours' }),
    )
  })

  it('transfer transmet le nouvel hôte', async () => {
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.transfer('member-1')
    })

    expect(transferHostMock).toHaveBeenCalledWith('r1', 'member-1')
  })

  it('tick local toutes les secondes uniquement pendant que le salon tourne', async () => {
    vi.useFakeTimers()
    getRoomStateMock.mockResolvedValue({
      ...ROOM,
      status: 'running',
      startedAt: new Date().toISOString(),
      durationMs: 60_000,
    })
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    const firstNow = result.current.nowMs

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(result.current.nowMs).toBeGreaterThan(firstNow)
  })
})

describe('useActiveRoom — synchronisation : séquencement, chargement unique, évènements (LOT P1)', () => {
  it('un seul chargement à la fois : les demandes pendant un chargement en cours sont coalescées en UN seul rejeu', async () => {
    const first = deferred<typeof ROOM>()
    getRoomStateMock.mockReset().mockReturnValueOnce(first.promise).mockResolvedValue(ROOM)
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(getRoomStateMock).toHaveBeenCalledTimes(1))

    // 5 évènements bruts pendant le chargement initial.
    act(() => {
      for (let i = 0; i < 5; i += 1) lastRealtimeHandler()({ kind: 'resync' })
    })
    expect(getRoomStateMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      first.resolve(ROOM)
      await first.promise
    })
    await waitFor(() => expect(getRoomStateMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(getRoomStateMock).toHaveBeenCalledTimes(2)
  })

  it('ignore la réponse d’un chargement parti avant une mise à jour optimiste (séquencement)', async () => {
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.room?.status).toBe('lobby'))

    // Un chargement part (réponse « lobby » en retard)…
    const slow = deferred<typeof ROOM>()
    getRoomStateMock
      .mockReset()
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValue({
        ...ROOM,
        status: 'running',
        startedAt: new Date().toISOString(),
        durationMs: 1_500_000,
      })
    act(() => void result.current.refresh())

    // …puis je lance la session : l'écran passe aussitôt en « running » (optimiste)…
    await act(async () => {
      await result.current.start()
    })
    await waitFor(() => expect(result.current.room?.status).toBe('running'))

    // …la vieille réponse « lobby » arrive APRÈS : elle ne doit pas ramener l'écran en arrière.
    await act(async () => {
      slow.resolve(ROOM)
      await slow.promise
    })
    expect(result.current.room?.status).toBe('running')
  })

  it('ignore un évènement de salon dont la version est déjà connue', async () => {
    const { useActiveRoom } = await import('./useActiveRoom')
    renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(getRoomStateMock).toHaveBeenCalledTimes(1))
    await act(async () => void (await Promise.resolve()))

    act(() => lastRealtimeHandler()({ kind: 'room', version: '2026-01-01T00:00:10Z' })) // = version connue
    act(() => lastRealtimeHandler()({ kind: 'room', version: '2026-01-01T00:00:05Z' })) // plus ancienne
    expect(getRoomStateMock).toHaveBeenCalledTimes(1)

    act(() => lastRealtimeHandler()({ kind: 'room', version: '2026-01-01T00:00:20Z' })) // nouvelle
    await waitFor(() => expect(getRoomStateMock).toHaveBeenCalledTimes(2))
  })

  it('ne recharge pas pour l’écho de ma propre action en cours (le rechargement qui la suit suffit)', async () => {
    const pending = deferred<void>()
    pauseRoomMock.mockReset().mockReturnValue(pending.promise)
    getRoomStateMock.mockReset().mockResolvedValue({
      ...ROOM,
      status: 'running',
      startedAt: new Date().toISOString(),
      durationMs: 60_000,
    })
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.room?.status).toBe('running'))
    getRoomStateMock.mockClear()

    act(() => void result.current.pause())
    act(() => lastRealtimeHandler()({ kind: 'room', version: '2026-01-01T00:01:00Z' }))
    act(() => lastRealtimeHandler()({ kind: 'participants' }))
    expect(getRoomStateMock).not.toHaveBeenCalled()

    await act(async () => {
      pending.resolve()
      await pending.promise
    })
    await waitFor(() => expect(getRoomStateMock).toHaveBeenCalledTimes(1))
  })
})

describe('useActiveRoom — retour utilisateur : verrou, optimiste, rollback, délai (LOT P1)', () => {
  const RUNNING = {
    ...ROOM,
    status: 'running' as const,
    startedAt: '2026-01-01T00:00:00Z',
    durationMs: 1_500_000,
  }

  it('anti-double-clic : une seule action à la fois, les clics suivants sont ignorés', async () => {
    const pending = deferred<void>()
    pauseRoomMock.mockReset().mockReturnValue(pending.promise)
    getRoomStateMock.mockReset().mockResolvedValue(RUNNING)
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.room?.status).toBe('running'))

    let second: boolean | undefined
    let third: boolean | undefined
    act(() => void result.current.pause())
    await waitFor(() => expect(result.current.pendingAction).toBe('pause'))
    await act(async () => {
      second = await result.current.pause()
      third = await result.current.end()
    })

    expect(second).toBe(false)
    expect(third).toBe(false)
    expect(pauseRoomMock).toHaveBeenCalledTimes(1)
    expect(endRoomMock).not.toHaveBeenCalled()

    await act(async () => {
      pending.resolve()
      await pending.promise
    })
    await waitFor(() => expect(result.current.pendingAction).toBeNull())
  })

  it('met l’écran à jour tout de suite (optimiste), avant la réponse du serveur', async () => {
    const pending = deferred<void>()
    pauseRoomMock.mockReset().mockReturnValue(pending.promise)
    getRoomStateMock.mockReset().mockResolvedValue(RUNNING)
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.room?.status).toBe('running'))

    act(() => void result.current.pause())
    await waitFor(() => expect(result.current.room?.status).toBe('paused'))
    expect(result.current.pendingAction).toBe('pause')

    await act(async () => {
      pending.resolve()
      await pending.promise
    })
  })

  it('rollback + toast d’erreur avec « Réessayer » si l’action échoue', async () => {
    const { RoomsError } = await import('./rooms-errors')
    pauseRoomMock
      .mockReset()
      .mockRejectedValueOnce(new RoomsError('Seul l’hôte peut mettre le salon en pause'))
    getRoomStateMock.mockReset().mockResolvedValue(RUNNING)
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.room?.status).toBe('running'))

    await act(async () => {
      await result.current.pause()
    })

    expect(result.current.room?.status).toBe('running') // revenu en arrière
    expect(result.current.actionError).toMatchObject({ action: 'pause', kind: 'server' })
    const toast = showToastMock.mock.calls[0][0]
    expect(toast).toMatchObject({ type: 'error', action: { label: 'Réessayer' } })

    // « Réessayer » relance l'action (idempotente côté serveur).
    pauseRoomMock.mockResolvedValue(undefined)
    await act(async () => {
      toast.action.onClick()
    })
    await waitFor(() => expect(pauseRoomMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.actionError).toBeNull())
  })

  it('traduit un échec réseau (« Failed to fetch ») en message français', async () => {
    pauseRoomMock.mockReset().mockRejectedValue(new TypeError('Failed to fetch'))
    getRoomStateMock.mockReset().mockResolvedValue(RUNNING)
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.room?.status).toBe('running'))

    await act(async () => {
      await result.current.pause()
    })

    expect(result.current.actionError).toMatchObject({
      kind: 'network',
      message: 'Connexion impossible. Vérifie ta connexion internet puis réessaie.',
    })
  })

  it('délai de 8 s : message clair, bouton Réessayer, verrou libéré', async () => {
    vi.useFakeTimers()
    pauseRoomMock.mockReset().mockReturnValue(new Promise(() => undefined)) // ne répond jamais
    getRoomStateMock.mockReset().mockResolvedValue(RUNNING)
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.room?.status).toBe('running')

    act(() => void result.current.pause())
    expect(result.current.pendingAction).toBe('pause')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000)
    })

    expect(result.current.pendingAction).toBeNull()
    expect(result.current.actionError).toMatchObject({
      kind: 'timeout',
      message: 'Le serveur met du temps à répondre.',
    })
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.objectContaining({ label: 'Réessayer' }) }),
    )
    // Verrou libéré : une nouvelle action est possible.
    pauseRoomMock.mockResolvedValue(undefined)
    await act(async () => {
      await result.current.pause()
    })
    expect(pauseRoomMock).toHaveBeenCalledTimes(2)
  })

  it('appelle onActionSuccess après une action réussie seulement', async () => {
    const onActionSuccess = vi.fn()
    endRoomMock.mockReset().mockResolvedValueOnce(undefined)
    getRoomStateMock.mockReset().mockResolvedValue(RUNNING)
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1', { onActionSuccess }))
    await waitFor(() => expect(result.current.room?.status).toBe('running'))

    await act(async () => {
      await result.current.end()
    })
    expect(onActionSuccess).toHaveBeenCalledWith('end')
  })
})

describe('useActiveRoom — inviter des amis après coup (LOT 5)', () => {
  it('invite transmet les amis, passe par le verrou d’action (« Envoi… ») puis recharge le salon', async () => {
    const pending = deferred<number>()
    inviteToRoomMock.mockReset().mockReturnValue(pending.promise)
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    getRoomStateMock.mockClear()

    act(() => void result.current.invite(['a', 'b']))
    await waitFor(() => expect(result.current.pendingAction).toBe('invite'))
    expect(inviteToRoomMock).toHaveBeenCalledWith('r1', ['a', 'b'])
    // Anti-double-clic : une seconde action est ignorée pendant l'envoi.
    let second: boolean | undefined
    await act(async () => {
      second = await result.current.invite(['c'])
    })
    expect(second).toBe(false)
    expect(inviteToRoomMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(2)
      await pending.promise
    })
    await waitFor(() => expect(result.current.pendingAction).toBeNull())
    await waitFor(() => expect(getRoomStateMock).toHaveBeenCalled())
  })

  it('échec : message clair avec « Réessayer », qui relance l’envoi (idempotent côté serveur)', async () => {
    inviteToRoomMock.mockReset().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { useActiveRoom } = await import('./useActiveRoom')
    const { result } = renderHook(() => useActiveRoom('r1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let ok = true
    await act(async () => {
      ok = await result.current.invite(['a'])
    })

    expect(ok).toBe(false)
    expect(result.current.actionError).toMatchObject({ action: 'invite', kind: 'network' })
    const toast = showToastMock.mock.calls[0][0]
    expect(toast.action.label).toBe('Réessayer')

    inviteToRoomMock.mockResolvedValue(1)
    await act(async () => {
      toast.action.onClick()
    })
    await waitFor(() => expect(inviteToRoomMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.actionError).toBeNull())
  })
})
