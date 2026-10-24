import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const channelMock = vi.fn()
const removeChannelMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    channel: (...args: unknown[]) => channelMock(...args),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
  },
}))

function makeFakeChannel() {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  }
  // Comme le vrai RealtimeChannel de supabase-js : .on() et .subscribe() renvoient tous
  // les deux l'instance elle-même, pour permettre le chaînage .channel().on().subscribe().
  channel.on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)
  return channel
}

beforeEach(() => {
  vi.useFakeTimers()
  channelMock.mockReset()
  removeChannelMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useFriendsRealtime — abonnement au statut des amis, reconnexion, repli (LOT F2)', () => {
  it('ne crée aucun canal quand enabled est faux', async () => {
    const { useFriendsRealtime } = await import('./useFriendsRealtime')
    renderHook(() => useFriendsRealtime(vi.fn(), false))

    expect(channelMock).not.toHaveBeenCalled()
  })

  it('s’abonne à live_status au montage quand enabled est vrai', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const { useFriendsRealtime } = await import('./useFriendsRealtime')
    renderHook(() => useFriendsRealtime(vi.fn(), true))

    expect(channelMock).toHaveBeenCalledWith(expect.stringMatching(/^live-status-friends-/))
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ event: '*', schema: 'public', table: 'live_status' }),
      expect.any(Function),
    )
    expect(channel.subscribe).toHaveBeenCalled()
  })

  it('appelle onChange à chaque évènement reçu sur le canal', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const onChange = vi.fn()
    const { useFriendsRealtime } = await import('./useFriendsRealtime')
    renderHook(() => useFriendsRealtime(onChange, true))

    const eventHandler = channel.on.mock.calls[0][2] as () => void
    eventHandler()

    expect(onChange).toHaveBeenCalled()
  })

  it('retombe sur une interrogation toutes les 30 s si le canal n’est pas SUBSCRIBED', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const onChange = vi.fn()
    const { useFriendsRealtime } = await import('./useFriendsRealtime')
    renderHook(() => useFriendsRealtime(onChange, true))

    const subscribeCallback = channel.subscribe.mock.calls[0][0] as (status: string) => void
    subscribeCallback('CHANNEL_ERROR')

    vi.advanceTimersByTime(31_000)
    expect(onChange).toHaveBeenCalled()
  })

  it('n’interroge pas quand le canal est bien SUBSCRIBED', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const onChange = vi.fn()
    const { useFriendsRealtime } = await import('./useFriendsRealtime')
    renderHook(() => useFriendsRealtime(onChange, true))

    const subscribeCallback = channel.subscribe.mock.calls[0][0] as (status: string) => void
    subscribeCallback('SUBSCRIBED')

    vi.advanceTimersByTime(31_000)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('nettoie le canal au démontage', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const { useFriendsRealtime } = await import('./useFriendsRealtime')
    const { unmount } = renderHook(() => useFriendsRealtime(vi.fn(), true))

    unmount()

    expect(removeChannelMock).toHaveBeenCalledWith(channel)
  })

  it('se reconnecte et rafraîchit immédiatement quand l’onglet redevient visible', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const onChange = vi.fn()
    const { useFriendsRealtime } = await import('./useFriendsRealtime')
    renderHook(() => useFriendsRealtime(onChange, true))
    onChange.mockClear()
    channelMock.mockClear()

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(onChange).toHaveBeenCalled()
    expect(channelMock).toHaveBeenCalledWith(expect.stringMatching(/^live-status-friends-/))
  })
})
