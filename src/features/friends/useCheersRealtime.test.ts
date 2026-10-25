import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
const channelMock = vi.fn()
const removeChannelMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
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
  useAuthMock.mockReturnValue({ user: { id: 'me' } })
  channelMock.mockReset()
  removeChannelMock.mockReset()
})

describe('useCheersRealtime — encouragements en temps réel (LOT H1)', () => {
  it('ne crée aucun canal sans utilisateur connu', async () => {
    useAuthMock.mockReturnValue({ user: null })
    const { useCheersRealtime } = await import('./useCheersRealtime')
    renderHook(() => useCheersRealtime(vi.fn(), true))

    expect(channelMock).not.toHaveBeenCalled()
  })

  it('s’abonne à cheers filtré par recipient_id', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const { useCheersRealtime } = await import('./useCheersRealtime')
    renderHook(() => useCheersRealtime(vi.fn(), true))

    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'cheers', filter: 'recipient_id=eq.me' }),
      expect.any(Function),
    )
  })

  it('appelle onChange à chaque évènement reçu', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    const onChange = vi.fn()
    const { useCheersRealtime } = await import('./useCheersRealtime')
    renderHook(() => useCheersRealtime(onChange, true))

    const handler = channel.on.mock.calls[0][2] as () => void
    handler()
    expect(onChange).toHaveBeenCalled()
  })
})
