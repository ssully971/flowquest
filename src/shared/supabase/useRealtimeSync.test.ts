import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const channelMock = vi.fn()
const removeChannelMock = vi.fn()

vi.mock('./client', () => ({
  supabase: {
    channel: (...args: unknown[]) => channelMock(...args),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
  },
}))

type StatusCallback = (status: string) => void

function makeChannel() {
  const channel = {
    on: vi.fn(),
    statusCallback: null as StatusCallback | null,
    subscribe: vi.fn((cb: StatusCallback) => {
      channel.statusCallback = cb
      return channel
    }),
  }
  channel.on.mockReturnValue(channel)
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

async function setup(options?: { safetyPollMs?: number }) {
  const channels: ReturnType<typeof makeChannel>[] = []
  channelMock.mockImplementation(() => {
    const channel = makeChannel()
    channels.push(channel)
    return channel
  })
  const onChange = vi.fn()
  const { useRealtimeSync } = await import('./useRealtimeSync')
  const view = renderHook(() => useRealtimeSync('test', () => undefined, onChange, true, options))
  return { channels, onChange, view }
}

describe('useRealtimeSync — repli et resynchronisation', () => {
  it('interroge toutes les 4 s tant que le canal n’est pas SUBSCRIBED', async () => {
    const { onChange } = await setup()
    act(() => void vi.advanceTimersByTime(12_000))
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('arrête l’interrogation une fois SUBSCRIBED (sans rechargement inutile au premier abonnement)', async () => {
    const { channels, onChange } = await setup()
    act(() => channels[0].statusCallback?.('SUBSCRIBED'))
    expect(onChange).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(20_000))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('recharge l’état dès le SUBSCRIBED qui suit une coupure (évènements manqués)', async () => {
    const { channels, onChange } = await setup()
    act(() => channels[0].statusCallback?.('SUBSCRIBED'))
    act(() => channels[0].statusCallback?.('CLOSED'))
    onChange.mockClear()
    act(() => channels[0].statusCallback?.('SUBSCRIBED'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('reprend l’interrogation si le canal échoue ou se ferme', async () => {
    const { channels, onChange } = await setup()
    act(() => channels[0].statusCallback?.('SUBSCRIBED'))
    onChange.mockClear()
    act(() => channels[0].statusCallback?.('CHANNEL_ERROR'))
    act(() => void vi.advanceTimersByTime(8_000))
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('retour réseau (online) : recharge et recrée le canal (WebSocket probablement mort)', async () => {
    const { channels, onChange } = await setup()
    act(() => channels[0].statusCallback?.('SUBSCRIBED'))
    onChange.mockClear()

    act(() => void window.dispatchEvent(new Event('online')))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(channels).toHaveLength(2)
    expect(removeChannelMock).toHaveBeenCalledTimes(1)
    act(() => channels[1].statusCallback?.('SUBSCRIBED'))
    expect(onChange).toHaveBeenCalledTimes(2) // rattrapage après reconnexion
  })

  it('focus / visibilitychange / pageshow ordinaire : recharge l’état SANS recréer un canal SUBSCRIBED', async () => {
    const { channels, onChange } = await setup()
    act(() => channels[0].statusCallback?.('SUBSCRIBED'))
    onChange.mockClear()

    act(() => void window.dispatchEvent(new Event('focus')))
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    act(() => void window.dispatchEvent(new Event('pageshow')))

    expect(onChange).toHaveBeenCalledTimes(3)
    expect(channels).toHaveLength(1)
    expect(removeChannelMock).not.toHaveBeenCalled()
  })

  it('pageshow persisté (page restaurée du cache) : recrée le canal', async () => {
    const { channels } = await setup()
    act(() => channels[0].statusCallback?.('SUBSCRIBED'))
    const event = new Event('pageshow') as PageTransitionEvent
    Object.defineProperty(event, 'persisted', { value: true })
    act(() => void window.dispatchEvent(event))
    expect(channels).toHaveLength(2)
  })

  it('au focus, recrée le canal seulement s’il n’est pas SUBSCRIBED', async () => {
    const { channels } = await setup()
    // Jamais passé SUBSCRIBED (connexion bloquée) : le focus relance la connexion.
    act(() => void window.dispatchEvent(new Event('focus')))
    expect(channels).toHaveLength(2)
    act(() => channels[1].statusCallback?.('SUBSCRIBED'))
    act(() => void window.dispatchEvent(new Event('focus')))
    expect(channels).toHaveLength(2)
  })

  it('transmet les options de canal et appelle onSubscribed à chaque SUBSCRIBED', async () => {
    const channels: ReturnType<typeof makeChannel>[] = []
    channelMock.mockImplementation(() => {
      const channel = makeChannel()
      channels.push(channel)
      return channel
    })
    const onSubscribed = vi.fn()
    const { useRealtimeSync } = await import('./useRealtimeSync')
    renderHook(() =>
      useRealtimeSync('test', () => undefined, vi.fn(), true, {
        channelOptions: { config: { presence: { key: 'u1' } } },
        onSubscribed,
      }),
    )
    expect(channelMock).toHaveBeenCalledWith('test', { config: { presence: { key: 'u1' } } })
    act(() => channels[0].statusCallback?.('SUBSCRIBED'))
    expect(onSubscribed).toHaveBeenCalledWith(channels[0])
  })

  it('ignore les rappels d’un ancien canal (pas d’interrogation fantôme)', async () => {
    const { channels, onChange } = await setup()
    act(() => void window.dispatchEvent(new Event('online')))
    act(() => channels[1].statusCallback?.('SUBSCRIBED'))
    onChange.mockClear()
    // L'ancien canal se ferme après coup : ne doit pas relancer l'interrogation.
    act(() => channels[0].statusCallback?.('CLOSED'))
    act(() => void vi.advanceTimersByTime(20_000))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ne laisse aucune interrogation après le démontage', async () => {
    const { channels, onChange, view } = await setup()
    view.unmount()
    onChange.mockClear()
    // Le nettoyage ferme le canal : son rappel CLOSED ne doit rien réarmer.
    act(() => channels[0].statusCallback?.('CLOSED'))
    act(() => void vi.advanceTimersByTime(60_000))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('filet de sécurité optionnel : interroge même quand le canal est SUBSCRIBED', async () => {
    const { channels, onChange } = await setup({ safetyPollMs: 15_000 })
    act(() => channels[0].statusCallback?.('SUBSCRIBED'))
    onChange.mockClear()
    act(() => void vi.advanceTimersByTime(30_000))
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})
