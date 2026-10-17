import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useUsernameAvailability } from './useUsernameAvailability'

const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

beforeEach(() => {
  rpcMock.mockReset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useUsernameAvailability — vérification en direct (LOT 1)', () => {
  it('reste idle tant que désactivé (format invalide)', () => {
    const { result } = renderHook(() => useUsernameAvailability('ab', false))
    expect(result.current).toBe('idle')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('passe par checking puis available, après le délai de debounce', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null })
    const { result } = renderHook(() => useUsernameAvailability('sullivan_97', true))
    expect(result.current).toBe('checking')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(result.current).toBe('available')
    expect(rpcMock).toHaveBeenCalledWith('is_username_available', { p_username: 'sullivan_97' })
  })

  it('renvoie taken quand le RPC répond false', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null })
    const { result } = renderHook(() => useUsernameAvailability('sullivan_97', true))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(result.current).toBe('taken')
  })

  it('ignore une réponse périmée quand la saisie a changé entre-temps', async () => {
    let resolveFirst: ((value: { data: boolean; error: null }) => void) | undefined
    rpcMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    rpcMock.mockResolvedValueOnce({ data: false, error: null })

    const { result, rerender } = renderHook(
      ({ username }: { username: string }) => useUsernameAvailability(username, true),
      { initialProps: { username: 'premier' } },
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    // La requête pour "premier" est maintenant en vol (pas encore résolue).

    rerender({ username: 'second' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(result.current).toBe('taken')

    // La première requête (pour "premier") répond après coup : elle doit être ignorée.
    await act(async () => {
      resolveFirst?.({ data: true, error: null })
      await Promise.resolve()
    })
    expect(result.current).toBe('taken')
  })
})
