import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TimerController } from './timer-controller'
import type { TimerStateRepository } from './storage/timer-state-repository'
import { useTimerSnapshot } from './useTimerSnapshot'

class NoopRepository implements TimerStateRepository {
  async load() {
    return null
  }
  async save() {}
  async clear() {}
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTimerSnapshot', () => {
  it('retourne null tant qu’aucun contrôleur n’est fourni', () => {
    const { result } = renderHook(() => useTimerSnapshot(null))
    expect(result.current[0]).toBeNull()
  })

  it('se rafraîchit périodiquement sans jamais décompter par tick (toujours recalculé depuis started_at)', () => {
    const t0 = 1_000_000
    vi.setSystemTime(t0)
    const controller = TimerController.createIdle(
      new NoopRepository(),
      'pomodoro',
      'focus',
      10 * 60_000,
    )
    controller.start(t0)

    const { result } = renderHook(() => useTimerSnapshot(controller))
    expect(result.current[0]?.elapsedMs).toBe(0)

    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(result.current[0]?.elapsedMs).toBe(5_000)

    act(() => {
      vi.advanceTimersByTime(7_000)
    })
    expect(result.current[0]?.elapsedMs).toBe(12_000)
  })

  it('recalcule immédiatement au retour d’onglet (visibilitychange)', () => {
    const t0 = 1_000_000
    vi.setSystemTime(t0)
    const controller = TimerController.createIdle(
      new NoopRepository(),
      'pomodoro',
      'focus',
      10 * 60_000,
    )
    controller.start(t0)

    const { result } = renderHook(() => useTimerSnapshot(controller))

    vi.setSystemTime(t0 + 90_000)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current[0]?.elapsedMs).toBe(90_000)
  })
})
