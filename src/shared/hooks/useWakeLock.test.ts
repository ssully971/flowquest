import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useWakeLock } from './useWakeLock'

describe('useWakeLock — empêche la mise en veille tant que activé (§5.4 et §7.6)', () => {
  const originalWakeLock = (navigator as unknown as { wakeLock?: unknown }).wakeLock

  afterEach(() => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: originalWakeLock,
      configurable: true,
    })
  })

  it('signale l’absence de support quand l’API Wake Lock n’existe pas', () => {
    Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true })
    const { result } = renderHook(() => useWakeLock(true))
    expect(result.current.isSupported).toBe(false)
  })

  it('demande un verrou à l’activation et le relâche quand désactivé ou démonté', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ released: false, release })
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })

    const { result, rerender, unmount } = renderHook(({ enabled }) => useWakeLock(enabled), {
      initialProps: { enabled: true },
    })
    expect(result.current.isSupported).toBe(true)
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'))

    rerender({ enabled: false })
    await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(1))

    request.mockClear()
    rerender({ enabled: true })
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))

    unmount()
    await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(2))
  })

  it('ne demande aucun verrou tant que désactivé', () => {
    const request = vi.fn().mockResolvedValue({ released: false, release: vi.fn() })
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })

    renderHook(() => useWakeLock(false))
    expect(request).not.toHaveBeenCalled()
  })
})
