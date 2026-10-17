import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useInstallPrompt } from './useInstallPrompt'

const ORIGINAL_UA = window.navigator.userAgent

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

function dispatchBeforeInstallPrompt(promptFn = vi.fn().mockResolvedValue(undefined)) {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  event.prompt = promptFn
  event.userChoice = Promise.resolve({ outcome: 'accepted' })
  window.dispatchEvent(event)
  return event
}

describe('useInstallPrompt — popup d’installation A2HS (§6.2 du cahier des charges)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')
  })

  afterEach(() => {
    setUserAgent(ORIGINAL_UA)
    vi.useRealTimers()
  })

  it('reste masqué tant qu’aucun événement d’installation n’est reçu (Android)', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.visible).toBe(false)
  })

  it('s’affiche avec le bouton « Installer » quand beforeinstallprompt est reçu (Android)', () => {
    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      dispatchBeforeInstallPrompt()
    })

    expect(result.current.visible).toBe(true)
    expect(result.current.canInstallDirectly).toBe(true)
    expect(result.current.isIOS).toBe(false)
  })

  it('installe puis se marque comme vue définitivement', async () => {
    const promptFn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      dispatchBeforeInstallPrompt(promptFn)
    })

    act(() => {
      result.current.install()
    })

    await waitFor(() => expect(result.current.visible).toBe(false))
    expect(promptFn).toHaveBeenCalled()

    const { result: resultAfterReload } = renderHook(() => useInstallPrompt())
    act(() => {
      dispatchBeforeInstallPrompt()
    })
    expect(resultAfterReload.current.visible).toBe(false)
  })

  it('« Plus tard » masque la popup et empêche son retour', () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      dispatchBeforeInstallPrompt()
    })
    act(() => result.current.dismiss())
    expect(result.current.visible).toBe(false)

    const { result: resultAfterReload } = renderHook(() => useInstallPrompt())
    act(() => {
      dispatchBeforeInstallPrompt()
    })
    expect(resultAfterReload.current.visible).toBe(false)
  })

  it('sur iOS, s’affiche après un court délai sans bouton « Installer »', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
    vi.useFakeTimers()

    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.visible).toBe(false)
    expect(result.current.isIOS).toBe(true)

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(result.current.visible).toBe(true)
    expect(result.current.canInstallDirectly).toBe(false)
  })
})
