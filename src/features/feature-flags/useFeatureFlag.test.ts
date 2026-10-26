import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const channelMock = vi.fn()
const removeChannelMock = vi.fn()
const fromMock = vi.fn()
let isSupabaseConfiguredMock = true

vi.mock('@/shared/supabase/client', () => ({
  get isSupabaseConfigured() {
    return isSupabaseConfiguredMock
  },
  supabase: {
    channel: (...args: unknown[]) => channelMock(...args),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

function makeFakeChannel() {
  const channel = { on: vi.fn(), subscribe: vi.fn() }
  channel.on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)
  return channel
}

beforeEach(() => {
  window.localStorage.clear()
  isSupabaseConfiguredMock = true
  channelMock.mockReset()
  removeChannelMock.mockReset()
  fromMock.mockReset()
  channelMock.mockReturnValue(makeFakeChannel())
  vi.resetModules()
})

describe('useFeatureFlag — valeur par défaut immédiate (lot I2, §1)', () => {
  it('renvoie la valeur par défaut codée en dur avant toute réponse réseau', async () => {
    fromMock.mockReturnValue({
      select: () => new Promise(() => {}), // ne répond jamais dans ce test
    })
    const { useFeatureFlag } = await import('./useFeatureFlag')
    const { result } = renderHook(() => useFeatureFlag('maintenance'))

    expect(result.current).toBe(false) // défaut codé en dur pour « maintenance »
  })

  it('un drapeau inconnu du catalogue ne fait jamais planter (TypeScript empêche déjà la clé invalide à la compilation)', async () => {
    fromMock.mockReturnValue({ select: () => Promise.resolve({ data: [], error: null }) })
    const { useFeatureFlag } = await import('./useFeatureFlag')
    const { result } = renderHook(() => useFeatureFlag('galaxy'))
    expect(result.current).toBe(true)
  })
})

describe('useFeatureFlag — chargement réseau et panne (lot I2, §1)', () => {
  it('bascule sur la valeur lue en base une fois le premier appel résolu', async () => {
    fromMock.mockReturnValue({
      select: () => Promise.resolve({ data: [{ key: 'maintenance', enabled: true }], error: null }),
    })
    const { useFeatureFlag } = await import('./useFeatureFlag')
    const { result } = renderHook(() => useFeatureFlag('maintenance'))

    await waitFor(() => expect(result.current).toBe(true))
  })

  it('un échec réseau garde la valeur par défaut, jamais une erreur qui coupe l’app', async () => {
    fromMock.mockReturnValue({ select: () => Promise.reject(new Error('hors ligne')) })
    const { useFeatureFlag } = await import('./useFeatureFlag')
    const { result } = renderHook(() => useFeatureFlag('rooms'))

    await waitFor(() => expect(fromMock).toHaveBeenCalled())
    expect(result.current).toBe(true) // valeur par défaut de « rooms »
  })

  it('Supabase non configuré (mode invité) : garde directement les valeurs par défaut', async () => {
    isSupabaseConfiguredMock = false
    fromMock.mockReturnValue({ select: () => Promise.resolve({ data: [], error: null }) })
    const { useFeatureFlag } = await import('./useFeatureFlag')
    const { result } = renderHook(() => useFeatureFlag('cheers'))

    expect(result.current).toBe(true)
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('useFeatureFlag — mise à jour en direct (lot I2, §1)', () => {
  it('un évènement Realtime « enabled: false » coupe la fonctionnalité sans rechargement', async () => {
    const channel = makeFakeChannel()
    channelMock.mockReturnValue(channel)
    fromMock.mockReturnValue({
      select: () => Promise.resolve({ data: [{ key: 'galaxy', enabled: true }], error: null }),
    })
    const { useFeatureFlag } = await import('./useFeatureFlag')
    const { result } = renderHook(() => useFeatureFlag('galaxy'))

    await waitFor(() => expect(result.current).toBe(true))

    const handler = channel.on.mock.calls[0][2] as (payload: unknown) => void
    act(() => {
      handler({ new: { key: 'galaxy', enabled: false } })
    })

    await waitFor(() => expect(result.current).toBe(false))
  })
})
