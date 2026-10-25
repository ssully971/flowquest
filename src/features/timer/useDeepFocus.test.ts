import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDeepFocus } from './useDeepFocus'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  vi.useRealTimers()
  setVisibility('visible')
})

describe('useDeepFocus — pause rétroactive au passage en arrière-plan (LOT G2)', () => {
  it('ne fait rien quand enabled est faux', () => {
    vi.useFakeTimers()
    const onPause = vi.fn()
    const onPausedWhileAway = vi.fn()
    renderHook(() =>
      useDeepFocus({ enabled: false, graceMs: 5000, isRunning: () => true, onPause, onPausedWhileAway }),
    )

    setVisibility('hidden')
    vi.advanceTimersByTime(10_000)
    setVisibility('visible')

    expect(onPause).not.toHaveBeenCalled()
    expect(onPausedWhileAway).not.toHaveBeenCalled()
  })

  it('ne fait rien quand la session n’est pas en cours (déjà en pause) au moment du passage en arrière-plan', () => {
    vi.useFakeTimers()
    const onPause = vi.fn()
    const onPausedWhileAway = vi.fn()
    renderHook(() =>
      useDeepFocus({ enabled: true, graceMs: 5000, isRunning: () => false, onPause, onPausedWhileAway }),
    )

    setVisibility('hidden')
    vi.advanceTimersByTime(10_000)
    setVisibility('visible')

    expect(onPause).not.toHaveBeenCalled()
    expect(onPausedWhileAway).not.toHaveBeenCalled()
  })

  it('pardonne un aller-retour plus court que le délai de grâce', () => {
    vi.useFakeTimers()
    const onPause = vi.fn()
    const onPausedWhileAway = vi.fn()
    renderHook(() =>
      useDeepFocus({ enabled: true, graceMs: 5000, isRunning: () => true, onPause, onPausedWhileAway }),
    )

    setVisibility('hidden')
    vi.advanceTimersByTime(2000)
    setVisibility('visible')

    expect(onPause).not.toHaveBeenCalled()
    expect(onPausedWhileAway).not.toHaveBeenCalled()
  })

  it('déclenche la pause (horodatage du départ) si le délai s’écoule pendant que l’onglet reste caché', () => {
    vi.useFakeTimers()
    const onPause = vi.fn()
    const onPausedWhileAway = vi.fn()
    renderHook(() =>
      useDeepFocus({ enabled: true, graceMs: 5000, isRunning: () => true, onPause, onPausedWhileAway }),
    )

    const hiddenAt = Date.now()
    setVisibility('hidden')
    vi.advanceTimersByTime(5000)

    expect(onPause).toHaveBeenCalledWith(hiddenAt)
    expect(onPausedWhileAway).not.toHaveBeenCalled()

    setVisibility('visible')
    expect(onPausedWhileAway).toHaveBeenCalledTimes(1)
    expect(onPause).toHaveBeenCalledTimes(1)
  })

  it('détecte un dépassement même si le minuteur ne s’est jamais déclenché (iOS gelé en arrière-plan)', () => {
    vi.useFakeTimers()
    const onPause = vi.fn()
    const onPausedWhileAway = vi.fn()
    renderHook(() =>
      useDeepFocus({ enabled: true, graceMs: 5000, isRunning: () => true, onPause, onPausedWhileAway }),
    )

    const hiddenAt = Date.now()
    setVisibility('hidden')
    // Avance l'horloge système sans exécuter les timers en attente : simule l'exécution
    // JS gelée en arrière-plan (le setTimeout ne tourne jamais avant le retour).
    vi.setSystemTime(hiddenAt + 40_000)
    setVisibility('visible')

    expect(onPause).toHaveBeenCalledWith(hiddenAt)
    expect(onPausedWhileAway).toHaveBeenCalledTimes(1)
  })

  it('reste à l’écoute après avoir lui-même mis la session en pause (le toast de reprise doit encore se déclencher)', () => {
    vi.useFakeTimers()
    const onPause = vi.fn()
    const onPausedWhileAway = vi.fn()
    let running = true
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useDeepFocus({ enabled, graceMs: 5000, isRunning: () => running, onPause, onPausedWhileAway }),
      { initialProps: { enabled: true } },
    )

    setVisibility('hidden')
    vi.advanceTimersByTime(5000)
    expect(onPause).toHaveBeenCalledTimes(1)

    // La pause déclenchée par Deep Focus lui-même ne doit jamais désinstaller
    // l'écouteur — `enabled` (réglage + mode/segment) reste vrai, indépendamment du
    // statut running/paused désormais faux.
    running = false
    rerender({ enabled: true })

    setVisibility('visible')
    expect(onPausedWhileAway).toHaveBeenCalledTimes(1)
  })

  it('nettoie l’écouteur et le minuteur en attente au démontage', () => {
    vi.useFakeTimers()
    const onPause = vi.fn()
    const { unmount } = renderHook(() =>
      useDeepFocus({
        enabled: true,
        graceMs: 5000,
        isRunning: () => true,
        onPause,
        onPausedWhileAway: vi.fn(),
      }),
    )

    setVisibility('hidden')
    unmount()
    vi.advanceTimersByTime(10_000)

    expect(onPause).not.toHaveBeenCalled()
  })

  it('utilise toujours la dernière version de onPause/onPausedWhileAway', () => {
    vi.useFakeTimers()
    const firstPause = vi.fn()
    const secondPause = vi.fn()
    const { rerender } = renderHook(
      ({ onPause }: { onPause: () => void }) =>
        useDeepFocus({
          enabled: true,
          graceMs: 5000,
          isRunning: () => true,
          onPause,
          onPausedWhileAway: vi.fn(),
        }),
      { initialProps: { onPause: firstPause } },
    )

    rerender({ onPause: secondPause })
    setVisibility('hidden')
    vi.advanceTimersByTime(5000)

    expect(firstPause).not.toHaveBeenCalled()
    expect(secondPause).toHaveBeenCalled()
  })
})
