import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const channelMock = vi.fn()
const removeChannelMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    channel: (...args: unknown[]) => channelMock(...args),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
  },
}))

function makeFakeChannel() {
  const channel = { on: vi.fn(), subscribe: vi.fn() }
  channel.on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)
  return channel
}

beforeEach(() => {
  channelMock.mockReset()
  removeChannelMock.mockReset()
})

describe('useRoomRealtime — abonnement à un salon (LOT F3)', () => {
  it('ne crée aucun canal sans roomId', async () => {
    const { useRoomRealtime } = await import('./useRoomRealtime')
    renderHook(() => useRoomRealtime(null, vi.fn(), true, 'u1'))

    expect(channelMock).not.toHaveBeenCalled()
  })

  it('s’abonne à rooms et room_participants filtrés, plus à une présence en base', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const { useRoomRealtime } = await import('./useRoomRealtime')
    renderHook(() => useRoomRealtime('r1', vi.fn(), true, 'u1'))

    expect(channelMock).toHaveBeenCalledWith('room-r1', { config: { presence: { key: 'u1' } } })
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ event: '*', schema: 'public', table: 'rooms', filter: 'id=eq.r1' }),
      expect.any(Function),
    )
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'room_participants',
        filter: 'room_id=eq.r1',
      }),
      expect.any(Function),
    )
    expect(channel.on).toHaveBeenCalledWith('presence', { event: 'sync' }, expect.any(Function))
  })

  it('transmet un évènement « room » avec sa version, « participants » sans version', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const onEvent = vi.fn()
    const { useRoomRealtime } = await import('./useRoomRealtime')
    renderHook(() => useRoomRealtime('r1', onEvent, true, 'u1'))

    const roomHandler = channel.on.mock.calls[0][2] as (payload: unknown) => void
    roomHandler({ new: { updated_at: '2026-01-01T00:00:05Z' } })
    expect(onEvent).toHaveBeenLastCalledWith({ kind: 'room', version: '2026-01-01T00:00:05Z' })

    const participantsHandler = channel.on.mock.calls[1][2] as () => void
    participantsHandler()
    expect(onEvent).toHaveBeenLastCalledWith({ kind: 'participants' })
  })

  it('se déclare dans Presence à chaque SUBSCRIBED et expose les présents', async () => {
    const channel = makeFakeChannel() as ReturnType<typeof makeFakeChannel> & {
      track: ReturnType<typeof vi.fn>
      presenceState: ReturnType<typeof vi.fn>
      statusCallback?: (status: string) => void
    }
    channel.track = vi.fn()
    channel.presenceState = vi.fn().mockReturnValue({ u1: [{}], u2: [{}] })
    channel.subscribe.mockImplementation((cb: (status: string) => void) => {
      channel.statusCallback = cb
      return channel
    })
    channelMock.mockReturnValue(channel)
    const { useRoomRealtime } = await import('./useRoomRealtime')
    const { result } = renderHook(() => useRoomRealtime('r1', vi.fn(), true, 'u1'))

    expect(result.current.presentUserIds).toBeNull() // aucune synchronisation encore : repli sur la base
    act(() => channel.statusCallback?.('SUBSCRIBED'))
    expect(channel.track).toHaveBeenCalledTimes(1)

    const syncHandler = channel.on.mock.calls.find(
      (call) => call[0] === 'presence',
    )?.[2] as () => void
    act(() => syncHandler())
    expect([...(result.current.presentUserIds ?? [])].sort()).toEqual(['u1', 'u2'])
  })

  it('un évènement de resynchronisation (retour au premier plan, filet) arrive en « resync »', async () => {
    vi.useFakeTimers()
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const onEvent = vi.fn()
    const { useRoomRealtime } = await import('./useRoomRealtime')
    renderHook(() => useRoomRealtime('r1', onEvent, true, 'u1'))

    // Canal jamais SUBSCRIBED : repli par interrogation à 4 s.
    act(() => void vi.advanceTimersByTime(4_000))
    expect(onEvent).toHaveBeenCalledWith({ kind: 'resync' })
    vi.useRealTimers()
  })

  it('nettoie le canal au démontage', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const { useRoomRealtime } = await import('./useRoomRealtime')
    const { unmount } = renderHook(() => useRoomRealtime('r1', vi.fn(), true))

    unmount()

    expect(removeChannelMock).toHaveBeenCalledWith(channel)
  })
})
