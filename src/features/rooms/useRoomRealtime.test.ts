import { renderHook } from '@testing-library/react'
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
    renderHook(() => useRoomRealtime(null, vi.fn(), true))

    expect(channelMock).not.toHaveBeenCalled()
  })

  it('s’abonne à rooms et room_participants filtrés par roomId', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const { useRoomRealtime } = await import('./useRoomRealtime')
    renderHook(() => useRoomRealtime('r1', vi.fn(), true))

    expect(channelMock).toHaveBeenCalledWith('room-r1')
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
  })

  it('appelle onChange à chaque évènement reçu', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const onChange = vi.fn()
    const { useRoomRealtime } = await import('./useRoomRealtime')
    renderHook(() => useRoomRealtime('r1', onChange, true))

    const handler = channel.on.mock.calls[0][2] as () => void
    handler()

    expect(onChange).toHaveBeenCalled()
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
